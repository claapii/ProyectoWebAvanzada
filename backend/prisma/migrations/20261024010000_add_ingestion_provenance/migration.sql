-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('SUCCESS', 'DEGRADED', 'FAILED');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "lastRunId" INTEGER,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "sourceId" INTEGER,
ALTER COLUMN "credits" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DataSource" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" SERIAL NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "triggeredById" INTEGER,
    "status" "IngestionStatus" NOT NULL,
    "requestId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "sha256" TEXT,
    "contentLength" INTEGER,
    "resolution" TEXT,
    "fromCache" BOOLEAN NOT NULL DEFAULT false,
    "changed" BOOLEAN,
    "extractorVersion" TEXT,
    "candidates" INTEGER,
    "validCount" INTEGER,
    "rejectedCount" INTEGER,
    "duplicateCount" INTEGER,
    "semestersDetected" INTEGER,
    "semestersExpected" INTEGER,
    "coverage" DOUBLE PRECISION,
    "validRatio" DOUBLE PRECISION,
    "createdCount" INTEGER,
    "updatedCount" INTEGER,
    "deactivatedCount" INTEGER,
    "warnings" TEXT[],
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_key_key" ON "DataSource"("key");

-- CreateIndex
CREATE INDEX "IngestionRun_sourceId_startedAt_idx" ON "IngestionRun"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "IngestionRun_status_idx" ON "IngestionRun"("status");

-- CreateIndex
CREATE INDEX "Course_suggestedSemester_idx" ON "Course"("suggestedSemester");

-- CreateIndex
CREATE INDEX "Course_category_idx" ON "Course"("category");

-- CreateIndex
CREATE INDEX "Course_sourceId_active_idx" ON "Course"("sourceId", "active");

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_lastRunId_fkey" FOREIGN KEY ("lastRunId") REFERENCES "IngestionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;