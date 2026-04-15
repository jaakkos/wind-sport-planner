import bbox from "@turf/bbox";
import type { Feature, Polygon } from "geojson";
import { haversineKm } from "@/lib/map/mapHubHelpers";
import {
  ELEVATION_RANGE_MAX_PROBES,
  windFieldSpatialProbePoints,
} from "@/lib/heuristics/windSamplePoints";
import type { NormalizedWind } from "@/lib/weather/types";
import { angularDiffDeg } from "@/lib/heuristics/windDirection";
import type { MultiPointForecastMode, MultiPointScoringPolicy } from "@/lib/heuristics/rankingPreferences";

/** Bbox diagonal (km): cheap proxy for “how wide” the polygon is vs model grid. */
export function polygonBboxDiagonalKm(poly: Polygon): number {
  const [minLng, minLat, maxLng, maxLat] = bbox({
    type: "Feature",
    geometry: poly,
    properties: {},
  } as Feature<Polygon>);
  return haversineKm(minLng, minLat, maxLng, maxLat);
}

/** When bbox diagonal or internal relief exceeds these, `auto` mode uses multi-point. */
export const MULTI_POINT_DIAMETER_KM_TRIGGER = 2.8;
export const MULTI_POINT_ELEV_RANGE_M_TRIGGER = 55;

export async function elevationRangeInsidePolygonM(
  poly: Polygon,
  centroidLng: number,
  centroidLat: number,
  elevationFor: (lat: number, lng: number) => Promise<number | null>,
  opts: { maxSamplesSetting: number; maxProbes?: number },
): Promise<number> {
  const maxProbes = opts.maxProbes ?? ELEVATION_RANGE_MAX_PROBES;
  const pts = windFieldSpatialProbePoints(
    poly,
    centroidLng,
    centroidLat,
    opts.maxSamplesSetting,
    maxProbes,
  );
  const vals: number[] = [];
  for (const [lng, lat] of pts) {
    const m = await elevationFor(lat, lng);
    if (m != null && Number.isFinite(m)) vals.push(m);
  }
  if (vals.length < 2) return 0;
  return Math.max(...vals) - Math.min(...vals);
}

export function effectiveSamplePointCount(args: {
  mode: MultiPointForecastMode;
  maxSamples: number;
  bboxDiagonalKm: number;
  elevRangeM: number;
  /** Distinct in-polygon sample locations available (after grid cap). */
  availablePoints: number;
}): number {
  const avail = Math.max(1, args.availablePoints);
  const cap = Math.min(Math.max(3, args.maxSamples), avail);

  if (args.mode === "off") return 1;
  if (args.mode === "on") return cap;

  const bigSpan =
    args.bboxDiagonalKm >= MULTI_POINT_DIAMETER_KM_TRIGGER ||
    args.elevRangeM >= MULTI_POINT_ELEV_RANGE_M_TRIGGER;
  if (!bigSpan) return 1;
  return cap;
}

