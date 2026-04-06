CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Sport" AS ENUM ('kiteski', 'kitesurf');

-- CreateEnum
CREATE TYPE "SportSource" AS ENUM ('strava', 'inferred', 'user_override');

-- CreateEnum
CREATE TYPE "SessionOutcome" AS ENUM ('would_not_repeat', 'marginal', 'good', 'excellent');

-- CreateEnum
CREATE TYPE "SessionSuitability" AS ENUM ('unsuitable', 'marginal', 'suitable', 'ideal');

-- CreateEnum
CREATE TYPE "FeltWindStrength" AS ENUM ('low', 'medium', 'high', 'very_high');

-- CreateEnum
CREATE TYPE "FeltWindDirection" AS ENUM ('N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW');

-- CreateEnum
CREATE TYPE "Gustiness" AS ENUM ('steady', 'moderate_gusts', 'strong_gusts');

-- CreateEnum
CREATE TYPE "VisibilityCond" AS ENUM ('poor', 'ok', 'good');

-- CreateEnum
CREATE TYPE "SnowSurface" AS ENUM ('hard_icy', 'packed', 'soft', 'variable');

-- CreateEnum
CREATE TYPE "WaterConditions" AS ENUM ('flat', 'chop', 'waves_small', 'waves_large');

-- CreateEnum
CREATE TYPE "WaveHeightBand" AS ENUM ('ankle', 'waist', 'overhead');

-- CreateEnum
CREATE TYPE "AreaLabelPreset" AS ENUM ('primary', 'lakes', 'coast', 'backup', 'other');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" CITEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "StravaSyncState" (
    "userId" TEXT NOT NULL,
    "oldestFetchedAt" TIMESTAMP(3),
    "latestFetchedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StravaSyncState_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stravaActivityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stravaSportType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "distanceM" DOUBLE PRECISION,
    "movingTimeSec" INTEGER,
    "summaryPolyline" TEXT,
    "mapPolyline" TEXT,
    "startLat" DOUBLE PRECISION,
    "startLng" DOUBLE PRECISION,
    "rawStrava" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityOverride" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "effectiveSport" "Sport",
    "sportSource" "SportSource" NOT NULL DEFAULT 'inferred',
    "userOverriddenSport" BOOLEAN NOT NULL DEFAULT false,
    "hiddenFromMap" BOOLEAN NOT NULL DEFAULT false,
    "linkedPracticeAreaId" TEXT,

    CONSTRAINT "ActivityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeArea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "geojson" JSONB NOT NULL,
    "sports" "Sport"[],
    "labelPreset" "AreaLabelPreset" NOT NULL DEFAULT 'other',
    "windSectors" JSONB,

    CONSTRAINT "PracticeArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "sports" "Sport"[],
    "labelPreset" "AreaLabelPreset" NOT NULL DEFAULT 'other',
    "windSectors" JSONB,

    CONSTRAINT "Spot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherSnapshot" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "windSpeedMs" DOUBLE PRECISION,
    "windDirDeg" DOUBLE PRECISION,
    "gustMs" DOUBLE PRECISION,
    "temperatureC" DOUBLE PRECISION,
    "rawPayload" JSONB,

    CONSTRAINT "WeatherSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WindLog" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "sport" "Sport" NOT NULL,
    "sessionOutcome" "SessionOutcome" NOT NULL,
    "sessionSuitability" "SessionSuitability" NOT NULL,
    "feltWindStrength" "FeltWindStrength" NOT NULL,
    "feltWindDirection" "FeltWindDirection" NOT NULL,
    "gustiness" "Gustiness" NOT NULL,
    "visibility" "VisibilityCond" NOT NULL,
    "hazardFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "snowSurface" "SnowSurface",
    "waterConditions" "WaterConditions",
    "waveHeightBand" "WaveHeightBand",

    CONSTRAINT "WindLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastCache" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "practiceAreaId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForecastCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Activity_userId_startDate_idx" ON "Activity"("userId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_userId_stravaActivityId_key" ON "Activity"("userId", "stravaActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityOverride_activityId_key" ON "ActivityOverride"("activityId");

-- CreateIndex
CREATE INDEX "PracticeArea_userId_idx" ON "PracticeArea"("userId");

-- CreateIndex
CREATE INDEX "Spot_userId_idx" ON "Spot"("userId");

-- CreateIndex
CREATE INDEX "WeatherSnapshot_activityId_idx" ON "WeatherSnapshot"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "WindLog_activityId_key" ON "WindLog"("activityId");

-- CreateIndex
CREATE INDEX "ForecastCache_expiresAt_idx" ON "ForecastCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ForecastCache_providerId_cacheKey_key" ON "ForecastCache"("providerId", "cacheKey");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StravaSyncState" ADD CONSTRAINT "StravaSyncState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityOverride" ADD CONSTRAINT "ActivityOverride_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityOverride" ADD CONSTRAINT "ActivityOverride_linkedPracticeAreaId_fkey" FOREIGN KEY ("linkedPracticeAreaId") REFERENCES "PracticeArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeArea" ADD CONSTRAINT "PracticeArea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spot" ADD CONSTRAINT "Spot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherSnapshot" ADD CONSTRAINT "WeatherSnapshot_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WindLog" ADD CONSTRAINT "WindLog_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
