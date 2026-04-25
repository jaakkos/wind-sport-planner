import centroid from "@turf/centroid";
import type { Feature, Polygon } from "geojson";
import type { PracticeArea, Sport } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { fetchElevationOpenMeteoM } from "@/lib/weather/elevationOpenMeteo";
import { metNoPreferredRegion } from "@/lib/weather/providers/metNo";
import { fetchForecastWithRouter } from "@/lib/weather/router";
import type { NormalizedWind } from "@/lib/weather/types";
import type {
  RankedPracticeArea,
  RankedPracticeAreaWind,
} from "@/lib/heuristics/rankAreaTypes";
import {
  aggregateMultiPointWinds,
  multiPointDirectionMultiplier,
  pickHourClosestTo,
  polygonBboxDiagonalKm,
} from "@/lib/heuristics/multiPointForecast";
import { resolvePracticeAreaWindSampleLocations } from "@/lib/heuristics/practiceAreaWindLocations";
import { createElevationCache } from "@/lib/heuristics/windSamplePoints";
import { directionRankFactor } from "@/lib/heuristics/windDirection";
import { parseRankingPreferencesDoc } from "@/lib/heuristics/rankingPreferences";
import { resolveMultiPointForecastPrefs } from "@/lib/heuristics/ranking/multiPointPrefs";
import {
  resolveSportRankingOptions,
  type ResolvedSportRankingOptions,
} from "@/lib/heuristics/ranking/sportPrefs";
import { gustPenalty, windFitScore } from "@/lib/heuristics/profiles";

export type { RankedPracticeArea, RankedPracticeAreaWind } from "@/lib/heuristics/rankAreaTypes";

function asPolygon(geojson: unknown): Polygon | null {
  if (!geojson || typeof geojson !== "object") return null;
  const g = geojson as { type?: string; coordinates?: unknown };
  if (g.type !== "Polygon" || !Array.isArray(g.coordinates)) return null;
  return g as Polygon;
}

function areaCentroid(geojson: unknown): { lat: number; lng: number } | null {
  try {
    const f = {
      type: "Feature",
      geometry: geojson as Polygon,
      properties: {},
    } as Feature<Polygon>;
    const c = centroid(f);
    const [lng, lat] = c.geometry.coordinates;
    return { lat, lng };
  } catch {
    return null;
  }
}

function hourBucket(deg: number | null) {
  if (deg == null) return -1;
  return Math.floor((((deg % 360) + 360) % 360) / 45);
}

async function experienceBoost(
  userId: string | null,
  areaId: string,
  sport: Sport,
  windDirDeg: number | null,
  windSpeedMs: number | null,
): Promise<number> {
  if (userId == null) return 1;
  const dirB = hourBucket(windDirDeg);
  const spdB = windSpeedMs == null ? -1 : Math.floor(windSpeedMs / 3);

  const experiences = await prisma.sessionExperience.findMany({
    where: { userId, practiceAreaId: areaId, sport },
  });

  let good = 0;
  let n = 0;
  for (const e of experiences) {
    if (e.windDirDeg == null && e.windSpeedMs == null) continue;
    const sameDir = hourBucket(e.windDirDeg) === dirB;
    const sameSpd =
      spdB >= 0 && Math.floor((e.windSpeedMs ?? 0) / 3) === spdB;
    if (!sameDir && !sameSpd) continue;
    n += 1;
    if (
      e.sessionSuitability === "ideal" ||
      e.sessionSuitability === "suitable"
    ) {
      good += 1;
    }
  }

  if (n < 2) return 1;
  return 1 + Math.min(0.35, (good / n) * 0.5);
}

/** Wide window so a chosen hour (incl. several days ahead) is inside the returned hourly series. */
function forecastFetchWindow(at: Date): { from: Date; to: Date } {
  const from = new Date(at.getTime() - 24 * 3600 * 1000);
  const to = new Date(at.getTime() + 10 * 24 * 3600 * 1000);
  return { from, to };
}

type ForecastSeriesResult = Awaited<ReturnType<typeof fetchForecastWithRouter>>;

