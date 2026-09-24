-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ATHLETE', 'CAREGIVER', 'MENTOR_ADMIN');

-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "MindsetCategory" AS ENUM ('CALM', 'FOCUS', 'CONFIDENCE', 'RESILIENCE', 'PERFORMANCE');

-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('INTERACTIVE', 'GUIDANCE', 'RELAXATION');

-- CreateEnum
CREATE TYPE "ReflectionFeeling" AS ENUM ('CLEARER', 'STEADIER', 'MORE_READY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ATHLETE',
    "fullName" TEXT NOT NULL,
    "birthDateCiphertext" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "privacyAcknowledgedAt" TIMESTAMP(3),
    "resetTokenHash" TEXT,
    "resetTokenExpires" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "refreshVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetMindset" "MindsetCategory" NOT NULL DEFAULT 'CALM',
    "composureScore" INTEGER NOT NULL DEFAULT 70,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastSessionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaregiverLink" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "caregiverUserId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "status" "LinkStatus" NOT NULL DEFAULT 'PENDING',
    "pairingCodeHash" TEXT,
    "pairingExpiresAt" TIMESTAMP(3),
    "athleteApprovedAt" TIMESTAMP(3),
    "coppaConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentPolicyVersion" TEXT NOT NULL DEFAULT 'beta-v1',
    "consentSource" TEXT NOT NULL DEFAULT 'caregiver_claim',
    "consentActorId" TEXT,
    "consentedAt" TIMESTAMP(3),
    "consentRevokedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaregiverLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "category" "MindsetCategory" NOT NULL,
    "defaultDuration" INTEGER NOT NULL,
    "mentorName" TEXT NOT NULL,
    "mentorTitle" TEXT NOT NULL,
    "mentorAvatarUrl" TEXT,
    "heroImageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "voiceStreamUrl" TEXT NOT NULL,
    "musicBedUrl" TEXT,
    "captionsUrl" TEXT,
    "transcriptText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPhase" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "phaseNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "startSeconds" INTEGER NOT NULL,
    "endSeconds" INTEGER NOT NULL,

    CONSTRAINT "SessionPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPrompt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestampSeconds" INTEGER NOT NULL,
    "promptText" TEXT NOT NULL,
    "subText" TEXT,

    CONSTRAINT "SessionPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionCompleted" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "mode" "SessionMode" NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "SessionCompleted_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reflection" (
    "id" TEXT NOT NULL,
    "completionId" TEXT NOT NULL,
    "feeling" "ReflectionFeeling" NOT NULL,
    "athleteNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reflection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL,
    "athleteProfileId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "composureScore" INTEGER NOT NULL,
    "composureDelta" INTEGER NOT NULL,
    "repsCompleted" INTEGER NOT NULL,
    "streakDays" INTEGER NOT NULL,
    "inferredMoodTrend" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_emailHash_key" ON "User"("emailHash");
CREATE UNIQUE INDEX "User_resetTokenHash_key" ON "User"("resetTokenHash");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_emailHash_idx" ON "User"("emailHash");
CREATE UNIQUE INDEX "AthleteProfile_userId_key" ON "AthleteProfile"("userId");
CREATE UNIQUE INDEX "CaregiverLink_pairingCodeHash_key" ON "CaregiverLink"("pairingCodeHash");
CREATE INDEX "CaregiverLink_pairingCodeHash_idx" ON "CaregiverLink"("pairingCodeHash");
CREATE INDEX "CaregiverLink_status_pairingExpiresAt_idx" ON "CaregiverLink"("status", "pairingExpiresAt");
CREATE UNIQUE INDEX "CaregiverLink_athleteId_caregiverUserId_key" ON "CaregiverLink"("athleteId", "caregiverUserId");
CREATE UNIQUE INDEX "Session_slug_key" ON "Session"("slug");
CREATE INDEX "Session_category_isPublished_idx" ON "Session"("category", "isPublished");
CREATE UNIQUE INDEX "SessionPhase_sessionId_phaseNumber_key" ON "SessionPhase"("sessionId", "phaseNumber");
CREATE INDEX "SessionPrompt_sessionId_timestampSeconds_idx" ON "SessionPrompt"("sessionId", "timestampSeconds");
CREATE UNIQUE INDEX "SessionCompleted_idempotencyKey_key" ON "SessionCompleted"("idempotencyKey");
CREATE INDEX "SessionCompleted_userId_completedAt_idx" ON "SessionCompleted"("userId", "completedAt");
CREATE UNIQUE INDEX "Reflection_completionId_key" ON "Reflection"("completionId");
CREATE INDEX "MetricSnapshot_athleteProfileId_weekStartDate_idx" ON "MetricSnapshot"("athleteProfileId", "weekStartDate");
CREATE INDEX "AuditLog_userId_action_idx" ON "AuditLog"("userId", "action");

-- AddForeignKey
ALTER TABLE "AthleteProfile" ADD CONSTRAINT "AthleteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaregiverLink" ADD CONSTRAINT "CaregiverLink_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaregiverLink" ADD CONSTRAINT "CaregiverLink_caregiverUserId_fkey" FOREIGN KEY ("caregiverUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionPhase" ADD CONSTRAINT "SessionPhase_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionPrompt" ADD CONSTRAINT "SessionPrompt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionCompleted" ADD CONSTRAINT "SessionCompleted_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionCompleted" ADD CONSTRAINT "SessionCompleted_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reflection" ADD CONSTRAINT "Reflection_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "SessionCompleted"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_athleteProfileId_fkey" FOREIGN KEY ("athleteProfileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
