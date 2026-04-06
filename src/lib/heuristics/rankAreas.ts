import centroid from "@turf/centroid";
import type { Feature, Polygon } from "geojson";
import type { PracticeArea, Sport } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { fetchForecastWithRouter } from "@/lib/weather/router";
import type {
  RankedPracticeArea,
  RankedPracticeAreaWind,
} from "@/lib/heuristics/rankAreaTypes";
import { directionRankFactor } from "@/lib/heuristics/windDirection";
import type { ResolvedSportRankingOptions } from "@/lib/heuristics/rankingPreferences";
import {
  parseRankingPreferencesDoc,
  resolveSportRankingOptions,
} from "@/lib/heuristics/rankingPreferences";
import { gustPenalty, windFitScore } from "@/lib/heuristics/profiles";

export type { RankedPracticeArea, RankedPracticeAreaWind } from "@/lib/heuristics/rankAreaTypes";

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
  return Math.floor(((deg % 360) + 360) % 360 / 45);
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
    args.optimalMatchHalfWidthDeg != null && Number.isFinite(args.optimalMatchHalfWidthDeg)
      ? Math.min(90, Math.max(5, args.optimalMatchHalfWidthDeg))
      : 30;
  const rankOpts =
    args.rankingOptions ??
    resolveSportRankingOptions(
      args.sport,
      parseRankingPreferencesDoc(args.rankingPreferencesJson) ?? undefined,
    );
  const { from: windowFrom, to: windowTo } = forecastFetchWindow(args.at);

  const results: RankedPracticeArea[] = [];

  for (const area of args.areas) {
    if (!area.sports.includes(args.sport)) continue;
    const c = areaCentroid(area.geojson);
    if (!c) continue;

    const fc = await fetchForecastWithRouter(c.lat, c.lng, windowFrom, windowTo);
    const breakdown: Record<string, unknown> = { providerId: fc?.providerId ?? null };
    if (!fc?.hourly.length) {
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

    let best = fc.hourly[0];
    let bestDiff = Infinity;
    const target = args.at.getTime();
    for (const h of fc.hourly) {
      const d = Math.abs(h.observedAt.getTime() - target);
      if (d < bestDiff) {
        bestDiff = d;
        best = h;
      }
    }

    const fit = windFitScore(args.sport, best.windSpeedMs, rankOpts.bands);
    const gp = gustPenalty(best.gustMs, best.windSpeedMs, rankOpts.gustPenaltyScale);
    let score = Math.max(0, fit.score * rankOpts.windFitScale - gp);
    const boost = await experienceBoost(
      args.userId,
      area.id,
      args.sport,
      best.windDirDeg,
      best.windSpeedMs,
    );
    breakdown.experienceBoost = boost;
    breakdown.windSpeedMs = best.windSpeedMs;
    breakdown.windDirDeg = best.windDirDeg;
    const dirFactor = directionRankFactor({
      forecastWindFromDeg: best.windDirDeg ?? null,
      areaWindSectorsJson: area.windSectors,
      areaOptimalWindFromDeg: area.optimalWindFromDeg,
      optimalMatchHalfWidthDeg: halfW,
    });
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

    const wind: RankedPracticeAreaWind = {
      speedMs: best.windSpeedMs,
      gustMs: best.gustMs,
      dirFromDeg: best.windDirDeg,
      observedAt: best.observedAt.toISOString(),
    };

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
