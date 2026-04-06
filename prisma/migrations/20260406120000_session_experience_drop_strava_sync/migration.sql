-- CreateTable
CREATE TABLE "SessionExperience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "practiceAreaId" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sessionSuitability" "SessionSuitability" NOT NULL,
    "windDirDeg" DOUBLE PRECISION,
    "windSpeedMs" DOUBLE PRECISION,
    "gustMs" DOUBLE PRECISION,
    "weatherProviderId" TEXT,
    "weatherObservedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionExperience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionExperience_userId_practiceAreaId_idx" ON "SessionExperience"("userId", "practiceAreaId");

-- CreateIndex
CREATE INDEX "SessionExperience_userId_occurredAt_idx" ON "SessionExperience"("userId", "occurredAt");

-- AddForeignKey
ALTER TABLE "SessionExperience" ADD CONSTRAINT "SessionExperience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExperience" ADD CONSTRAINT "SessionExperience_practiceAreaId_fkey" FOREIGN KEY ("practiceAreaId") REFERENCES "PracticeArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable
DROP TABLE IF EXISTS "StravaSyncState";
