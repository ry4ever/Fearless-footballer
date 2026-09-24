import express, { type Request, type Response, type NextFunction } from "express";
import { randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient, type MindsetCategory, type SessionMode, type ReflectionFeeling } from "@prisma/client";
import { z } from "zod";
import {
  app as securityApp,
  authLimiter,
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
import {
  type AgeGateResponse,
  type AgeGateStatus,
  type AuthTokenSet,
  type BetaUserRole,
  type CaregiverDashboardPayload,
  type OfflineQueueStatus,
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
  throw new Error(`${name} is required outside test environments`);
}

const JWT_ACCESS_SECRET = requiredRuntimeSecret("JWT_ACCESS_SECRET", TEST_ACCESS_SECRET);
const JWT_REFRESH_SECRET = requiredRuntimeSecret("JWT_REFRESH_SECRET", TEST_REFRESH_SECRET);
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL ?? "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL ?? "30d";
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
  role: BetaUserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function createAccessToken(userId: string, role: BetaUserRole): string {
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
    if (!user || (user.role !== "ATHLETE" && user.role !== "CAREGIVER")) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    req.auth = {
      userId: payload.sub,
      role: user.role === "CAREGIVER" ? "caregiver" : "athlete",
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(role: BetaUserRole) {
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

function getWeekStart(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - day + 1);
  return start;
}

async function calculateMetrics(userId: string, now: Date) {
  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!athlete) return null;

  const timezone = athlete.user.timezone || "UTC";
  const weekStart = getWeekStart(now);

  const completions = await prisma.sessionCompleted.findMany({
    where: { userId },
    orderBy: { completedAt: "desc" },
    include: { reflection: true },
  });

  const weeklyCompletions = completions.filter((completion) => {
    const completionDate = new Date(completion.completedAt);
    return completionDate >= weekStart;
  });

  const completedDays = Array.from(new Set(weeklyCompletions.map((completion) => completion.completedAt.toISOString().slice(0, 10)))).length;

  let streak = 0;
  let cursor = new Date(now);
  cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
  const seen = new Set(completions.map((completion) => completion.completedAt.toISOString().slice(0, 10)));
  while (seen.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  let bestStreak = 0;
  let current = 0;
  let previous: Date | undefined;
  const days = Array.from(new Set(completions.map((completion) => completion.completedAt.toISOString().slice(0, 10)))).sort();
  for (const day of days) {
    const date = new Date(`${day}T00:00:00.000Z`);
    if (previous && date.getTime() - previous.getTime() === 24 * 60 * 60 * 1000) {
      current += 1;
    } else {
      current = 1;
    }
    bestStreak = Math.max(bestStreak, current);
    previous = date;
  }

  const previousScore = athlete.composureScore;
  const completionBonus = weeklyCompletions.length * 2;
  const reflectionBonus = completions.filter((c) => c.reflection).length > 0 ? 1 : 0;
  const streakBonus = Math.min(streak, 3) * 1;
  const newScore = Math.min(100, Math.max(0, previousScore + completionBonus + reflectionBonus + streakBonus));

  const sevenDayPattern = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return weeklyCompletions.some(
      (completion) => completion.completedAt.toISOString().slice(0, 10) === date.toISOString().slice(0, 10),
    );
  });

  return {
    athlete,
    weeklyCompletions,
    completedDays,
    currentStreak: streak,
    bestStreak,
    previousScore,
    newScore,
    delta: newScore - previousScore,
    sevenDayPattern,
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
    expiresIn: Number.parseInt(ACCESS_TOKEN_TTL.replace(/\D/g, "")) || 900,
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
    expiresIn: Number.parseInt(ACCESS_TOKEN_TTL.replace(/\D/g, "")) || 900,
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

  const now = new Date();
  await prisma.caregiverLink.deleteMany({
    where: {
      athleteId: athlete.id,
      status: "PENDING",
      pairingExpiresAt: { lt: now },
    },
  });

  const existingLink = await prisma.caregiverLink.findFirst({
    where: { athleteId: athlete.id, status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  if (existingLink) {
    res.status(409).json({ error: "This athlete already has a pending pairing relationship" });
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

  if (link.status !== "PENDING") {
    res.status(409).json({ error: "That pairing code has already been used" });
    return;
  }

  if (!link.pairingExpiresAt || link.pairingExpiresAt <= new Date()) {
    res.status(409).json({ error: "That pairing code has expired" });
    return;
  }

  const updated = await prisma.caregiverLink.update({
    where: { id: link.id },
    data: {
      caregiverUserId: req.auth.userId,
      relationship: request.relationship,
      status: "PENDING",
      coppaConsent: request.consentConfirmed,
      consentPolicyVersion: CONSENT_POLICY_VERSION,
      consentSource: "caregiver_claim",
      consentActorId: req.auth.userId,
      consentedAt: new Date(),
      consentRevokedAt: null,
      revokedAt: null,
    },
    include: { athlete: { include: { user: true } } },
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
    expiresIn: Number.parseInt(ACCESS_TOKEN_TTL.replace(/\D/g, "")) || 900,
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
  const metrics = await calculateMetrics(req.auth.userId, now);
  if (!metrics) {
    res.status(404).json({ error: "Athlete profile not found" });
    return;
  }

  const completion = await prisma.$transaction(async (tx: any) => {
    const created = await tx.sessionCompleted.create({
      data: {
        userId: req.auth!.userId,
        sessionId: session.id,
        mode: "INTERACTIVE",
        durationSeconds: request.completionDurationSeconds,
        completedAt: new Date(request.completedAt),
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
        composureScore: metrics.newScore,
        currentStreak: metrics.currentStreak,
        bestStreak: metrics.bestStreak,
        lastSessionAt: new Date(request.completedAt),
      },
    });

    await tx.metricSnapshot.create({
      data: {
        athleteProfileId: athlete.id,
        weekStartDate: metrics.weeklyCompletions[0]?.completedAt ?? now,
        composureScore: metrics.newScore,
        composureDelta: metrics.delta,
        repsCompleted: metrics.completedDays,
        streakDays: metrics.currentStreak,
        inferredMoodTrend: metrics.delta > 0 ? "Improving" : "Steady",
      },
    });

    return created;
  });

  const streak = {
    currentStreakDays: metrics.currentStreak,
    bestStreakDays: metrics.bestStreak,
    isNewMilestone: metrics.currentStreak > 0,
  };
  const composure = {
    previousScore: metrics.previousScore,
    newScore: metrics.newScore,
    delta: metrics.delta,
  };

  res.json({
    completionId: completion.id,
    streak,
    composure,
    weeklyProgress: {
      completedDays: metrics.completedDays,
      targetDays: 7,
      sevenDayPattern: metrics.sevenDayPattern,
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
          : `The athlete completed ${metrics.completedDays} mindset reps this week.`,
      daysCompleted: metrics.completedDays,
      daysTarget: 7,
      sevenDayPattern: metrics.sevenDayPattern,
    },
    metrics: {
      moodTrend: {
        status: "Steady",
        subtitle: "A private post-rep check-in was completed.",
        trendData: [metrics.newScore],
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
          ? lastCompletion.completedAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
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
          lastCompletion.completedAt.toISOString().slice(0, 10) ===
          now.toISOString().slice(0, 10),
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
      trendValues: [metrics.newScore],
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
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user || (user.role !== "MENTOR_ADMIN" && user.role !== "CAREGIVER")) {
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
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user || (user.role !== "MENTOR_ADMIN" && user.role !== "CAREGIVER")) {
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
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user || (user.role !== "MENTOR_ADMIN" && user.role !== "CAREGIVER")) {
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
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user || (user.role !== "MENTOR_ADMIN" && user.role !== "CAREGIVER")) {
    res.status(403).json({ error: "Admin or Caregiver role required" });
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

const app = express();

// Security middleware: helmet, CORS, rate limiting, payload guards
app.use(securityApp);

// Health check probes for Load Balancer & Kubernetes container orchestration
app.get("/health", async (_req: Request, res: Response) => {
  const health = await monitoring.getReadiness(prisma);
  res.status(health.status === "ok" ? 200 : 503).json(health);
});
app.get("/health/liveness", (_req: Request, res: Response) => {
  res.json(monitoring.getLiveness());
});
app.get("/health/readiness", async (_req: Request, res: Response) => {
  const health = await monitoring.getReadiness(prisma);
  res.status(health.status === "ok" ? 200 : 503).json(health);
});

// API routes
app.post("/auth/register", registerAccountHandler);
app.post("/auth/sign-in", authLimiter, signInAccountHandler);
app.post("/auth/refresh", refreshTokenHandler);
app.post("/auth/password/reset-request", authLimiter, passwordResetRequestHandler);
app.post("/auth/password/reset", authLimiter, passwordResetConfirmHandler);
app.delete("/auth/account", authenticate, deleteAccountHandler);
app.post("/auth/age-gate", ageGateHandler);
app.post("/auth/pairing/code", authenticate, requireRole("athlete"), createPairingCodeHandler);
app.post("/auth/pairing/claim", authenticate, requireRole("caregiver"), claimPairingCodeHandler);
app.post("/auth/pairing/:linkId/approve", authenticate, requireRole("athlete"), approvePairingHandler);
app.delete("/auth/pairing/:linkId", authenticate, requireRole("athlete"), revokePairingHandler);
app.delete("/auth/consent/:linkId", authenticate, revokeConsentHandler);
app.get("/sessions/today", authenticate, requireRole("athlete"), getAthleteSessionHandler);
app.get("/sessions/:sessionId/stream-url", authenticate, getSessionStreamUrlHandler);
app.post("/sessions/:sessionId/events", authenticate, requireRole("athlete"), recordPlaybackEventHandler);
app.post("/sessions/:sessionId/complete", authenticate, requireRole("athlete"), completeSessionHandler);
app.post("/admin/sessions", authenticate, adminCreateSessionHandler);
app.patch("/admin/sessions/:sessionId/publish", authenticate, adminPublishSessionHandler);
app.get("/admin/sessions", authenticate, adminListSessionsHandler);
app.post("/feedback", authenticate, submitFeedbackHandler);
app.get("/admin/beta-dashboard", authenticate, getBetaDashboardHandler);
app.get(
  "/caregiver/athletes/:athleteId/dashboard",
  authenticate,
  requireRole("caregiver"),
  getCaregiverDashboardHandler,
);
app.get("/athlete/progress", authenticate, requireRole("athlete"), getAthleteProgressHandler);
app.get("/athlete/queue-status", authenticate, requireRole("athlete"), getOfflineQueueStatusHandler);
app.patch("/athlete/profile", authenticate, requireRole("athlete"), updateAthleteProfileHandler);

// Error handling
app.use((error: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
  const status = error.status ?? 500;
  if (status >= 500) {
    console.error("Unexpected server error", {
      method: req.method,
      path: req.path,
      requestId: req.header("x-request-id") ?? "unknown",
    });
  }
  res.status(status).json({
    error: status >= 500 ? "Internal server error" : error.message || "Request failed",
  });
});

export { app, server };

const port = process.env.PORT ?? 3000;
const server = process.env.NODE_ENV !== "test"
  ? app.listen(port, () => {
      console.log(`Fearless Footballer API running on http://localhost:${port}`);
    })
  : undefined;
