import express, { type Request, type Response, type NextFunction } from "express";
import { randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Prisma, PrismaClient, type MindsetCategory, type SessionMode, type ReflectionFeeling } from "@prisma/client";
import { z } from "zod";
import {
  app as securityApp,
  authLimiter,
  pairingClaimLimiter,
  passwordSchema,
  validateProductionConfig,
} from "./lib/security";
import {
  decryptPII,
  encryptPII,
  hashEmail,
  hashPairingCode,
  hashResetToken,
} from "./lib/pii";
import { sanitizeAuditDetails } from "./lib/audit";
import { coachAdminEmailHashes, createCoachInvite, normaliseCode, uniqueSquadCode } from "./lib/coachInvites";
import { monitoring } from "./lib/monitoring";
import { generateSignedMediaUrl } from "./lib/cdn";
import { computeAthleteMetrics, consecutiveTrainingWeeks, localDayKey, type CompletionRecord } from "./lib/metrics";
import {
  type AgeGateResponse,
  type AgeGateStatus,
  type AuthTokenSet,
  type BetaUserRole,
  type CaregiverDashboardPayload,
  type CoachAthleteDetail,
  type CoachInviteSummary,
  type CoachSquadResponse,
  type OfflineQueueStatus,
  type PairingLink,
  type PairingStatusResponse,
  type SessionLibraryResponse,
  type SessionPackage,
  type PlaybackEventRequest,
  type RegisterAccountRequest,
  type RegisterAccountResponse,
  type SessionCompletionRequest,
  type UserAccount,
  type AthleteProgress,
} from "../shared/types";

// =============================================================================
// Environment and Prisma setup
// =============================================================================

const prisma = new PrismaClient();

const TEST_ACCESS_SECRET = "test-access-secret";
const TEST_REFRESH_SECRET = "test-refresh-secret";

function requiredRuntimeSecret(name: string, testValue: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === "test") return testValue;
  throw new Error(`${name} is required outside test environments. Check your deployment environment variables.`);
}

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || (process.env.NODE_ENV === "test" ? TEST_ACCESS_SECRET : requiredRuntimeSecret("JWT_ACCESS_SECRET", TEST_ACCESS_SECRET));
const JWT_REFRESH_SECRET = requiredRuntimeSecret("JWT_REFRESH_SECRET", TEST_REFRESH_SECRET);
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL ?? "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL ?? "30d";
/** Seconds for a jsonwebtoken-style TTL ("15m", "1h", "900s"; bare numbers are ms, as in jsonwebtoken). */
function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(ttl.trim());
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = (match[2] ?? "ms").toLowerCase();
  const multiplier = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 1;
  return Math.max(1, Math.round(value * multiplier));
}
const ACCESS_TOKEN_TTL_SECONDS = ttlToSeconds(ACCESS_TOKEN_TTL);
const CONSENT_POLICY_VERSION = process.env.CONSENT_POLICY_VERSION ?? "beta-v1";

validateProductionConfig();

// =============================================================================
// Zod schemas for request validation
// =============================================================================

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());
const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name")
  .max(100, "Name must be 100 characters or fewer");

const registerAccountSchema = z.object({
  role: z.enum(["athlete", "caregiver", "coach"]),
  /** Coaches can only sign up with an invite code from Mark. */
  inviteCode: z.string().trim().min(6).max(40).optional(),
  fullName: displayNameSchema.optional(),
  displayName: displayNameSchema.optional(),
  email: emailSchema,
  password: passwordSchema,
  birthDate: z.string().date("Enter your date of birth as YYYY-MM-DD").optional(),
  timezone: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).max(2).optional(),
  privacyAcknowledged: z.boolean().optional(),
});

const signInAccountSchema = z.object({
  role: z.enum(["athlete", "caregiver", "coach"]),
  email: emailSchema,
  password: z.string().min(1).max(128),
});

const ageGateSchema = z.object({
  birthDate: z.string().date(),
  timezone: z.string().trim().min(1),
  region: z.string().trim().min(1).max(2).optional(),
});

const pairingClaimSchema = z.object({
  pairingCode: z.string().trim().min(4).max(20),
  relationship: z.enum(["parent", "guardian"]),
  consentConfirmed: z.boolean(),
});

const pairingApprovalSchema = z.object({
  approved: z.boolean(),
});

const playbackEventSchema = z.object({
  eventType: z.enum(["start", "heartbeat", "pause", "seek", "finish"]),
  mode: z.enum(["interactive", "guidance", "relaxation"]),
  musicEnabled: z.boolean().optional(),
  playbackPositionSeconds: z.number().nonnegative(),
  clientTimestamp: z.string().datetime(),
});

const completionSchema = z.object({
  sessionId: z.string().min(1),
  sessionVersion: z.string().min(1),
  mode: z.enum(["interactive", "guidance", "relaxation"]),
  withMusic: z.boolean().optional(),
  completionDurationSeconds: z.number().nonnegative(),
  completedAt: z.string().datetime(),
  reflection: z
    .object({
      feeling: z.enum(["clearer", "steadier", "more_ready"]).optional(),
      note: z.string().trim().max(1000).optional(),
    })
    .refine((reflection) => reflection.feeling || reflection.note, "A reflection needs a feeling or a note.")
    .optional(),
  idempotencyKey: z.string().trim().min(1),
});

/**
 * A message the person filling in the form can act on. Schemas above give
 * user-facing messages; zod's built-in ones (e.g. wrong types) are replaced
 * by the fallback so internals aren't exposed.
 */
function firstIssueMessage(error: z.ZodError, fallback: string): string {
  const issue = error.issues[0];
  if (!issue || issue.code === "invalid_type" || issue.code === "unrecognized_keys") return fallback;
  return issue.message || fallback;
}

// =============================================================================
// Auth helpers
// =============================================================================

interface AuthContext {
  userId: string;
  role: BetaUserRole | "mentor_admin";
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function createAccessToken(userId: string, role: AuthContext["role"]): string {
  return jwt.sign(
    { sub: userId, role },
    JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL, issuer: "fearless-footballer" } as jwt.SignOptions,
  );
}

export function createRefreshToken(
  userId: string,
  role: BetaUserRole,
  refreshVersion: number,
): string {
  return jwt.sign(
    { sub: userId, role, refreshVersion },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL, issuer: "fearless-footballer" } as jwt.SignOptions,
  );
}

async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = header.replace(/^Bearer\s+/i, "");
  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET, {
      issuer: "fearless-footballer",
    }) as { sub?: unknown; role?: unknown };

    if (typeof payload.sub !== "string") {
      res.status(401).json({ error: "Invalid token subject" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { role: true },
    });
    if (!user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // The role always comes from the database, never from the token claim.
    req.auth = {
      userId: payload.sub,
      role: user.role === "MENTOR_ADMIN" ? "mentor_admin" : accountRole(user.role),
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** The app-facing role for a stored one (admins sign in through other routes). */
function accountRole(role: string): BetaUserRole {
  if (role === "CAREGIVER") return "caregiver";
  if (role === "COACH") return "coach";
  return "athlete";
}

function requireRole(role: AuthContext["role"]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (req.auth.role !== role) {
      res.status(403).json({ error: `Role ${role} is required` });
      return;
    }
    next();
  };
}

// =============================================================================
// Age gate logic
// =============================================================================

export function evaluateAgeGate(birthDate: string, now: Date): AgeGateResponse {
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) {
    return { isMinor: false, status: "restricted", restrictedReason: "age_verification_required" };
  }

  const age = now.getUTCFullYear() - birth.getUTCFullYear();
  const adjusted =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())
      ? age - 1
      : age;

  if (adjusted < 13) {
    return { isMinor: true, status: "restricted", restrictedReason: "age_verification_required" };
  }

  if (adjusted >= 13 && adjusted < 18) {
    return { isMinor: true, status: "pending_guardian_authorization" };
  }

  return { isMinor: false, status: "verified" };
}

// =============================================================================
// Pairing helpers
// =============================================================================

function generatePairingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 4; index += 1) {
    code += chars[randomInt(chars.length)];
  }
  return `FEAR-${code}`;
}

const COACH_STATUS = {
  PENDING_PARENT: "pending_parent",
  ACTIVE: "active",
  DECLINED: "declined",
  REVOKED: "revoked",
} as const;

// =============================================================================
// Metrics calculation (deterministic, timezone-aware)
// =============================================================================

async function loadCompletionRecords(userId: string): Promise<CompletionRecord[]> {
  const completions = await prisma.sessionCompleted.findMany({
    where: { userId },
    select: { completedAt: true, reflection: { select: { id: true } } },
  });
  return completions.map((completion) => ({
    completedAt: completion.completedAt,
    hasReflection: completion.reflection !== null,
  }));
}

/** Weekly view of an athlete's progress, derived only from completion history. */
async function calculateMetrics(userId: string, now: Date) {
  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!athlete) return null;

  const timezone = athlete.user.timezone || "UTC";
  const records = await loadCompletionRecords(userId);
  const metrics = computeAthleteMetrics(records, timezone, now);

  return {
    athlete,
    timezone,
    records,
    completedDays: metrics.activeDaysLast7,
    currentStreak: metrics.currentStreak,
    bestStreak: metrics.bestStreak,
    previousScore: metrics.scoreWeekAgo,
    newScore: metrics.score,
    delta: metrics.score - metrics.scoreWeekAgo,
    sevenDayPattern: metrics.sevenDayPattern,
    scoreTrend: metrics.scoreTrend,
  };
}

// =============================================================================
// Session packages
// =============================================================================

