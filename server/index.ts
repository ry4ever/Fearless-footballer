import express, { type Request, type Response, type NextFunction } from "express";
import { randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient, type MindsetCategory, type SessionMode, type ReflectionFeeling } from "@prisma/client";
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
import { monitoring } from "./lib/monitoring";
import { generateSignedMediaUrl } from "./lib/cdn";
import { computeAthleteMetrics, localDayKey, type CompletionRecord } from "./lib/metrics";
import {
  type AgeGateResponse,
  type AgeGateStatus,
  type AuthTokenSet,
  type BetaUserRole,
  type CaregiverDashboardPayload,
  type OfflineQueueStatus,
  type PairingLink,
  type PairingStatusResponse,
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

const emailSchema = z.string().email().transform((value) => value.trim().toLowerCase());
const displayNameSchema = z.string().trim().min(1).max(100);

const registerAccountSchema = z.object({
  role: z.enum(["athlete", "caregiver"]),
  fullName: displayNameSchema.optional(),
  displayName: displayNameSchema.optional(),
  email: emailSchema,
  password: passwordSchema,
  birthDate: z.string().date().optional(),
  timezone: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).max(2).optional(),
  privacyAcknowledged: z.boolean().optional(),
});

const signInAccountSchema = z.object({
  role: z.enum(["athlete", "caregiver"]),
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
  mode: z.enum(["interactive"]),
  musicEnabled: z.boolean().optional(),
  playbackPositionSeconds: z.number().nonnegative(),
  clientTimestamp: z.string().datetime(),
});

const completionSchema = z.object({
  sessionId: z.string().min(1),
  sessionVersion: z.string().min(1),
  mode: z.enum(["interactive"]),
  completionDurationSeconds: z.number().nonnegative(),
  completedAt: z.string().datetime(),
  reflection: z
    .object({
      feeling: z.enum(["clearer", "steadier", "more_ready"]),
      note: z.string().max(1000).optional(),
    })
    .optional(),
  idempotencyKey: z.string().trim().min(1),
});

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
      role:
        user.role === "MENTOR_ADMIN"
          ? "mentor_admin"
          : user.role === "CAREGIVER"
            ? "caregiver"
            : "athlete",
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
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
// Route handlers
// =============================================================================

async function registerAccountHandler(req: Request, res: Response) {
  const parsed = registerAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid registration payload" });
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

  const passwordHash = await bcrypt.hash(request.password, 12);
  const role = request.role === "athlete" ? "ATHLETE" : "CAREGIVER";
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

  const role = user.role === "CAREGIVER" ? "caregiver" : "athlete";
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
    (payload.role !== "athlete" && payload.role !== "caregiver") ||
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
    (payload.role === "caregiver" && user.role !== "CAREGIVER")
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

  const role: BetaUserRole = rotatedUser.role === "CAREGIVER" ? "caregiver" : "athlete";
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
    include: { phases: true, prompts: true },
  });
  if (!session) {
    res.status(404).json({ error: "No published session available" });
    return;
  }

  const sampleSession = {
    id: session.id,
    slug: session.slug,
    version: session.version,
    title: session.title,
    subtitle: session.subtitle,
    category: session.category.toLowerCase(),
    mindset: "calm",
    defaultDurationSeconds: session.defaultDuration,
    mentor: {
      id: "men_alex_rivera",
      name: session.mentorName,
      title: session.mentorTitle,
      avatarUrl: session.mentorAvatarUrl ?? undefined,
    },
    thumbnailUrl: session.heroImageUrl ?? undefined,
    heroImageUrl: session.heroImageUrl ?? undefined,
    availableModes: ["interactive"] as const,
    media: {
      voiceUrl: session.voiceStreamUrl,
      musicBedUrl: session.musicBedUrl ?? undefined,
      captionsUrl: session.captionsUrl ?? undefined,
      transcriptUrl: undefined,
      transcriptLocale: "en",
    },
    phases: session.phases.map((phase: { phaseNumber: number; label: string; startSeconds: number; endSeconds: number }) => ({
      number: phase.phaseNumber,
      label: phase.label,
      startSeconds: phase.startSeconds,
      endSeconds: phase.endSeconds,
    })),
    prompts: session.prompts.map((prompt: { timestampSeconds: number; promptText: string; subText: string | null }) => ({
      timestampSeconds: prompt.timestampSeconds,
      promptText: prompt.promptText,
      subText: prompt.subText ?? undefined,
    })),
  };

  res.json({ session: sampleSession });
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

  const session = await prisma.session.findFirst({ where: { id: request.sessionId } });
  if (!session) {
    res.status(404).json({ error: "This completion does not match the beta session" });
    return;
  }

  if (session.version !== request.sessionVersion) {
    res.status(404).json({ error: "This session version is no longer available" });
    return;
  }

  const threshold = Math.ceil(session.defaultDuration * 0.8);
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
          mode: "INTERACTIVE",
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
                        : "MORE_READY",
                  athleteNote: request.reflection.note ?? undefined,
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
        title: "Nerves = Performance",
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
    include: { reflection: true },
  });

  const lastRep = lastCompletion
    ? {
        title: "Nerves = Performance",
        duration: `${Math.floor(lastCompletion.durationSeconds / 60)} min ${lastCompletion.durationSeconds % 60} sec`,
        completedAt: lastCompletion.completedAt.toISOString(),
        completedToday:
          localDayKey(lastCompletion.completedAt, metrics.timezone) === localDayKey(now, metrics.timezone),
      }
    : { title: "No completed reps", duration: "", completedAt: "", completedToday: false };

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
    res.status(422).json({ error: "Invalid reset payload" });
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
