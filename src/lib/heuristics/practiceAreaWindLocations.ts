import type { Polygon } from "geojson";
import { sampleWindFieldGridCandidates } from "@/lib/map/mapHubHelpers";
import {
  elevationRangeInsidePolygonM,
  effectiveSamplePointCount,
} from "@/lib/heuristics/multiPointForecast";
import type { MultiPointForecastMode } from "@/lib/heuristics/rankingPreferences";
import {
  resolveWindForecastSamplePoints,
  windSamplePoolDensityHint,
} from "@/lib/heuristics/windSamplePoints";

/**
 * Single pipeline for practice-area multi-point geometry: same grid pool, relief probes,
 * effective k, and forecast lng/lat as ranking and area forecast samples.
 */
export async function resolvePracticeAreaWindSampleLocations(args: {
  poly: Polygon | null;
  centroidLng: number;
  centroidLat: number;
  mode: MultiPointForecastMode;
  maxSamples: number;
  bboxDiagonalKm: number;
  elevationFor: (lat: number, lng: number) => Promise<number | null>;
}): Promise<{
  candidatePoolLength: number;
  elevRangeM: number;
  k: number;
  points: [number, number][];
}> {
  const {
    poly,
    centroidLng,
    centroidLat,
    mode,
    maxSamples,
    bboxDiagonalKm,
    elevationFor,
  } = args;

  const poolDensityHint = windSamplePoolDensityHint(maxSamples);
  const candidatePool = poly
    ? sampleWindFieldGridCandidates(poly, centroidLng, centroidLat, poolDensityHint)
    : [[centroidLng, centroidLat] as [number, number]];

  let elevRangeM = 0;
  if (poly && mode !== "off") {
    elevRangeM = await elevationRangeInsidePolygonM(
      poly,
      centroidLng,
      centroidLat,
      elevationFor,
      { maxSamplesSetting: maxSamples },
    );
  }

  const k = effectiveSamplePointCount({
    mode,
    maxSamples,
    bboxDiagonalKm,
    elevRangeM,
    availablePoints: candidatePool.length,
  });

  const points: [number, number][] =
    k <= 1 || !poly
      ? [[centroidLng, centroidLat]]
      : await resolveWindForecastSamplePoints({
          poly,
          centroidLng,
          centroidLat,
          k,
          maxSamplesSetting: maxSamples,
          elevationFor,
        });

  return {
    candidatePoolLength: candidatePool.length,
    elevRangeM,
    k,
    points,
  };
}
