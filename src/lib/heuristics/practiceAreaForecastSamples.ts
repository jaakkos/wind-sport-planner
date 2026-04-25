import centroid from "@turf/centroid";
import type { Feature, Polygon } from "geojson";
import type { PracticeArea, Sport } from "@/generated/prisma/client";
import { fetchElevationOpenMeteoM } from "@/lib/weather/elevationOpenMeteo";
import { metNoPreferredRegion } from "@/lib/weather/providers/metNo";
import { fetchForecastWithRouter } from "@/lib/weather/router";
import type { NormalizedWind } from "@/lib/weather/types";
import { pickHourClosestTo, polygonBboxDiagonalKm } from "@/lib/heuristics/multiPointForecast";
import { resolvePracticeAreaWindSampleLocations } from "@/lib/heuristics/practiceAreaWindLocations";
import { parseRankingPreferencesDoc } from "@/lib/heuristics/rankingPreferences";
import { resolveMultiPointForecastPrefs } from "@/lib/heuristics/ranking/multiPointPrefs";
import { createElevationCache } from "@/lib/heuristics/windSamplePoints";

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

type ForecastSeriesResult = Awaited<ReturnType<typeof fetchForecastWithRouter>>;

function forecastFetchWindow(at: Date): { from: Date; to: Date } {
  const from = new Date(at.getTime() - 24 * 3600 * 1000);
  const to = new Date(at.getTime() + 10 * 24 * 3600 * 1000);
  return { from, to };
}

export type PracticeAreaForecastSampleSpot = {
  lat: number;
  lng: number;
  elevationM: number | null;
  wind: {
    speedMs: number | null;
    gustMs: number | null;
    dirFromDeg: number | null;
    visibilityM: number | null;
    observedAt: string;
  } | null;
};

export type PracticeAreaForecastSamplesResult = {
  at: string;
  sport: Sport;
  areaId: string;
  areaName: string;
  providerId: string | null;
  multiPointMode: string;
  bboxDiagonalKm: number;
  elevRangeM: number;
  spots: PracticeAreaForecastSampleSpot[];
};

function windToJson(w: NormalizedWind) {
  return {
    speedMs: w.windSpeedMs,
    gustMs: w.gustMs,
    dirFromDeg: w.windDirDeg,
    visibilityM: w.visibilityM,
    observedAt: w.observedAt.toISOString(),
  };
}

/**
 * Forecast at the same sample locations used for ranking (centroid or multi-point inside polygon),
 * so the panel matches the sidebar hour and multi-point settings.
 */
export async function getPracticeAreaForecastSamples(args: {
  area: PracticeArea;
  sport: Sport;
  at: Date;
  rankingPreferencesJson?: unknown;
  userId: string | null;
}): Promise<PracticeAreaForecastSamplesResult | null> {
  if (!args.area.sports.includes(args.sport)) return null;

  const prefsDoc = parseRankingPreferencesDoc(args.rankingPreferencesJson);
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

  const c = areaCentroid(args.area.geojson);
  if (!c) return null;

  const poly = asPolygon(args.area.geojson);
  let bboxDiagKm = 0;
  if (poly) {
    bboxDiagKm = polygonBboxDiagonalKm(poly);
  }

  const { elevRangeM, points } = await resolvePracticeAreaWindSampleLocations({
    poly,
    centroidLng: c.lng,
    centroidLat: c.lat,
    mode: mpPrefs.mode,
    maxSamples: mpPrefs.maxSamples,
    bboxDiagonalKm: bboxDiagKm,
    elevationFor: elevationForPoint,
  });

  async function getForecastCached(
    lat: number,
    lng: number,
    altitudeM: number | null,
  ): Promise<ForecastSeriesResult> {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)},${altitudeM == null ? "x" : Math.round(altitudeM)},${windowFrom.getTime()},${windowTo.getTime()}`;
    let v = forecastCache.get(key);
    if (v === undefined) {
      v = await fetchForecastWithRouter(lat, lng, windowFrom, windowTo, {
        altitudeM,
      });
      forecastCache.set(key, v);
    }
    return v;
  }

  const spots: PracticeAreaForecastSampleSpot[] = [];
  let providerId: string | null = null;

  for (const [lng, lat] of points) {
    const altitudeM = metNoPreferredRegion(lat, lng)
      ? await elevationForPoint(lat, lng)
      : null;
    const fc = await getForecastCached(lat, lng, altitudeM);
    providerId = fc?.providerId ?? providerId;
    if (!fc?.hourly.length) {
      spots.push({ lat, lng, elevationM: altitudeM, wind: null });
      continue;
    }
    const best = pickHourClosestTo(fc.hourly, targetMs);
    spots.push({
      lat,
      lng,
      elevationM: altitudeM,
      wind: best ? windToJson(best) : null,
    });
  }

  return {
    at: args.at.toISOString(),
    sport: args.sport,
    areaId: args.area.id,
    areaName: args.area.name,
    providerId,
    multiPointMode: mpPrefs.mode,
    bboxDiagonalKm: bboxDiagKm,
    elevRangeM,
    spots,
  };
}
