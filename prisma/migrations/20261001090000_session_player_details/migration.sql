-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "videoDurationSeconds" INTEGER,
ADD COLUMN     "workingOn" TEXT[] DEFAULT ARRAY[]::TEXT[];
