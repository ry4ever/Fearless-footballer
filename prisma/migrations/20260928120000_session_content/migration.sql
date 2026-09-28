-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "comingSoon" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "descriptionMarkdown" TEXT,
ADD COLUMN     "focusArea" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SessionAudio" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "mode" "SessionMode" NOT NULL,
    "withMusic" BOOLEAN NOT NULL,
    "url" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,

    CONSTRAINT "SessionAudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeSession" (
    "programmeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ProgrammeSession_pkey" PRIMARY KEY ("programmeId","position")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionAudio_sessionId_mode_withMusic_key" ON "SessionAudio"("sessionId", "mode", "withMusic");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_slug_key" ON "Programme"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeSession_programmeId_sessionId_key" ON "ProgrammeSession"("programmeId", "sessionId");

-- AddForeignKey
ALTER TABLE "SessionAudio" ADD CONSTRAINT "SessionAudio_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeSession" ADD CONSTRAINT "ProgrammeSession_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeSession" ADD CONSTRAINT "ProgrammeSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

