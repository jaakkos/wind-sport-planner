import type { Polygon } from "geojson";
import {
  sampleWindFieldGridCandidates,
  selectSpatiallyDispersedLngLat,
  stratifyLngLatByElevationRank,
} from "@/lib/map/polygons";

const POOL_DENSITY_MULT = 8;
const POOL_DENSITY_MIN = 48;
const POOL_DENSITY_MAX = 400;
const DISPERSED_MIN = 16;
const DISPERSED_K_FACTOR = 4;

/** Probes used to estimate internal relief for multi-point “auto” mode. */
export const ELEVATION_RANGE_MAX_PROBES = 12;

/**
 * “Max spots” setting for map wind-arrow grid density (matches server pool when users set
 * max samples to the UI cap).
 */
export const WIND_MAP_ARROW_MAX_SAMPLES_SETTING = 9;

/** Grid density for {@link sampleWindFieldGridCandidates} when resolving multi-point samples. */
export function windSamplePoolDensityHint(maxSamplesSetting: number): number {
  return Math.min(
    POOL_DENSITY_MAX,
    Math.max(maxSamplesSetting * POOL_DENSITY_MULT, POOL_DENSITY_MIN),
  );
}

/** Stable key for per-request elevation caches (4 dp ≈ ~11 m). */
export function latLngElevationKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/** Request-scoped memoization for Open-Meteo (or other) elevation lookups. */
export function createElevationCache(
  fetchElevation: (lat: number, lng: number) => Promise<number | null>,
): (lat: number, lng: number) => Promise<number | null> {
  const cache = new Map<string, number | null>();
  return async (lat, lng) => {
    const key = latLngElevationKey(lat, lng);
    if (cache.has(key)) return cache.get(key) ?? null;
    const v = await fetchElevation(lat, lng);
    cache.set(key, v);
    return v;
  };
}

function pickDispersedFromCandidates(
  candidates: [number, number][],
  centroidLng: number,
  centroidLat: number,
  count: number,
): [number, number][] {
  if (candidates.length === 0) return [[centroidLng, centroidLat]];
  const n = Math.min(Math.max(1, count), candidates.length);
  if (candidates.length <= n) return [...candidates];
  return selectSpatiallyDispersedLngLat(candidates, n, centroidLng, centroidLat);
}

/**
 * Spatially dispersed probes over the same grid pool as forecast multi-point sampling
 * (no elevation stratification — used for relief range and map arrows).
 */
export function windFieldSpatialProbePoints(
  poly: Polygon,
  centroidLng: number,
  centroidLat: number,
  maxSamplesSetting: number,
  probeCount: number,
): [number, number][] {
  const densityHint = windSamplePoolDensityHint(maxSamplesSetting);
  const candidates = sampleWindFieldGridCandidates(
    poly,
    centroidLng,
    centroidLat,
    densityHint,
  );
  return pickDispersedFromCandidates(
    candidates,
    centroidLng,
    centroidLat,
    probeCount,
  );
}

/**
 * Multi-point forecast locations: spatially disperse within a grid pool, then pick k sites
 * stratified by elevation (high → low) so ridge and valley cells both get a chance.
 */
export async function resolveWindForecastSamplePoints(args: {
  poly: Polygon;
  centroidLng: number;
  centroidLat: number;
  k: number;
  maxSamplesSetting: number;
  elevationFor: (lat: number, lng: number) => Promise<number | null>;
}): Promise<[number, number][]> {
  const {
    poly,
    centroidLng,
    centroidLat,
    k,
    maxSamplesSetting,
    elevationFor,
  } = args;
  if (k <= 1) return [[centroidLng, centroidLat]];

  const densityHint = windSamplePoolDensityHint(maxSamplesSetting);
  const candidates = sampleWindFieldGridCandidates(
    poly,
    centroidLng,
    centroidLat,
    densityHint,
  );
  if (candidates.length <= k) return candidates;

  const dispersedCount = Math.min(
    Math.max(k * DISPERSED_K_FACTOR, DISPERSED_MIN),
    candidates.length,
  );
  const dispersed = pickDispersedFromCandidates(
    candidates,
    centroidLng,
    centroidLat,
    dispersedCount,
  );
  const withElev = await Promise.all(
    dispersed.map(async ([lng, lat]) => ({
      lng,
      lat,
      elevM: await elevationFor(lat, lng),
    })),
  );
  return stratifyLngLatByElevationRank(withElev, k);
}