async function getForecastCached(
  lat: number,
  lng: number,
  altitudeM: number | null,
  windowFrom: Date,
  windowTo: Date,
  cache: Map<string, ForecastSeriesResult>,
): Promise<ForecastSeriesResult> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)},${altitudeM == null ? "x" : Math.round(altitudeM)},${windowFrom.getTime()},${windowTo.getTime()}`;
  let v = cache.get(key);
  if (v === undefined) {
    v = await fetchForecastWithRouter(lat, lng, windowFrom, windowTo, {
      altitudeM,
    });
    cache.set(key, v);
  }
  return v;
}

/**
 * Fetches the forecast hour closest to `targetMs` for each sample point and
 * returns the collected samples plus the provider id of the last successful
 * fetch (used for breakdown reporting).
 */
async function fetchForecastSamplesAtHour(args: {
  points: [number, number][];
  windowFrom: Date;
  windowTo: Date;
  targetMs: number;
  forecastCache: Map<string, ForecastSeriesResult>;
  elevationFor: (lat: number, lng: number) => Promise<number | null>;
}): Promise<{ samples: NormalizedWind[]; providerId: string | null }> {
  const samples: NormalizedWind[] = [];
  let providerId: string | null = null;

  for (const [lng, lat] of args.points) {
    const altitudeM = metNoPreferredRegion(lat, lng)
      ? await args.elevationFor(lat, lng)
      : null;
    const fc = await getForecastCached(
      lat,
      lng,
      altitudeM,
      args.windowFrom,
      args.windowTo,
      args.forecastCache,
    );
    providerId = fc?.providerId ?? providerId;
    if (!fc?.hourly.length) continue;
    const best = pickHourClosestTo(fc.hourly, args.targetMs);
    if (best) samples.push(best);
  }

  return { samples, providerId };
}

export async function rankPracticeAreas(args: {
  /** When null (anonymous), experience-based boost is skipped. */
  userId: string | null;
  sport: Sport;
  at: Date;
  areas: PracticeArea[];
  /** ± half-width (°) around each area’s optimal for full direction score; default 30 */
  optimalMatchHalfWidthDeg?: number | null;
  rankingOptions?: ResolvedSportRankingOptions | null;
  rankingPreferencesJson?: unknown;
}): Promise<RankedPracticeArea[]> {
  const halfW =
    args.optimalMatchHalfWidthDeg != null &&
    Number.isFinite(args.optimalMatchHalfWidthDeg)
      ? Math.min(90, Math.max(5, args.optimalMatchHalfWidthDeg))
      : 30;
  const prefsDoc = parseRankingPreferencesDoc(args.rankingPreferencesJson);
  const rankOpts =
    args.rankingOptions ??
    resolveSportRankingOptions(args.sport, prefsDoc?.[args.sport]);
  const mpPrefs = resolveMultiPointForecastPrefs(
    prefsDoc?.multiPointForecast,
    args.userId != null,
  );
  const { from: windowFrom, to: windowTo } = forecastFetchWindow(args.at);
  const targetMs = args.at.getTime();

  const forecastCache = new Map<string, ForecastSeriesResult>();
  const elevationForPoint = createElevationCache((lat, lng) =>
    fetchElevationOpenMeteoM(lat, lng),
  );

  const results: RankedPracticeArea[] = [];

  for (const area of args.areas) {
    if (!area.sports.includes(args.sport)) continue;
    const c = areaCentroid(area.geojson);
    if (!c) continue;

    const poly = asPolygon(area.geojson);
    let bboxDiagKm = 0;
    if (poly) {
      bboxDiagKm = polygonBboxDiagonalKm(poly);
    }

    const { elevRangeM, k, points, candidatePoolLength } =
      await resolvePracticeAreaWindSampleLocations({
        poly,
        centroidLng: c.lng,
        centroidLat: c.lat,
        mode: mpPrefs.mode,
        maxSamples: mpPrefs.maxSamples,
        bboxDiagonalKm: bboxDiagKm,
        elevationFor: elevationForPoint,
      });

    const { samples: samplesAtHour, providerId } =
      await fetchForecastSamplesAtHour({
        points,
        windowFrom,
        windowTo,
        targetMs,
        forecastCache,
        elevationFor: elevationForPoint,
      });

    const breakdown: Record<string, unknown> = {
      providerId,
      multiPointMode: mpPrefs.mode,
      multiPointPolicy: mpPrefs.scoringPolicy,
      bboxDiagonalKm: bboxDiagKm,
      elevRangeM,
      multiPointK: k,
      gridPoolPoints: candidatePoolLength,
      forecastSamplePoints: samplesAtHour.length,
    };

    if (samplesAtHour.length === 0) {
      results.push({
        areaId: area.id,
        name: area.name,
        score: 0,
        centroid: { lat: c.lat, lng: c.lng },
        wind: null,
        breakdown: { ...breakdown, reason: "no_forecast" },
      });
      continue;
    }

    const dirArgs = {
      areaWindSectorsJson: area.windSectors,
      areaOptimalWindFromDeg: area.optimalWindFromDeg,
      optimalMatchHalfWidthDeg: halfW,
    };

    let best: NormalizedWind;
    let fitSpeedMs: number | null;
    let gustForPenaltyMs: number | null;
    let refSpeedForGustMs: number | null;
    let dirFactor: number;
    let wind: RankedPracticeAreaWind;

    if (samplesAtHour.length === 1) {
      best = samplesAtHour[0]!;
      fitSpeedMs = best.windSpeedMs;
      gustForPenaltyMs = best.gustMs;
      refSpeedForGustMs = best.windSpeedMs;
      dirFactor = directionRankFactor({
        ...dirArgs,
        forecastWindFromDeg: best.windDirDeg ?? null,
      });
      wind = {
        speedMs: best.windSpeedMs,
        gustMs: best.gustMs,
        dirFromDeg: best.windDirDeg,
        visibilityM: best.visibilityM,
        observedAt: best.observedAt.toISOString(),
      };
    } else {
      const agg = aggregateMultiPointWinds(samplesAtHour, mpPrefs.scoringPolicy);
      if (!agg) {
        results.push({
          areaId: area.id,
          name: area.name,
          score: 0,
          centroid: { lat: c.lat, lng: c.lng },
          wind: null,
          breakdown: { ...breakdown, reason: "aggregate_failed" },
        });
        continue;
      }
      best = agg.display;
      fitSpeedMs = agg.fitSpeedMs;
      gustForPenaltyMs = agg.gustPenaltyGustMs;
      refSpeedForGustMs = agg.gustPenaltyRefSpeedMs;
      const factors = samplesAtHour.map((s) =>
        directionRankFactor({
          ...dirArgs,
          forecastWindFromDeg: s.windDirDeg ?? null,
        }),
      );
      const meanDir = best.windDirDeg ?? null;
      const factorMean = directionRankFactor({
        ...dirArgs,
        forecastWindFromDeg: meanDir,
      });
      dirFactor = multiPointDirectionMultiplier(
        mpPrefs.scoringPolicy,
        factors,
        factorMean,
      );
      wind = {
        speedMs: best.windSpeedMs,
        gustMs: best.gustMs,
        dirFromDeg: best.windDirDeg,
        visibilityM: best.visibilityM,
        observedAt: best.observedAt.toISOString(),
        multiPoint: {
          samples: agg.summary.samples,
          speedMinMs: agg.summary.speedMinMs,
          speedMaxMs: agg.summary.speedMaxMs,
          speedMedianMs: agg.summary.speedMedianMs,
          gustMaxMs: agg.summary.gustMaxMs,
          dirSpreadDeg: agg.summary.dirSpreadDeg,
        },
      };
      breakdown.multiPointSummary = agg.summary;
    }

    breakdown.windSpeedMs = best.windSpeedMs;
    breakdown.windDirDeg = best.windDirDeg;
    breakdown.visibilityM = best.visibilityM;

    const fit = windFitScore(args.sport, fitSpeedMs, rankOpts.bands);
    const gp = gustPenalty(
      gustForPenaltyMs,
      refSpeedForGustMs,
      rankOpts.gustPenaltyScale,
    );
    let score = Math.max(0, fit.score * rankOpts.windFitScale - gp);
    const boost = await experienceBoost(
      args.userId,
      area.id,
      args.sport,
      best.windDirDeg,
      best.windSpeedMs,
    );
    breakdown.experienceBoost = boost;
    breakdown.directionFactor = dirFactor;
    breakdown.areaOptimalWindFromDeg = area.optimalWindFromDeg;
    breakdown.optimalMatchHalfWidthDeg = halfW;
    breakdown.rankingBands = rankOpts.bands;
    breakdown.windFitScale = rankOpts.windFitScale;
    breakdown.gustPenaltyScale = rankOpts.gustPenaltyScale;
    breakdown.directionEmphasis = rankOpts.directionEmphasis;
    const dirEff = 1 + (dirFactor - 1) * rankOpts.directionEmphasis;
    breakdown.directionEffective = dirEff;
    score = Math.round(Math.min(100, score * boost * dirEff));

    results.push({
      areaId: area.id,
      name: area.name,
      score,
      centroid: { lat: c.lat, lng: c.lng },
      wind,
      breakdown,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