function medianSorted(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Meteorological wind-from directions → circular mean (0–360). */
export function meanWindFromDeg(dirs: (number | null)[]): number | null {
  const v = dirs.filter((d): d is number => d != null && Number.isFinite(d));
  if (v.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const d of v) {
    const r = (d * Math.PI) / 180;
    sx += Math.sin(r);
    sy += Math.cos(r);
  }
  if (Math.abs(sx) < 1e-8 && Math.abs(sy) < 1e-8) return v[0]!;
  return ((Math.atan2(sx, sy) * 180) / Math.PI + 360) % 360;
}

export function maxDirectionalSpreadDeg(dirs: number[], meanDeg: number): number {
  let m = 0;
  for (const d of dirs) {
    m = Math.max(m, angularDiffDeg(d, meanDeg));
  }
  return m;
}

export function pickHourClosestTo(
  hourly: NormalizedWind[],
  targetMs: number,
): NormalizedWind | null {
  if (!hourly.length) return null;
  let best = hourly[0]!;
  let bestDiff = Infinity;
  for (const h of hourly) {
    const d = Math.abs(h.observedAt.getTime() - targetMs);
    if (d < bestDiff || (d === bestDiff && h.isObservation && !best.isObservation)) {
      bestDiff = d;
      best = h;
    }
  }
  return best;
}

export type AggregatedMultiPointWind = {
  /** Shown in UI: median speed, max gust among samples, mean direction. */
  display: NormalizedWind;
  /** Speed used for windFitScore (median or min). */
  fitSpeedMs: number | null;
  /** Use max gust vs reference speed for gust penalty. */
  gustPenaltyGustMs: number | null;
  gustPenaltyRefSpeedMs: number | null;
  summary: {
    samples: number;
    speedMinMs: number | null;
    speedMaxMs: number | null;
    speedMedianMs: number | null;
    gustMaxMs: number | null;
    dirSpreadDeg: number | null;
  };
};

/**
 * Collapse per-sample “best hour” rows into one area wind + scoring inputs.
 * - **Representative:** fit on median speed; direction factor on mean bearing.
 * - **Conservative:** fit on min speed; use {@link multiPointDirectionMultiplier} for direction.
 */
export function aggregateMultiPointWinds(
  samples: NormalizedWind[],
  policy: MultiPointScoringPolicy,
): AggregatedMultiPointWind | null {
  if (samples.length === 0) return null;

  const speeds = samples
    .map((s) => s.windSpeedMs)
    .filter((x): x is number => x != null && Number.isFinite(x))
    .sort((a, b) => a - b);
  const gusts = samples
    .map((s) => s.gustMs)
    .filter((x): x is number => x != null && Number.isFinite(x));
  const dirs = samples.map((s) => s.windDirDeg);

  const speedMin = speeds.length ? speeds[0]! : null;
  const speedMax = speeds.length ? speeds[speeds.length - 1]! : null;
  const speedMedian = medianSorted(speeds);
  const gustMax = gusts.length ? Math.max(...gusts) : null;
  const meanDir = meanWindFromDeg(dirs);
  const validDirs = dirs.filter((d): d is number => d != null && Number.isFinite(d));
  /** Circular mean can be null if vectors cancel; fall back to any sample direction for UI + map arrows. */
  const dirForDisplay = meanDir ?? (validDirs.length ? validDirs[0]! : null);
  const dirSpread =
    meanDir != null && validDirs.length > 1
      ? maxDirectionalSpreadDeg(validDirs, meanDir)
      : null;

  const fitSpeedMs =
    policy === "conservative"
      ? speedMin
      : speedMedian ?? speedMin;
  const refSpeedForGust = speedMedian ?? speedMin;
  const visVals = samples
    .map((s) => s.visibilityM)
    .filter((x): x is number => x != null && Number.isFinite(x) && x >= 0);
  const visibilityM = visVals.length ? Math.min(...visVals) : samples[0]!.visibilityM;

  const observedAt = samples[0]!.observedAt;

  const display: NormalizedWind = {
    observedAt,
    windSpeedMs: speedMedian ?? speedMin,
    windDirDeg: dirForDisplay,
    gustMs: gustMax,
    temperatureC: samples.find((s) => s.temperatureC != null)?.temperatureC ?? null,
    visibilityM,
  };

  return {
    display,
    fitSpeedMs,
    gustPenaltyGustMs: gustMax,
    gustPenaltyRefSpeedMs: refSpeedForGust,
    summary: {
      samples: samples.length,
      speedMinMs: speedMin,
      speedMaxMs: speedMax,
      speedMedianMs: speedMedian,
      gustMaxMs: gustMax,
      dirSpreadDeg: dirSpread,
    },
  };
}

/** Direction multiplier for multi-point: min sample factor when conservative, else single factor at mean dir. */
export function multiPointDirectionMultiplier(
  policy: MultiPointScoringPolicy,
  factorsPerSample: number[],
  factorAtMean: number,
): number {
  if (factorsPerSample.length === 0) return factorAtMean;
  if (policy === "conservative") {
    return Math.min(...factorsPerSample);
  }
  return factorAtMean;
}
