-- Drop the Strava-era domain.
--
-- Tables go before the enums they reference. Within tables, dependents go
-- before parents (FK order): WindLog, WeatherSnapshot, ActivityOverride
-- depend on Activity; Activity and Spot depend on User. ForecastCache and
-- ActivityOverride.linkedPracticeAreaId have no parent left to fix.

-- DropTable
DROP TABLE IF EXISTS "WindLog";

-- DropTable
DROP TABLE IF EXISTS "WeatherSnapshot";

-- DropTable
DROP TABLE IF EXISTS "ActivityOverride";

-- DropTable
DROP TABLE IF EXISTS "Activity";

-- DropTable
DROP TABLE IF EXISTS "Spot";

-- DropTable
DROP TABLE IF EXISTS "ForecastCache";

-- DropEnum
DROP TYPE IF EXISTS "SportSource";

-- DropEnum
DROP TYPE IF EXISTS "SessionOutcome";

-- DropEnum
DROP TYPE IF EXISTS "FeltWindStrength";

-- DropEnum
DROP TYPE IF EXISTS "FeltWindDirection";

-- DropEnum
DROP TYPE IF EXISTS "Gustiness";

-- DropEnum
DROP TYPE IF EXISTS "VisibilityCond";

-- DropEnum
DROP TYPE IF EXISTS "SnowSurface";

-- DropEnum
DROP TYPE IF EXISTS "WaterConditions";

-- DropEnum
DROP TYPE IF EXISTS "WaveHeightBand";
