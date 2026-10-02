-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'COACH';

-- CreateEnum
CREATE TYPE "CoachLinkStatus" AS ENUM ('PENDING_PARENT', 'ACTIVE', 'DECLINED', 'REVOKED');

-- CreateTable
CREATE TABLE "CoachInvite" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdById" TEXT,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "squadCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachLink" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" "CoachLinkStatus" NOT NULL DEFAULT 'PENDING_PARENT',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentDecidedAt" TIMESTAMP(3),
    "parentDeciderId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "planSessionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "planUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoachInvite_codeHash_key" ON "CoachInvite"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "CoachProfile_userId_key" ON "CoachProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachProfile_squadCode_key" ON "CoachProfile"("squadCode");

-- CreateIndex
CREATE INDEX "CoachLink_athleteId_status_idx" ON "CoachLink"("athleteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CoachLink_coachId_athleteId_key" ON "CoachLink"("coachId", "athleteId");

-- AddForeignKey
ALTER TABLE "CoachProfile" ADD CONSTRAINT "CoachProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachLink" ADD CONSTRAINT "CoachLink_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachLink" ADD CONSTRAINT "CoachLink_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