const MEDIA_PUBLIC_BASE_URL = (process.env.MEDIA_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");

/** Media keys ("audio/…") resolve against the public media host; URLs pass through. */
function mediaUrl(value: string): string {
  if (!value || /^https?:\/\//i.test(value) || !MEDIA_PUBLIC_BASE_URL) return value;
  return `${MEDIA_PUBLIC_BASE_URL}/${value.replace(/^\/+/, "")}`;
}

const SESSION_PACKAGE_INCLUDE = {
  phases: { orderBy: { startSeconds: "asc" as const } },
  prompts: { orderBy: { timestampSeconds: "asc" as const } },
  audio: true,
} satisfies Prisma.SessionInclude;

type SessionWithPackageParts = Prisma.SessionGetPayload<{ include: typeof SESSION_PACKAGE_INCLUDE }>;

const MODE_FROM_DB = { INTERACTIVE: "interactive", GUIDANCE: "guidance", RELAXATION: "relaxation" } as const;
const MODE_TO_DB = { interactive: "INTERACTIVE", guidance: "GUIDANCE", relaxation: "RELAXATION" } as const;
const MODE_ORDER: SessionMode[] = ["INTERACTIVE", "GUIDANCE", "RELAXATION"];

function toSessionPackage(session: SessionWithPackageParts): SessionPackage {
  const audio = [...session.audio]
    .sort((a, b) => MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode) || Number(b.withMusic) - Number(a.withMusic))
    .map((variant) => ({
      mode: MODE_FROM_DB[variant.mode],
      withMusic: variant.withMusic,
      url: mediaUrl(variant.url),
      durationSeconds: variant.durationSeconds,
    }));
  const modes = Array.from(new Set(audio.map((variant) => variant.mode)));
  return {
    id: session.id,
    slug: session.slug,
    version: session.version,
    title: session.title,
    subtitle: session.subtitle,
    category: session.category.toLowerCase(),
    mindset: "calm",
    defaultDurationSeconds: session.defaultDuration,
    mentor: {
      id: `mentor_${session.mentorName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      name: session.mentorName,
      title: session.mentorTitle,
      avatarUrl: session.mentorAvatarUrl ?? undefined,
    },
    thumbnailUrl: session.heroImageUrl ?? undefined,
    heroImageUrl: session.heroImageUrl ?? undefined,
    availableModes: modes.length > 0 ? modes : ["interactive"],
    media: {
      voiceUrl: mediaUrl(session.voiceStreamUrl),
      musicBedUrl: session.musicBedUrl ? mediaUrl(session.musicBedUrl) : undefined,
      captionsUrl: session.captionsUrl ?? undefined,
      transcriptUrl: undefined,
      transcriptLocale: "en",
    },
    phases: session.phases.map((phase) => ({
      number: phase.phaseNumber,
      label: phase.label,
      startSeconds: phase.startSeconds,
      endSeconds: phase.endSeconds,
    })),
    prompts: session.prompts.map((prompt) => ({
      timestampSeconds: prompt.timestampSeconds,
      promptText: prompt.promptText,
      subText: prompt.subText ?? undefined,
    })),
    focusArea: session.focusArea ?? undefined,
    descriptionMarkdown: session.descriptionMarkdown ?? undefined,
    comingSoon: session.comingSoon || undefined,
    audio: session.comingSoon ? undefined : audio,
    whyVideoUrl: session.videoUrl ? mediaUrl(session.videoUrl) : undefined,
    whyVideoDurationSeconds: session.videoUrl ? (session.videoDurationSeconds ?? undefined) : undefined,
    tagline: session.tagline ?? undefined,
    tags: session.tags.length ? session.tags : undefined,
  };
}

// =============================================================================
// Route handlers
// =============================================================================

async function registerAccountHandler(req: Request, res: Response) {
  const parsed = registerAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: firstIssueMessage(parsed.error, "Check your details and try again") });
    return;
  }

  const request = parsed.data;
  const email = request.email.trim().toLowerCase();
  const emailHash = hashEmail(email);
  const existing = await prisma.user.findUnique({ where: { emailHash } });
  if (existing) {
    res.status(409).json({ error: "Account with this email already exists" });
    return;
  }

  let ageGate: AgeGateResponse = { isMinor: false, status: "verified" };
  if (request.role === "athlete") {
    if (!request.birthDate) {
      res.status(422).json({ error: "Date of birth is required for an athlete account" });
      return;
    }
    if (!request.timezone) {
      res.status(422).json({ error: "Timezone is required for an athlete account" });
      return;
    }
    if (!request.privacyAcknowledged) {
      res.status(422).json({ error: "Acknowledge the privacy notice to continue" });
      return;
    }
    ageGate = evaluateAgeGate(request.birthDate, new Date());
    if (ageGate.status === "restricted") {
      res.status(422).json({ error: "Enter a valid date of birth" });
      return;
    }
  } else if (!request.privacyAcknowledged) {
    res.status(422).json({ error: "Acknowledge the privacy notice to continue" });
    return;
  }

  let invite: { id: string } | null = null;
  const isCoachAdmin = request.role === "coach" && coachAdminEmailHashes(hashEmail).has(emailHash);
  if (request.role === "coach" && !isCoachAdmin) {
    invite = request.inviteCode
      ? await prisma.coachInvite.findFirst({
          where: { codeHash: hashPairingCode(normaliseCode(request.inviteCode)), usedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true },
        })
      : null;
    if (!invite) {
      res.status(422).json({ error: "That coach invite code isn't valid. Ask Mark for a new one." });
      return;
    }
  }

  const passwordHash = await bcrypt.hash(request.password, 12);
  const role = request.role === "athlete" ? "ATHLETE" : request.role === "coach" ? "COACH" : "CAREGIVER";
  const fullName = request.fullName ?? request.displayName ?? request.email;
  const user = await prisma.user.create({
    data: {
      email: encryptPII(email),
      emailHash,
      passwordHash,
      role,
      fullName: encryptPII(fullName),
      birthDateCiphertext: request.birthDate
        ? encryptPII(`${request.birthDate}T00:00:00.000Z`)
        : undefined,
      timezone: request.timezone ?? "UTC",
      privacyAcknowledgedAt: request.privacyAcknowledged ? new Date() : undefined,
      passwordChangedAt: new Date(),
    },
  });

  if (request.role === "athlete") {
    await prisma.athleteProfile.create({
      data: {
        userId: user.id,
      },
    });
  }
  if (request.role === "coach") {
    const usedInvite = invite;
    await prisma.$transaction(async (tx) => {
      if (usedInvite) {
        // Single use: a second sign-up racing on the same code fails here.
        const claimed = await tx.coachInvite.updateMany({
          where: { id: usedInvite.id, usedAt: null },
          data: { usedAt: new Date(), usedById: user.id },
        });
        if (claimed.count !== 1) throw new Error("Coach invite already used");
      }
      await tx.coachProfile.create({ data: { userId: user.id, squadCode: await uniqueSquadCode(tx) } });
    }).catch(async (error) => {
      await prisma.user.delete({ where: { id: user.id } });
      throw error;
    });
  }

  const tokens: AuthTokenSet = {
    accessToken: createAccessToken(user.id, request.role),
    refreshToken: createRefreshToken(user.id, request.role, 1),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };

  const userAccount: UserAccount = {
    id: user.id,
    role: request.role,
    displayName: fullName,
    isMinor: ageGate.isMinor,
    ageGateStatus: ageGate.status,
    pairingStatus: "unlinked",
  };

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "REGISTER",
      entityType: "USER",
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.header("user-agent"),
      details: sanitizeAuditDetails({ role }),
    },
  });

  res.status(201).json({ user: userAccount, tokens });
}

async function signInAccountHandler(req: Request, res: Response) {
  const parsed = signInAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid sign-in payload" });
    return;
  }

  const request = parsed.data;
  const email = request.email.trim().toLowerCase();
  const emailHash = hashEmail(email);
  const user = await prisma.user.findUnique({ where: { emailHash } });
  if (!user) {
    res.status(401).json({ error: "Email or password is incorrect" });
    return;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    res.status(423).json({ error: "Account temporarily locked. Try again later." });
    return;
  }

  const isValid = await bcrypt.compare(request.password, user.passwordHash);
  if (!isValid) {
    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: { increment: 1 } },
      });
      if (updated && updated.failedAttempts >= 5) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
        });
      }
    } catch {
      // Ignore if user was concurrently deleted during test cleanup
    }
    res.status(401).json({ error: "Email or password is incorrect" });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });

  const role = accountRole(user.role);
  const tokens: AuthTokenSet = {
    accessToken: createAccessToken(user.id, role),
    refreshToken: createRefreshToken(user.id, role, user.refreshVersion),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };

  const athleteProfile = await prisma.athleteProfile.findUnique({ where: { userId: user.id } });
  const hasActiveLink = athleteProfile
    ? !!(await prisma.caregiverLink.findFirst({
        where: {
          athleteId: athleteProfile.id,
          status: "ACTIVE",
          coppaConsent: true,
          consentedAt: { not: null },
          consentRevokedAt: null,
          athleteApprovedAt: { not: null },
        },
      }))
    : false;

  let isMinor = false;
  let ageGateStatus: AgeGateStatus = "verified";
  if (user.birthDateCiphertext) {
    const birthDate = decryptPII(user.birthDateCiphertext).slice(0, 10);
    const ageGate = evaluateAgeGate(birthDate, new Date());
    isMinor = ageGate.isMinor;
    ageGateStatus = ageGate.status;
  }

  const userAccount: UserAccount = {
    id: user.id,
    role,
    displayName: decryptPII(user.fullName),
    isMinor,
    ageGateStatus,
    pairingStatus: hasActiveLink ? "active" : "unlinked",
  };

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "SIGN_IN",
      entityType: "USER",
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.header("user-agent"),
    },
  });

  res.json({ user: userAccount, tokens });
}

async function ageGateHandler(req: Request, res: Response) {
  const parsed = ageGateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid age gate payload" });
    return;
  }

  const result = evaluateAgeGate(parsed.data.birthDate, new Date());
  res.json(result);
}

async function createPairingCodeHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "athlete") {
    res.status(403).json({ error: "Athlete role is required" });
    return;
  }

  const athlete = await prisma.athleteProfile.findUnique({ where: { userId: req.auth.userId } });
  if (!athlete) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }

  // Until a caregiver claims it, a link's caregiverUserId holds the athlete's
  // own id as a placeholder. Clear out unclaimed placeholders (in any status,
  // so a declined code can't block the unique athlete/caregiver pair) and
  // expired pending links, so the athlete can always issue a fresh code.
  const now = new Date();
  await prisma.caregiverLink.deleteMany({
    where: {
      athleteId: athlete.id,
      OR: [
        { caregiverUserId: req.auth.userId },
        { status: "PENDING", pairingExpiresAt: { lt: now } },
      ],
    },
  });

  const existingLink = await prisma.caregiverLink.findFirst({
    where: { athleteId: athlete.id, status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  if (existingLink) {
    res.status(409).json({ error: "Approve or decline the pending caregiver request first" });
    return;
  }

  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const link = await prisma.caregiverLink.create({
    data: {
      athleteId: athlete.id,
      caregiverUserId: req.auth.userId,
      relationship: "parent",
      status: "PENDING",
      pairingCodeHash: hashPairingCode(code),
      pairingExpiresAt: expiresAt,
      coppaConsent: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.auth.userId,
      action: "PAIRING_CODE",
      entityType: "CAREGIVER_LINK",
      entityId: link.id,
      ipAddress: req.ip,
      userAgent: req.header("user-agent"),
      details: sanitizeAuditDetails({}),
    },
  });

  res.json({ pairingCode: code, expiresAt: expiresAt.toISOString() });
}

async function claimPairingCodeHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "caregiver") {
    res.status(403).json({ error: "Caregiver role is required" });
    return;
  }

  const parsed = pairingClaimSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid pairing claim payload" });
    return;
  }

  const request = parsed.data;
  if (!request.consentConfirmed) {
    res.status(422).json({ error: "Caregiver consent is required to claim this code" });
    return;
  }

  const link = await prisma.caregiverLink.findFirst({
    where: { pairingCodeHash: hashPairingCode(request.pairingCode.toUpperCase()) },
    include: { athlete: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (!link) {
    res.status(404).json({ error: "That pairing code is not recognized" });
    return;
  }

  const alreadyClaimed = link.caregiverUserId !== link.athlete.userId || link.consentedAt !== null;
  if (link.status !== "PENDING" || alreadyClaimed) {
    res.status(409).json({ error: "That pairing code has already been used" });
    return;
  }

  if (!link.pairingExpiresAt || link.pairingExpiresAt <= new Date()) {
    res.status(409).json({ error: "That pairing code has expired" });
    return;
  }

  const caregiverUserId = req.auth.userId;
  const priorLink = await prisma.caregiverLink.findUnique({
    where: { athleteId_caregiverUserId: { athleteId: link.athleteId, caregiverUserId } },
  });
  if (priorLink && priorLink.status !== "REVOKED") {
    res.status(409).json({ error: "You are already linked to this athlete" });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    // A revoked link from an earlier pairing would violate the unique
    // athlete/caregiver pair; the audit log keeps the history.
    if (priorLink) {
      await tx.caregiverLink.delete({ where: { id: priorLink.id } });
    }
    return tx.caregiverLink.update({
      where: { id: link.id },
      data: {
        caregiverUserId,
        relationship: request.relationship,
        status: "PENDING",
        coppaConsent: request.consentConfirmed,
        consentPolicyVersion: CONSENT_POLICY_VERSION,
        consentSource: "caregiver_claim",
        consentActorId: caregiverUserId,
        consentedAt: new Date(),
        consentRevokedAt: null,
        revokedAt: null,
        // Single use: the code can't be claimed again.
        pairingCodeHash: null,
      },
      include: { athlete: { include: { user: true } } },
    });
  });

  res.json({
    linkId: updated.id,
    status: "pending_athlete_approval" as const,
    athlete: {
      id: updated.athlete.userId,
      displayName: decryptPII(updated.athlete.user.fullName),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.auth.userId,
      action: "PAIRING_CLAIM",
      entityType: "CAREGIVER_LINK",
      entityId: link.id,
      ipAddress: req.ip,
      userAgent: req.header("user-agent"),
      details: sanitizeAuditDetails({ relationship: request.relationship }),
    },
  });
}

async function approvePairingHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "athlete") {
    res.status(403).json({ error: "Athlete role is required" });
    return;
  }

  const linkId = req.params.linkId;
  const parsed = pairingApprovalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid pairing approval payload" });
    return;
  }

  const athlete = await prisma.athleteProfile.findUnique({ where: { userId: req.auth.userId } });
  if (!athlete) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }

  const link = await prisma.caregiverLink.findFirst({ where: { id: linkId, athleteId: athlete.id } });
  if (!link) {
    res.status(403).json({ error: "This athlete cannot approve that relationship" });
    return;
  }

  if (link.status !== "PENDING") {
    res.status(409).json({ error: "This relationship is no longer pending" });
    return;
  }

  if (link.caregiverUserId === req.auth.userId || !link.consentedAt) {
    res.status(409).json({ error: "A caregiver has not entered this pairing code yet" });
    return;
  }

  const now = new Date();
  const updated = await prisma.caregiverLink.update({
    where: { id: link.id },
    data: {
      status: parsed.data.approved ? "ACTIVE" : "REVOKED",
      coppaConsent: parsed.data.approved,
      athleteApprovedAt: parsed.data.approved ? now : undefined,
      consentRevokedAt: parsed.data.approved ? null : now,
      revokedAt: parsed.data.approved ? undefined : now,
    },
  });

  res.json({
    linkId: updated.id,
    status: updated.status === "ACTIVE" ? "active" : "revoked",
    athleteApprovedAt: updated.athleteApprovedAt?.toISOString(),
    revokedAt: updated.revokedAt?.toISOString(),
  });

  await prisma.auditLog.create({
    data: {
      userId: req.auth.userId,
      action: parsed.data.approved ? "PAIRING_APPROVE" : "PAIRING_REVOKE",
      entityType: "CAREGIVER_LINK",
      entityId: link.id,
      ipAddress: req.ip,
      userAgent: req.header("user-agent"),
      details: sanitizeAuditDetails({ approved: parsed.data.approved }),
    },
  });
}

async function revokePairingHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "athlete") {
    res.status(403).json({ error: "Athlete role is required" });
    return;
  }

  const athlete = await prisma.athleteProfile.findUnique({ where: { userId: req.auth.userId } });
  if (!athlete) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }

  const link = await prisma.caregiverLink.findFirst({ where: { id: req.params.linkId, athleteId: athlete.id } });
  if (!link) {
    res.status(403).json({ error: "This athlete cannot revoke that relationship" });
    return;
  }

  if (link.status !== "ACTIVE") {
    res.status(409).json({ error: "Only an active relationship can be revoked" });
    return;
  }

  const updated = await prisma.caregiverLink.update({
    where: { id: link.id },
    data: {
      status: "REVOKED",
      coppaConsent: false,
      consentRevokedAt: new Date(),
      revokedAt: new Date(),
    },
  });

  res.json({
    linkId: updated.id,
    status: "revoked",
    revokedAt: updated.revokedAt?.toISOString(),
  });

  await prisma.auditLog.create({
    data: {
      userId: req.auth.userId,
      action: "PAIRING_REVOKE",
      entityType: "CAREGIVER_LINK",
      entityId: link.id,
      ipAddress: req.ip,
      userAgent: req.header("user-agent"),
      details: sanitizeAuditDetails({}),
    },
  });
}

async function revokeConsentHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const link = await prisma.caregiverLink.findFirst({
    where: {
      id: req.params.linkId,
      OR: [
        { caregiverUserId: req.auth.userId },
        { athlete: { userId: req.auth.userId } },
      ],
    },
  });
  if (!link) {
    res.status(403).json({ error: "This relationship cannot be managed by this account" });
    return;
  }

  if (link.status !== "ACTIVE") {
    res.status(409).json({ error: "This relationship is not active" });
    return;
  }

  const revokedAt = new Date();
  const updated = await prisma.caregiverLink.update({
    where: { id: link.id },
    data: {
      status: "REVOKED",
      coppaConsent: false,
      consentRevokedAt: revokedAt,
      revokedAt,
      pairingCodeHash: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.auth.userId,
      action: "CONSENT_REVOKE",
      entityType: "CAREGIVER_LINK",
      entityId: link.id,
      ipAddress: req.ip,
      userAgent: req.header("user-agent"),
      details: sanitizeAuditDetails({ status: "revoked" }),
    },
  });

  res.json({
    linkId: updated.id,
    status: "revoked",
    revokedAt: updated.revokedAt?.toISOString(),
  });
}

const LINK_STATUS_PRIORITY = { ACTIVE: 0, PENDING: 1, REVOKED: 2 } as const;

/**
 * The pairing link that currently matters for the signed-in athlete or
 * caregiver: an active link first, then one awaiting athlete approval, then
 * the most recent revoked one. Unclaimed codes are not relationships and are
 * never returned.
 */
async function getPairingStatusHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  let where;
  if (req.auth.role === "athlete") {
    const athlete = await prisma.athleteProfile.findUnique({ where: { userId: req.auth.userId } });
    if (!athlete) {
      res.status(404).json({ error: "Athlete profile not found" });
      return;
    }
    where = { athleteId: athlete.id, caregiverUserId: { not: req.auth.userId }, consentedAt: { not: null } };
  } else if (req.auth.role === "caregiver") {
    where = { caregiverUserId: req.auth.userId };
  } else {
    res.status(403).json({ error: "Athlete or caregiver role is required" });
    return;
  }

  const links = await prisma.caregiverLink.findMany({
    where,
    include: { athlete: { select: { userId: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const link = links.sort((a, b) => LINK_STATUS_PRIORITY[a.status] - LINK_STATUS_PRIORITY[b.status])[0];

  const body: PairingStatusResponse = { pairing: null };
  if (link) {
    const pairing: PairingLink = {
      id: link.id,
      athleteId: link.athlete.userId,
      caregiverUserId: link.caregiverUserId,
      relationship: link.relationship === "guardian" ? "guardian" : "parent",
      status:
        link.status === "ACTIVE" ? "active" : link.status === "REVOKED" ? "revoked" : "pending_athlete_approval",
      consentStatus:
        link.status === "REVOKED" ? "revoked" : link.status === "ACTIVE" && link.coppaConsent ? "granted" : "pending",
      consentPolicyVersion: link.consentPolicyVersion,
      consentSource: link.consentSource,
      consentedAt: link.consentedAt?.toISOString(),
      consentRevokedAt: link.consentRevokedAt?.toISOString(),
      athleteApprovedAt: link.athleteApprovedAt?.toISOString(),
      revokedAt: link.revokedAt?.toISOString(),
    };
    body.pairing = pairing;
  }
  res.json(body);
}

async function refreshTokenHandler(req: Request, res: Response) {
  const parsed = z.object({ refreshToken: z.string() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid refresh token payload" });
    return;
  }

  let payload;
  try {
    payload = jwt.verify(parsed.data.refreshToken, JWT_REFRESH_SECRET, {
      issuer: "fearless-footballer",
    }) as {
      sub?: unknown;
      role?: unknown;
      refreshVersion?: unknown;
    };
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  if (
    typeof payload.sub !== "string" ||
    (payload.role !== "athlete" && payload.role !== "caregiver" && payload.role !== "coach") ||
    typeof payload.refreshVersion !== "number"
  ) {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, refreshVersion: true },
  });
  if (
    !user ||
    user.refreshVersion !== payload.refreshVersion ||
    (payload.role === "athlete" && user.role !== "ATHLETE") ||
    (payload.role === "caregiver" && user.role !== "CAREGIVER") ||
    (payload.role === "coach" && user.role !== "COACH")
  ) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  const rotatedUser = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: user.id,
        refreshVersion: user.refreshVersion,
      },
      data: { refreshVersion: { increment: 1 } },
    });
    if (updated.count !== 1) return null;

    return tx.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, refreshVersion: true },
    });
  });

  if (!rotatedUser) {
    res.status(401).json({ error: "Refresh token has been rotated" });
    return;
  }

  const role: BetaUserRole = accountRole(rotatedUser.role);
  const tokens: AuthTokenSet = {
    accessToken: createAccessToken(rotatedUser.id, role),
    refreshToken: createRefreshToken(rotatedUser.id, role, rotatedUser.refreshVersion),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  };

  res.json(tokens);
}

async function getAthleteSessionHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "athlete") {
    res.status(403).json({ error: "Athlete role is required" });
    return;
  }

  const athlete = await prisma.athleteProfile.findUnique({ where: { userId: req.auth.userId } });
  if (!athlete) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }

  const link = await prisma.caregiverLink.findFirst({
    where: {
      athleteId: athlete.id,
      status: "ACTIVE",
      coppaConsent: true,
      consentedAt: { not: null },
      consentRevokedAt: null,
      athleteApprovedAt: { not: null },
    },
  });
  if (!link) {
    res.status(403).json({ error: "Complete consent and pairing before opening a session" });
    return;
  }

  const session = await prisma.session.findFirst({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: SESSION_PACKAGE_INCLUDE,
  });
  if (!session) {
    res.status(404).json({ error: "No published session available" });
    return;
  }

  res.json({ session: toSessionPackage(session) });
}

/** The whole library: playable sessions, coming-soon ones, and programmes. */
async function getSessionLibraryHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const athlete = await prisma.athleteProfile.findUnique({ where: { userId: req.auth.userId } });
  if (!athlete) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }
  const link = await prisma.caregiverLink.findFirst({
    where: {
      athleteId: athlete.id,
      status: "ACTIVE",
      coppaConsent: true,
      consentedAt: { not: null },
      consentRevokedAt: null,
      athleteApprovedAt: { not: null },
    },
  });
  if (!link) {
    res.status(403).json({ error: "Complete consent and pairing before opening a session" });
    return;
  }

  const [sessions, programmes, coachLink] = await Promise.all([
    prisma.session.findMany({
      where: { OR: [{ isPublished: true }, { comingSoon: true }] },
      orderBy: [{ comingSoon: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
      include: SESSION_PACKAGE_INCLUDE,
    }),
    prisma.programme.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: "asc" },
      include: { sessions: { orderBy: { position: "asc" }, select: { sessionId: true } } },
    }),
    prisma.coachLink.findFirst({
      where: { athleteId: athlete.id, status: "ACTIVE" },
      include: { coach: { include: { user: { select: { fullName: true } } } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const playableIds = new Set(sessions.filter((session) => !session.comingSoon).map((session) => session.id));
  const coachSessionIds = (coachLink?.planSessionIds ?? []).filter((id) => playableIds.has(id));

  const body: SessionLibraryResponse = {
    sessions: sessions.map(toSessionPackage),
    programmes: programmes
      .filter((programme) => programme.sessions.length > 0)
      .map((programme) => ({
      slug: programme.slug,
      title: programme.title,
      tagline: programme.tagline ?? undefined,
      description: programme.description,
      sessionIds: programme.sessions.map((member) => member.sessionId),
    })),
    ...(coachLink && coachSessionIds.length > 0
      ? {
          coachPlan: {
            coachName: decryptPII(coachLink.coach.user.fullName),
            sessionIds: coachSessionIds,
            updatedAt: (coachLink.planUpdatedAt ?? coachLink.updatedAt).toISOString(),
          },
        }
      : {}),
  };
  res.json(body);
}

async function recordPlaybackEventHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "athlete") {
    res.status(403).json({ error: "Athlete role is required" });
    return;
  }

  const parsed = playbackEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid playback event payload" });
    return;
  }

  const athlete = await prisma.athleteProfile.findUnique({ where: { userId: req.auth.userId } });
  if (!athlete) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }

  const link = await prisma.caregiverLink.findFirst({
    where: {
      athleteId: athlete.id,
      status: "ACTIVE",
      coppaConsent: true,
      consentedAt: { not: null },
      consentRevokedAt: null,
      athleteApprovedAt: { not: null },
    },
  });
  if (!link) {
    res.status(403).json({ error: "Athlete session access is not active" });
    return;
  }

  const session = await prisma.session.findFirst({ where: { id: req.params.sessionId } });
  if (!session || !session.isPublished) {
    res.status(404).json({ error: "This session is not available" });
    return;
  }

  await prisma.auditLog.create({
    data: {
      userId: req.auth.userId,
      action: "PLAYBACK_EVENT",
      entityType: "SESSION",
      entityId: session.id,
      ipAddress: req.ip,
      userAgent: req.header("user-agent"),
    },
  });

  res.status(204).end();
}

async function completeSessionHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "athlete") {
    res.status(403).json({ error: "Athlete role is required" });
    return;
  }

  const parsed = completionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid completion payload" });
    return;
  }

  const request = parsed.data;
  const idempotencyKey = req.header("Idempotency-Key") ?? request.idempotencyKey;

  const existing = await prisma.sessionCompleted.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.userId !== req.auth.userId) {
      res.status(409).json({ error: "This idempotency key has already been used" });
      return;
    }
    res.json({ completionId: existing.id });
    return;
  }

  const athlete = await prisma.athleteProfile.findUnique({ where: { userId: req.auth.userId } });
  if (!athlete) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }

  const link = await prisma.caregiverLink.findFirst({
    where: {
      athleteId: athlete.id,
      status: "ACTIVE",
      coppaConsent: true,
      consentedAt: { not: null },
      consentRevokedAt: null,
      athleteApprovedAt: { not: null },
    },
  });
  if (!link) {
    res.status(403).json({ error: "Athlete session access is not active" });
    return;
  }

  const session = await prisma.session.findFirst({ where: { id: request.sessionId }, include: { audio: true } });
  if (!session) {
    res.status(404).json({ error: "This completion does not match the beta session" });
    return;
  }

  if (session.version !== request.sessionVersion) {
    res.status(404).json({ error: "This session version is no longer available" });
    return;
  }

  // The versions differ in length, so the 80% rule uses the one actually played.
  const variant = session.audio.find(
    (row) => row.mode === MODE_TO_DB[request.mode] && row.withMusic === (request.withMusic ?? true),
  );
  if (session.audio.length > 0 && !variant) {
    res.status(422).json({ error: "This session doesn't have that version" });
    return;
  }
  const threshold = Math.ceil((variant?.durationSeconds ?? session.defaultDuration) * 0.8);
  if (request.completionDurationSeconds < threshold) {
    res.status(422).json({ error: `Complete at least ${threshold} seconds of playback before finishing` });
    return;
  }

  const now = new Date();
  const completedAt = new Date(request.completedAt);
  if (completedAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    res.status(422).json({ error: "Completion time cannot be in the future" });
    return;
  }

  const current = await calculateMetrics(req.auth.userId, now);
  if (!current) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }
  // Metrics must include the rep being recorded now, not lag one rep behind.
  const before = computeAthleteMetrics(current.records, current.timezone, now);
  const after = computeAthleteMetrics(
    [...current.records, { completedAt, hasReflection: Boolean(request.reflection) }],
    current.timezone,
    now,
  );
  const weeklyDelta = after.score - after.scoreWeekAgo;

  let completion: { id: string };
  try {
    completion = await prisma.$transaction(async (tx: any) => {
      const created = await tx.sessionCompleted.create({
        data: {
          userId: req.auth!.userId,
          sessionId: session.id,
          mode: MODE_TO_DB[request.mode],
          durationSeconds: request.completionDurationSeconds,
          completedAt,
          idempotencyKey,
          reflection: request.reflection
            ? {
                create: {
                  feeling:
                    request.reflection.feeling === "clearer"
                      ? "CLEARER"
                      : request.reflection.feeling === "steadier"
                        ? "STEADIER"
                        : request.reflection.feeling === "more_ready"
                          ? "MORE_READY"
                          : null,
                  athleteNote: request.reflection.note || undefined,
                },
              }
            : undefined,
        },
      });

      await tx.athleteProfile.update({
        where: { id: athlete.id },
        data: {
          composureScore: after.score,
          currentStreak: after.currentStreak,
          bestStreak: after.bestStreak,
          lastSessionAt: completedAt,
        },
      });

      await tx.metricSnapshot.create({
        data: {
          athleteProfileId: athlete.id,
          weekStartDate: new Date(`${after.weekStartKey}T00:00:00.000Z`),
          composureScore: after.score,
          composureDelta: weeklyDelta,
          repsCompleted: after.activeDaysLast7,
          streakDays: after.currentStreak,
          inferredMoodTrend: weeklyDelta > 0 ? "Improving" : "Steady",
        },
      });

      return created;
    });
  } catch (error) {
    // A concurrent retry with the same idempotency key won the insert race.
    if (prismaErrorStatus(error) === 409) {
      const winner = await prisma.sessionCompleted.findUnique({ where: { idempotencyKey } });
      if (winner && winner.userId === req.auth.userId) {
        res.json({ completionId: winner.id });
        return;
      }
    }
    throw error;
  }

  const streak = {
    currentStreakDays: after.currentStreak,
    bestStreakDays: after.bestStreak,
    isNewMilestone: after.bestStreak > before.bestStreak,
  };
  const composure = {
    previousScore: before.score,
    newScore: after.score,
    delta: after.score - before.score,
  };

  res.json({
    completionId: completion.id,
    streak,
    composure,
    weeklyProgress: {
      completedDays: after.activeDaysLast7,
      targetDays: 7,
      sevenDayPattern: after.sevenDayPattern,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.auth.userId,
      action: "SESSION_COMPLETE",
      entityType: "SESSION",
      entityId: session.id,
      ipAddress: req.ip,
      userAgent: req.header("user-agent"),
      details: sanitizeAuditDetails({
        completionId: completion.id,
        durationSeconds: request.completionDurationSeconds,
      }),
    },
  });
}

async function getCaregiverDashboardHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "caregiver") {
    res.status(403).json({ error: "Caregiver role is required" });
    return;
  }

  const athleteId = req.params.athleteId;
  const link = await prisma.caregiverLink.findFirst({
    where: {
      caregiverUserId: req.auth.userId,
      OR: [
        { athleteId },
        { athlete: { userId: athleteId } },
      ],
      status: "ACTIVE",
      coppaConsent: true,
      consentedAt: { not: null },
      consentRevokedAt: null,
      athleteApprovedAt: { not: null },
    },
  });
  if (!link) {
    res.status(403).json({ error: "Caregiver access is not active" });
    return;
  }

  const athleteProfile = await prisma.athleteProfile.findUnique({ where: { id: link.athleteId } });
  if (!athleteProfile) {
    res.status(404).json({ error: "Athlete not found" });
    return;
  }

  const athlete = await prisma.user.findUnique({ where: { id: athleteProfile.userId } });
  if (!athlete) {
    res.status(404).json({ error: "Athlete not found" });
    return;
  }

  const now = new Date();
  const metrics = await calculateMetrics(athleteProfile.userId, now);
  if (!metrics) {
    res.status(404).json({ error: "Athlete not found" });
    return;
  }

  const lastCompletion = await prisma.sessionCompleted.findFirst({
    where: { userId: athleteProfile.userId },
    orderBy: { completedAt: "desc" },
    include: { session: { select: { title: true } } },
  });

  const durationText = lastCompletion
    ? `${Math.floor(lastCompletion.durationSeconds / 60)} min ${lastCompletion.durationSeconds % 60} sec`
    : "No completed reps";

  const dashboard: CaregiverDashboardPayload = {
    athlete: {
      id: athleteProfile.userId,
      name: decryptPII(athlete.fullName),
      program: "Matchday Mindset · Week 1",
      status: "active",
    },
    weeklySummary: {
      headline: metrics.completedDays === 0 ? "Getting started" : "Building composure",
      description:
        metrics.completedDays === 0
          ? "The athlete is ready to complete the first beta session."
          : `The athlete completed mindset reps on ${metrics.completedDays} of the last 7 days.`,
      daysCompleted: metrics.completedDays,
      daysTarget: 7,
      sevenDayPattern: metrics.sevenDayPattern,
    },
    metrics: {
      moodTrend: {
        status: "Steady",
        subtitle: "A private post-rep check-in was completed.",
        trendData: metrics.scoreTrend,
      },
      composureScore: {
        value: metrics.newScore,
        changeWeekly: metrics.delta,
      },
      currentStreak: {
        days: metrics.currentStreak,
        bestDays: metrics.bestStreak,
      },
      lastRep: {
        title: lastCompletion?.session.title ?? "No completed reps",
        duration: durationText,
        completedAt: lastCompletion?.completedAt.toISOString() ?? new Date().toISOString(),
        completedToday: lastCompletion
          ? localDayKey(lastCompletion.completedAt, metrics.timezone) === localDayKey(now, metrics.timezone)
          : false,
      },
    },
    conversationStarters: [
      {
        id: metrics.completedDays === 0 ? "cs_start" : "cs_progress",
        category: "TRY THIS TONIGHT",
        prompt:
          metrics.completedDays === 0
            ? "What would help you feel ready before your next match?"
            : "What helped you stay steady during the week?",
        guidance: "Invite a story, not a score.",
      },
    ],
    privacyPolicyNotice:
      "Private by design. This view shares progress patterns, not session transcripts, reflections, audio, or playback controls.",
  };

  res.json(dashboard);
}

/** Sessions done, weeks in a row and areas worked on: what Progress and coaches see. */
async function trainingSummary(userId: string, timezone: string, now: Date) {
  const completions = await prisma.sessionCompleted.findMany({
    where: { userId },
    select: { sessionId: true, completedAt: true, session: { select: { focusArea: true } } },
  });
  const todayKey = localDayKey(now, timezone);
  const areaCounts = new Map<string, number>();
  for (const completion of completions) {
    const area = completion.session.focusArea ?? "Other sessions";
    areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
  }
  return {
    completedSessionIds: Array.from(new Set(completions.map((completion) => completion.sessionId))),
    completedTodaySessionIds: Array.from(
      new Set(
        completions
          .filter((completion) => localDayKey(completion.completedAt, timezone) === todayKey)
          .map((completion) => completion.sessionId),
      ),
    ),
    totalCompletions: completions.length,
    consecutiveWeeks: consecutiveTrainingWeeks(
      completions.map((completion) => completion.completedAt),
      timezone,
      now,
    ),
    // Most-trained first.
    completionsByArea: Array.from(areaCounts, ([area, count]) => ({ area, count })).sort(
      (a, b) => b.count - a.count || a.area.localeCompare(b.area),
    ),
  };
}

async function getAthleteProgressHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "athlete") {
    res.status(403).json({ error: "Athlete role is required" });
    return;
  }

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: req.auth.userId },
  });
  if (!athlete) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }

  const now = new Date();
  const metrics = await calculateMetrics(req.auth.userId, now);
  if (!metrics) {
    res.status(404).json({ error: "Athlete not found" });
    return;
  }

  const lastCompletion = await prisma.sessionCompleted.findFirst({
    where: { userId: metrics.athlete.userId },
    orderBy: { completedAt: "desc" },
    include: { reflection: true, session: { select: { title: true } } },
  });

  const lastRep = lastCompletion
    ? {
        title: lastCompletion.session.title,
        duration: `${Math.floor(lastCompletion.durationSeconds / 60)} min ${lastCompletion.durationSeconds % 60} sec`,
        completedAt: lastCompletion.completedAt.toISOString(),
        completedToday:
          localDayKey(lastCompletion.completedAt, metrics.timezone) === localDayKey(now, metrics.timezone),
      }
    : { title: "No completed reps", duration: "", completedAt: "", completedToday: false };

  const training = await trainingSummary(metrics.athlete.userId, metrics.timezone, now);

  const progress: AthleteProgress = {
    athleteId: metrics.athlete.userId,
    athleteName: decryptPII(metrics.athlete.user.fullName),
    score: metrics.newScore,
    deltaWeekly: metrics.delta,
    currentStreakDays: metrics.currentStreak,
    bestStreakDays: metrics.bestStreak,
    weeklyTargetDays: 7,
    weeklyCompletedDays: metrics.completedDays,
    sevenDayPattern: metrics.sevenDayPattern,
    lastRep,
    completedSessionIds: training.completedSessionIds,
    completedTodaySessionIds: training.completedTodaySessionIds,
    totalCompletions: training.totalCompletions,
    consecutiveWeeks: training.consecutiveWeeks,
    completionsByArea: training.completionsByArea,
    moodTrend: {
      status: "Steady",
      subtitle: "A private post-rep check-in was completed.",
      trendValues: metrics.scoreTrend,
    },
  };

  res.json(progress);
}

async function getOfflineQueueStatusHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "athlete") {
    res.status(403).json({ error: "Athlete role is required" });
    return;
  }

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: req.auth.userId },
  });
  if (!athlete) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }

  // Server tracks the latest sync timestamp via the most recent completion.
  const lastSynced = await prisma.sessionCompleted.findFirst({
    where: { userId: athlete.userId },
    orderBy: { completedAt: "desc" },
  });

  const status: OfflineQueueStatus = {
    pending: 0,
    lastSyncedAt: lastSynced?.completedAt.toISOString(),
  };

  res.json(status);
}

async function updateAthleteProfileHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "athlete") {
    res.status(403).json({ error: "Athlete role is required" });
    return;
  }

  const parsed = z
    .object({
      displayName: z.string().trim().min(1).max(100).optional(),
      timezone: z.string().trim().min(1).optional(),
      region: z.string().trim().min(1).max(2).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid profile payload" });
    return;
  }

  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId: req.auth.userId },
  });
  if (!athlete) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { fullName: true, timezone: true },
  });
  if (!user) {
    res.status(404).json({ error: "Athlete not found" });
    return;
  }

  const fullName = parsed.data.displayName
    ? encryptPII(parsed.data.displayName)
    : user.fullName;
  const timezone = parsed.data.timezone ?? user.timezone;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: req.auth!.userId },
      data: {
        fullName,
        timezone,
      },
    });
  });

  res.json({
    displayName: decryptPII(fullName),
    timezone,
    region: parsed.data.region ?? undefined,
  });
}

async function passwordResetRequestHandler(req: Request, res: Response) {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid email" });
    return;
  }

  const emailHash = hashEmail(parsed.data.email.trim().toLowerCase());
  const user = await prisma.user.findUnique({ where: { emailHash } });
  if (user) {
    const resetToken = randomBytes(32).toString("base64url");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hashResetToken(resetToken),
        resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET_REQUEST",
        entityType: "USER",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.header("user-agent"),
        details: sanitizeAuditDetails({}),
      },
    });
  }

  res.status(204).end();
}

async function passwordResetConfirmHandler(req: Request, res: Response) {
  const parsed = z
    .object({
      token: z.string().min(32),
      newPassword: passwordSchema,
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: firstIssueMessage(parsed.error, "Invalid reset payload") });
    return;
  }

  const resetTokenHash = hashResetToken(parsed.data.token);
  const candidate = await prisma.user.findFirst({
    where: {
      resetTokenHash,
      resetTokenExpires: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!candidate) {
    res.status(401).json({ error: "Invalid or expired reset token" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const updated = await prisma.$transaction(async (tx) => {
    const consumed = await tx.user.updateMany({
      where: {
        id: candidate.id,
        resetTokenHash,
        resetTokenExpires: { gt: new Date() },
      },
      data: {
        resetTokenHash: null,
        resetTokenExpires: null,
      },
    });
    if (consumed.count !== 1) return null;

    return tx.user.update({
      where: { id: candidate.id },
      data: {
        passwordHash,
        refreshVersion: { increment: 1 },
        passwordChangedAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
  });

  if (!updated) {
    res.status(401).json({ error: "Invalid or expired reset token" });
    return;
  }

  await prisma.auditLog.create({
    data: {
      userId: updated.id,
      action: "PASSWORD_RESET",
      entityType: "USER",
      entityId: updated.id,
      ipAddress: req.ip,
      userAgent: req.header("user-agent"),
      details: sanitizeAuditDetails({}),
    },
  });

  res.status(204).end();
}

async function deleteAccountHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = z.object({ confirmation: z.literal("DELETE_MY_ACCOUNT") }).safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Confirmation required" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { refreshVersion: { increment: 1 } },
    });
    await tx.user.delete({ where: { id: user.id } });
    await tx.auditLog.create({
      data: {
        userId: null,
        action: "ACCOUNT_DELETED",
        entityType: "USER",
        entityId: "deleted",
        ipAddress: null,
        userAgent: null,
        details: sanitizeAuditDetails({ anonymized: true }),
      },
    });
  });

  res.status(204).end();
}

async function getSessionStreamUrlHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const session = await prisma.session.findUnique({ where: { id: req.params.sessionId } });
  if (!session || !session.isPublished) {
    res.status(404).json({ error: "Session not found or not published" });
    return;
  }

  const voiceSigned = generateSignedMediaUrl(session.voiceStreamUrl, 3600);
  const musicSigned = session.musicBedUrl ? generateSignedMediaUrl(session.musicBedUrl, 3600) : undefined;

  res.json({
    sessionId: session.id,
    voiceStreamUrl: voiceSigned.url,
    musicBedUrl: musicSigned?.url,
    expiresAt: voiceSigned.expiresAt,
  });
}

async function adminCreateSessionHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "mentor_admin") {
    res.status(403).json({ error: "Admin role required" });
    return;
  }

  const body = req.body;
  if (!body.slug || !body.title || !body.voiceStreamUrl) {
    res.status(422).json({ error: "Missing required session fields" });
    return;
  }

  const session = await prisma.session.create({
    data: {
      slug: body.slug,
      title: body.title,
      subtitle: body.subtitle || "",
      category: (body.category || "CALM").toUpperCase() as MindsetCategory,
      defaultDuration: body.defaultDuration || 300,
      mentorName: body.mentorName || "Alex Rivera",
      mentorTitle: body.mentorTitle || "Coach",
      voiceStreamUrl: body.voiceStreamUrl,
      musicBedUrl: body.musicBedUrl || null,
      captionsUrl: body.captionsUrl || null,
      transcriptText: body.transcriptText || "",
      isPublished: body.isPublished ?? false,
    },
  });

  res.status(201).json({ session });
}

async function adminPublishSessionHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "mentor_admin") {
    res.status(403).json({ error: "Admin role required" });
    return;
  }

  const { isPublished } = req.body;
  const updated = await prisma.session.update({
    where: { id: req.params.sessionId },
    data: { isPublished: Boolean(isPublished) },
  });

  res.json({ session: updated });
}

async function adminListSessionsHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "mentor_admin") {
    res.status(403).json({ error: "Admin role required" });
    return;
  }

  const sessions = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
    include: { phases: true, prompts: true },
  });

  res.json({ sessions });
}

async function submitFeedbackHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = z
    .object({
      rating: z.number().int().min(1).max(5).default(5),
      category: z.string().trim().min(1).default("general"),
      message: z.string().trim().min(1).max(2000),
      appVersion: z.string().trim().optional(),
      deviceInfo: z.string().trim().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({ error: "Invalid feedback payload" });
    return;
  }

  const feedback = await prisma.betaFeedback.create({
    data: {
      userId: req.auth.userId,
      rating: parsed.data.rating,
      category: parsed.data.category,
      message: parsed.data.message,
      appVersion: parsed.data.appVersion || "1.0.0",
      deviceInfo: parsed.data.deviceInfo || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.auth.userId,
      action: "FEEDBACK_SUBMITTED",
      entityType: "BETA_FEEDBACK",
      entityId: feedback.id,
      ipAddress: req.ip,
      userAgent: req.header("user-agent"),
    },
  });

  res.status(201).json({
    id: feedback.id,
    status: "received",
    submittedAt: feedback.createdAt.toISOString(),
  });
}

async function getBetaDashboardHandler(req: Request, res: Response) {
  if (!req.auth) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.auth.role !== "mentor_admin") {
    res.status(403).json({ error: "Admin role required" });
    return;
  }

  const totalUsers = await prisma.user.count();
  const totalAthletes = await prisma.athleteProfile.count();
  const totalCompletions = await prisma.sessionCompleted.count();
  const recentFeedback = await prisma.betaFeedback.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      category: true,
      message: true,
      appVersion: true,
      createdAt: true,
    },
  });

  const now = new Date();
  const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const completions24h = await prisma.sessionCompleted.count({
    where: { completedAt: { gte: past24h } },
  });

  res.json({
    activeBetaUsers: totalUsers,
    totalAthletes,
    totalCompletions,
    completions24h,
    feedbackItems: recentFeedback.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  });
}

// =============================================================================
// Coaches
//
// A coach (invite-only) shares a squad code. An athlete enters it, their
// parent or guardian approves, and only then can the coach see the athlete's
// training progress – never reflections – and set a plan of sessions.
// =============================================================================

const squadJoinSchema = z.object({ squadCode: z.string().trim().min(4).max(20) });
const coachDecisionSchema = z.object({ approved: z.boolean() });
const coachPlanSchema = z.object({ sessionIds: z.array(z.string().min(1)).max(30) });
const coachInviteSchema = z.object({ note: z.string().trim().max(120).optional(), days: z.number().int().min(1).max(90).optional() });

async function audit(req: Request, action: string, entityType: string, entityId: string) {
  await prisma.auditLog.create({
    data: {
      userId: req.auth?.userId,
      action,
      entityType,
      entityId,
      ipAddress: req.ip,
      userAgent: req.header("user-agent"),
      details: sanitizeAuditDetails({}),
    },
  });
}

/** Admin (Mark): create a single-use invite code for a new coach. */
async function adminCreateCoachInviteHandler(req: Request, res: Response) {
  const parsed = coachInviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid invite request" });
    return;
  }
  const invite = await createCoachInvite(prisma, { createdById: req.auth!.userId, ...parsed.data });
  await audit(req, "COACH_INVITE", "COACH_INVITE", invite.code.slice(0, 6));
  res.status(201).json({ inviteCode: invite.code, expiresAt: invite.expiresAt.toISOString() });
}

/** Athlete: their coach link, if any (pending or active). */
async function getAthleteCoachHandler(req: Request, res: Response) {
  const athlete = await prisma.athleteProfile.findUnique({ where: { userId: req.auth!.userId } });
  if (!athlete) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }
  const link = await prisma.coachLink.findFirst({
    where: { athleteId: athlete.id, status: { in: ["PENDING_PARENT", "ACTIVE"] } },
    include: { coach: { include: { user: { select: { fullName: true } } } } },
    orderBy: { requestedAt: "desc" },
  });
  res.json({
    coach: link
      ? {
          id: link.id,
          coachName: decryptPII(link.coach.user.fullName),
          status: COACH_STATUS[link.status],
          requestedAt: link.requestedAt.toISOString(),
        }
      : null,
  });
}

/** Athlete: ask to join a coach's squad. Needs a parent's approval next. */
async function joinSquadHandler(req: Request, res: Response) {
  const parsed = squadJoinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Enter your coach's squad code" });
    return;
  }
  const athlete = await prisma.athleteProfile.findUnique({ where: { userId: req.auth!.userId } });
  if (!athlete) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }
  const coach = await prisma.coachProfile.findUnique({
    where: { squadCode: normaliseCode(parsed.data.squadCode) },
    include: { user: { select: { fullName: true } } },
  });
  if (!coach) {
    res.status(404).json({ error: "That squad code isn't recognised" });
    return;
  }
  const current = await prisma.coachLink.findFirst({
    where: { athleteId: athlete.id, status: { in: ["PENDING_PARENT", "ACTIVE"] } },
  });
  if (current) {
    res.status(409).json({ error: "You already have a coach. Remove them first to join a different squad." });
    return;
  }
  // Re-joining after a decline or removal starts a fresh request.
  const link = await prisma.coachLink.upsert({
    where: { coachId_athleteId: { coachId: coach.id, athleteId: athlete.id } },
    update: {
      status: "PENDING_PARENT",
      requestedAt: new Date(),
      parentDecidedAt: null,
      parentDeciderId: null,
      revokedAt: null,
      revokedById: null,
    },
    create: { coachId: coach.id, athleteId: athlete.id },
  });
  await audit(req, "COACH_JOIN_REQUEST", "COACH_LINK", link.id);
  res.status(201).json({
    coach: {
      id: link.id,
      coachName: decryptPII(coach.user.fullName),
      status: COACH_STATUS[link.status],
      requestedAt: link.requestedAt.toISOString(),
    },
  });
}

/** Athlete: leave their coach (or cancel a pending request). */
async function leaveCoachHandler(req: Request, res: Response) {
  const athlete = await prisma.athleteProfile.findUnique({ where: { userId: req.auth!.userId } });
  const result = athlete
    ? await prisma.coachLink.updateMany({
        where: { id: String(req.params.linkId), athleteId: athlete.id, status: { in: ["PENDING_PARENT", "ACTIVE"] } },
        data: { status: "REVOKED", revokedAt: new Date(), revokedById: req.auth!.userId },
      })
    : { count: 0 };
  if (result.count === 0) {
    res.status(404).json({ error: "Coach link not found" });
    return;
  }
  await audit(req, "COACH_LINK_REVOKE", "COACH_LINK", String(req.params.linkId));
  res.status(204).end();
}

/** Athletes this caregiver is actively linked to (with consent). */
async function caregiverAthleteIds(caregiverUserId: string): Promise<string[]> {
  const links = await prisma.caregiverLink.findMany({
    where: {
      caregiverUserId,
      status: "ACTIVE",
      coppaConsent: true,
      consentedAt: { not: null },
      consentRevokedAt: null,
      athleteApprovedAt: { not: null },
    },
    select: { athleteId: true },
  });
  return links.map((link) => link.athleteId);
}

/** Parent or guardian: coach requests and links for their athletes. */
async function getCaregiverCoachLinksHandler(req: Request, res: Response) {
  const athleteIds = await caregiverAthleteIds(req.auth!.userId);
  const links = await prisma.coachLink.findMany({
    where: { athleteId: { in: athleteIds }, status: { in: ["PENDING_PARENT", "ACTIVE"] } },
    include: {
      coach: { include: { user: { select: { fullName: true } } } },
      athlete: { include: { user: { select: { fullName: true } } } },
    },
    orderBy: { requestedAt: "desc" },
  });
  res.json({
    coaches: links.map((link) => ({
      id: link.id,
      coachName: decryptPII(link.coach.user.fullName),
      athleteName: decryptPII(link.athlete.user.fullName),
      status: COACH_STATUS[link.status],
      requestedAt: link.requestedAt.toISOString(),
    })),
  });
}

/** Parent or guardian: approve or decline a pending coach request. */
async function decideCoachRequestHandler(req: Request, res: Response) {
  const parsed = coachDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid decision" });
    return;
  }
  const athleteIds = await caregiverAthleteIds(req.auth!.userId);
  const result = await prisma.coachLink.updateMany({
    where: { id: String(req.params.linkId), athleteId: { in: athleteIds }, status: "PENDING_PARENT" },
    data: {
      status: parsed.data.approved ? "ACTIVE" : "DECLINED",
      parentDecidedAt: new Date(),
      parentDeciderId: req.auth!.userId,
    },
  });
  if (result.count === 0) {
    res.status(404).json({ error: "Coach request not found" });
    return;
  }
  await audit(req, parsed.data.approved ? "COACH_LINK_APPROVE" : "COACH_LINK_DECLINE", "COACH_LINK", String(req.params.linkId));
  res.json({ status: parsed.data.approved ? "active" : "declined" });
}

/** Parent or guardian: remove a coach's access. */
async function caregiverRemoveCoachHandler(req: Request, res: Response) {
  const athleteIds = await caregiverAthleteIds(req.auth!.userId);
  const result = await prisma.coachLink.updateMany({
    where: { id: String(req.params.linkId), athleteId: { in: athleteIds }, status: { in: ["PENDING_PARENT", "ACTIVE"] } },
    data: { status: "REVOKED", revokedAt: new Date(), revokedById: req.auth!.userId },
  });
  if (result.count === 0) {
    res.status(404).json({ error: "Coach link not found" });
    return;
  }
  await audit(req, "COACH_LINK_REVOKE", "COACH_LINK", String(req.params.linkId));
  res.status(204).end();
}

async function isCoachAdmin(userId: string): Promise<boolean> {
  const admins = coachAdminEmailHashes(hashEmail);
  if (admins.size === 0) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { emailHash: true, role: true } });
  return user?.role === "COACH" && admins.has(user.emailHash);
}

/** Only coaches listed in COACH_ADMIN_EMAILS (Mark) can manage invites. */
async function requireCoachAdmin(req: Request, res: Response): Promise<boolean> {
  if (await isCoachAdmin(req.auth!.userId)) return true;
  res.status(403).json({ error: "Only Mark can invite coaches" });
  return false;
}

/** Coach admin: invites they've made, newest first, with who used each. */
async function listCoachInvitesHandler(req: Request, res: Response) {
  if (!(await requireCoachAdmin(req, res))) return;
  const invites = await prisma.coachInvite.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const usedBy = await prisma.user.findMany({
    where: { id: { in: invites.map((invite) => invite.usedById).filter((id): id is string => Boolean(id)) } },
    select: { id: true, fullName: true },
  });
  // A name that can't be decrypted (e.g. written under another key) is
  // skipped rather than failing the whole list.
  const names = new Map<string, string>();
  for (const user of usedBy) {
    try {
      names.set(user.id, decryptPII(user.fullName));
    } catch {
      // Leave this invite without a name.
    }
  }
  const now = new Date();
  const body: { invites: CoachInviteSummary[] } = {
    invites: invites.map((invite) => ({
      id: invite.id,
      note: invite.note ?? undefined,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
      status: invite.usedAt ? "used" : invite.expiresAt <= now ? "expired" : "open",
      ...(invite.usedAt ? { usedAt: invite.usedAt.toISOString() } : {}),
      ...(invite.usedById && names.has(invite.usedById) ? { usedByName: names.get(invite.usedById) } : {}),
    })),
  };
  res.json(body);
}

/** Coach admin: create an invite. The code is only returned this once. */
async function createCoachInviteHandler(req: Request, res: Response) {
  if (!(await requireCoachAdmin(req, res))) return;
  const parsed = coachInviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid invite request" });
    return;
  }
  const invite = await createCoachInvite(prisma, { createdById: req.auth!.userId, ...parsed.data });
  await audit(req, "COACH_INVITE", "COACH_INVITE", invite.code.slice(0, 6));
  res.status(201).json({ inviteCode: invite.code, expiresAt: invite.expiresAt.toISOString() });
}

/** Coach admin: cancel an invite nobody has used yet. */
async function cancelCoachInviteHandler(req: Request, res: Response) {
  if (!(await requireCoachAdmin(req, res))) return;
  const result = await prisma.coachInvite.deleteMany({ where: { id: String(req.params.inviteId), usedAt: null } });
  if (result.count === 0) {
    res.status(404).json({ error: "Invite not found or already used" });
    return;
  }
  await audit(req, "COACH_INVITE_CANCEL", "COACH_INVITE", String(req.params.inviteId));
  res.status(204).end();
}

async function coachProfileFor(userId: string) {
  return prisma.coachProfile.findUnique({ where: { userId }, include: { user: { select: { fullName: true } } } });
}

/** Coach: squad code and the athletes who've joined or asked to. */
async function getCoachSquadHandler(req: Request, res: Response) {
  const coach = await coachProfileFor(req.auth!.userId);
  if (!coach) {
    res.status(404).json({ error: "Coach profile not found" });
    return;
  }
  const links = await prisma.coachLink.findMany({
    where: { coachId: coach.id, status: { in: ["PENDING_PARENT", "ACTIVE"] } },
    include: { athlete: { include: { user: { select: { id: true, fullName: true } } } } },
    orderBy: { requestedAt: "desc" },
  });
  const activeUserIds = links.filter((link) => link.status === "ACTIVE").map((link) => link.athlete.user.id);
  const stats = await prisma.sessionCompleted.groupBy({
    by: ["userId"],
    where: { userId: { in: activeUserIds } },
    _count: { _all: true },
    _max: { completedAt: true },
  });
  const statsByUser = new Map(stats.map((row) => [row.userId, row]));
  const body: CoachSquadResponse = {
    coachName: decryptPII(coach.user.fullName),
    squadCode: coach.squadCode,
    canInviteCoaches: await isCoachAdmin(req.auth!.userId),
    athletes: links.map((link) => {
      const row = link.status === "ACTIVE" ? statsByUser.get(link.athlete.user.id) : undefined;
      return {
        linkId: link.id,
        athleteName: decryptPII(link.athlete.user.fullName),
        status: COACH_STATUS[link.status],
        requestedAt: link.requestedAt.toISOString(),
        ...(link.status === "ACTIVE" ? { totalCompletions: row?._count._all ?? 0 } : {}),
        ...(row?._max.completedAt ? { lastSessionAt: row._max.completedAt.toISOString() } : {}),
        hasPlan: link.planSessionIds.length > 0,
      };
    }),
  };
  res.json(body);
}

/** An ACTIVE link belonging to this coach, with the athlete's user. */
async function activeCoachLink(coachUserId: string, linkId: string) {
  return prisma.coachLink.findFirst({
    where: { id: linkId, status: "ACTIVE", coach: { userId: coachUserId } },
    include: { athlete: { include: { user: { select: { id: true, fullName: true, timezone: true } } } } },
  });
}

/** Coach: one athlete's training progress (no reflections) and their plan. */
async function getCoachAthleteHandler(req: Request, res: Response) {
  const link = await activeCoachLink(req.auth!.userId, String(req.params.linkId));
  if (!link) {
    res.status(404).json({ error: "Athlete not found in your squad" });
    return;
  }
  const now = new Date();
  const athleteUserId = link.athlete.user.id;
  const [metrics, training, last, sessions] = await Promise.all([
    calculateMetrics(athleteUserId, now),
    trainingSummary(athleteUserId, link.athlete.user.timezone, now),
    prisma.sessionCompleted.findFirst({
      where: { userId: athleteUserId },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, session: { select: { title: true } } },
    }),
    prisma.session.findMany({
      where: { isPublished: true, comingSoon: false },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, title: true, focusArea: true, tagline: true },
    }),
  ]);
  const body: CoachAthleteDetail = {
    linkId: link.id,
    athleteName: decryptPII(link.athlete.user.fullName),
    progress: {
      totalCompletions: training.totalCompletions,
      consecutiveWeeks: training.consecutiveWeeks,
      completionsByArea: training.completionsByArea,
      currentStreakDays: metrics?.currentStreak ?? 0,
      bestStreakDays: metrics?.bestStreak ?? 0,
      weeklyCompletedDays: metrics?.completedDays ?? 0,
      sevenDayPattern: metrics?.sevenDayPattern ?? Array(7).fill(false),
      ...(last ? { lastSession: { title: last.session.title, completedAt: last.completedAt.toISOString() } } : {}),
    },
    plan: {
      sessionIds: link.planSessionIds,
      ...(link.planUpdatedAt ? { updatedAt: link.planUpdatedAt.toISOString() } : {}),
    },
    sessions: sessions.map((session) => ({
      id: session.id,
      title: session.title,
      focusArea: session.focusArea ?? undefined,
      tagline: session.tagline ?? undefined,
    })),
  };
  res.json(body);
}

/** Coach: set the athlete's plan – sessions in order (empty clears it). */
async function setCoachPlanHandler(req: Request, res: Response) {
  const parsed = coachPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "A plan is a list of up to 30 sessions" });
    return;
  }
  const link = await activeCoachLink(req.auth!.userId, String(req.params.linkId));
  if (!link) {
    res.status(404).json({ error: "Athlete not found in your squad" });
    return;
  }
  const ids = parsed.data.sessionIds;
  const playable = await prisma.session.count({ where: { id: { in: ids }, isPublished: true, comingSoon: false } });
  if (playable !== new Set(ids).size || new Set(ids).size !== ids.length) {
    res.status(422).json({ error: "Plans can only use each available session once" });
    return;
  }
  const updated = await prisma.coachLink.update({
    where: { id: link.id },
    data: { planSessionIds: ids, planUpdatedAt: new Date() },
  });
  await audit(req, "COACH_PLAN_SET", "COACH_LINK", link.id);
  res.json({ sessionIds: updated.planSessionIds, updatedAt: updated.planUpdatedAt?.toISOString() });
}

/** Coach: remove an athlete (or a pending request) from the squad. */
async function coachRemoveAthleteHandler(req: Request, res: Response) {
  const result = await prisma.coachLink.updateMany({
    where: {
      id: String(req.params.linkId),
      coach: { userId: req.auth!.userId },
      status: { in: ["PENDING_PARENT", "ACTIVE"] },
    },
    data: { status: "REVOKED", revokedAt: new Date(), revokedById: req.auth!.userId },
  });
  if (result.count === 0) {
    res.status(404).json({ error: "Athlete not found in your squad" });
    return;
  }
  await audit(req, "COACH_LINK_REVOKE", "COACH_LINK", String(req.params.linkId));
  res.status(204).end();
}

// =============================================================================

// =============================================================================
// Express app setup
// =============================================================================

// Express 4 does not forward rejected promises from async handlers. Without
// this wrapper any database error becomes an unhandled rejection, which
// terminates the Node process and takes the whole API down.
function wrap(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function prismaErrorStatus(error: unknown): number | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "P2025") return 404; // record not found
  if (code === "P2002") return 409; // unique constraint violation
  return undefined;
}

const app = express();
app.set("trust proxy", securityApp.get("trust proxy"));

// Security middleware: helmet, CORS, rate limiting, payload guards
app.use(securityApp);

// Health check probes for Load Balancer & Kubernetes container orchestration
app.get("/health", wrap(async (_req: Request, res: Response) => {
  const health = await monitoring.getReadiness(prisma);
  res.status(health.status === "ok" ? 200 : 503).json(health);
}));
app.get("/health/liveness", (_req: Request, res: Response) => {
  res.json(monitoring.getLiveness());
});
app.get("/health/readiness", wrap(async (_req: Request, res: Response) => {
  const health = await monitoring.getReadiness(prisma);
  res.status(health.status === "ok" ? 200 : 503).json(health);
}));

// API routes
app.post("/auth/register", wrap(registerAccountHandler));
app.post("/auth/sign-in", authLimiter, wrap(signInAccountHandler));
app.post("/auth/refresh", wrap(refreshTokenHandler));
app.post("/auth/password/reset-request", authLimiter, wrap(passwordResetRequestHandler));
app.post("/auth/password/reset", authLimiter, wrap(passwordResetConfirmHandler));
app.delete("/auth/account", wrap(authenticate), wrap(deleteAccountHandler));
app.post("/auth/age-gate", wrap(ageGateHandler));
app.get("/auth/pairing", wrap(authenticate), wrap(getPairingStatusHandler));
app.post("/auth/pairing/code", wrap(authenticate), requireRole("athlete"), wrap(createPairingCodeHandler));
app.post("/auth/pairing/claim", wrap(authenticate), requireRole("caregiver"), pairingClaimLimiter, wrap(claimPairingCodeHandler));
app.post("/auth/pairing/:linkId/approve", wrap(authenticate), requireRole("athlete"), wrap(approvePairingHandler));
app.delete("/auth/pairing/:linkId", wrap(authenticate), requireRole("athlete"), wrap(revokePairingHandler));
app.delete("/auth/consent/:linkId", wrap(authenticate), wrap(revokeConsentHandler));
app.get("/sessions/today", wrap(authenticate), requireRole("athlete"), wrap(getAthleteSessionHandler));
app.get("/sessions", wrap(authenticate), requireRole("athlete"), wrap(getSessionLibraryHandler));
app.get("/sessions/:sessionId/stream-url", wrap(authenticate), wrap(getSessionStreamUrlHandler));
app.post("/sessions/:sessionId/events", wrap(authenticate), requireRole("athlete"), wrap(recordPlaybackEventHandler));
app.post("/sessions/:sessionId/complete", wrap(authenticate), requireRole("athlete"), wrap(completeSessionHandler));
app.post("/admin/sessions", wrap(authenticate), requireRole("mentor_admin"), wrap(adminCreateSessionHandler));
app.patch("/admin/sessions/:sessionId/publish", wrap(authenticate), requireRole("mentor_admin"), wrap(adminPublishSessionHandler));
app.get("/admin/sessions", wrap(authenticate), requireRole("mentor_admin"), wrap(adminListSessionsHandler));
app.post("/feedback", wrap(authenticate), wrap(submitFeedbackHandler));
app.get("/admin/beta-dashboard", wrap(authenticate), requireRole("mentor_admin"), wrap(getBetaDashboardHandler));
app.get(
  "/caregiver/athletes/:athleteId/dashboard",
  wrap(authenticate),
  requireRole("caregiver"),
  wrap(getCaregiverDashboardHandler),
);
app.get("/athlete/progress", wrap(authenticate), requireRole("athlete"), wrap(getAthleteProgressHandler));
app.get("/athlete/coach", wrap(authenticate), requireRole("athlete"), wrap(getAthleteCoachHandler));
app.post("/athlete/coach", wrap(authenticate), requireRole("athlete"), pairingClaimLimiter, wrap(joinSquadHandler));
app.delete("/athlete/coach/:linkId", wrap(authenticate), requireRole("athlete"), wrap(leaveCoachHandler));
app.get("/caregiver/coaches", wrap(authenticate), requireRole("caregiver"), wrap(getCaregiverCoachLinksHandler));
app.post("/caregiver/coaches/:linkId/decision", wrap(authenticate), requireRole("caregiver"), wrap(decideCoachRequestHandler));
app.delete("/caregiver/coaches/:linkId", wrap(authenticate), requireRole("caregiver"), wrap(caregiverRemoveCoachHandler));
app.get("/coach/squad", wrap(authenticate), requireRole("coach"), wrap(getCoachSquadHandler));
app.get("/coach/athletes/:linkId", wrap(authenticate), requireRole("coach"), wrap(getCoachAthleteHandler));
app.put("/coach/athletes/:linkId/plan", wrap(authenticate), requireRole("coach"), wrap(setCoachPlanHandler));
app.delete("/coach/athletes/:linkId", wrap(authenticate), requireRole("coach"), wrap(coachRemoveAthleteHandler));
app.post("/admin/coach-invites", wrap(authenticate), requireRole("mentor_admin"), wrap(adminCreateCoachInviteHandler));
app.get("/coach/invites", wrap(authenticate), requireRole("coach"), wrap(listCoachInvitesHandler));
app.post("/coach/invites", wrap(authenticate), requireRole("coach"), wrap(createCoachInviteHandler));
app.delete("/coach/invites/:inviteId", wrap(authenticate), requireRole("coach"), wrap(cancelCoachInviteHandler));
app.get("/athlete/queue-status", wrap(authenticate), requireRole("athlete"), wrap(getOfflineQueueStatusHandler));
app.patch("/athlete/profile", wrap(authenticate), requireRole("athlete"), wrap(updateAthleteProfileHandler));

// Error handling
app.use((error: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
  const prismaStatus = prismaErrorStatus(error);
  const status = prismaStatus ?? error.status ?? 500;
  if (status >= 500 || res.headersSent) {
    console.error("Unexpected server error", {
      method: req.method,
      path: req.path,
      requestId: req.header("x-request-id") ?? "unknown",
      message: error.message,
    });
  }
  // Some handlers write an audit log after responding; a failure there must
  // not attempt a second response.
  if (res.headersSent) return;
  const message =
    prismaStatus === 404
      ? "Not found"
      : prismaStatus === 409
        ? "This conflicts with an existing record"
        : status >= 500
          ? "Internal server error"
          : error.message || "Request failed";
  res.status(status).json({ error: message });
});

export { app, server };

const port = Number(process.env.PORT ?? 3000);
const server = process.env.NODE_ENV !== "test"
  ? app.listen(port, "0.0.0.0", () => {
      console.log(`Fearless Footballer API running on port ${port} (0.0.0.0)`);
    })
  : undefined;
