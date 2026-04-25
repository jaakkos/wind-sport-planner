import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import type { Feature, Polygon } from "geojson";

/** ~Max sample points per practice polygon (CSS markers; cap total for DOM cost). */
export const WIND_FIELD_MAX_ARROWS = 72;
export const MAX_TOTAL_WIND_FIELD_MARKERS = 560;

export function closePolygonCoordinates(ring: [number, number][]): GeoJSON.Polygon | null {
  if (ring.length < 3) return null;
  const closed: [number, number][] = ring.map((p) => [...p] as [number, number]);
  const f = closed[0]!;
  const l = closed[closed.length - 1]!;
  if (l[0] !== f[0] || l[1] !== f[1]) closed.push([f[0], f[1]]);
  return { type: "Polygon", coordinates: [closed] };
}

/** Outer ring without repeated closing coordinate (for editing vertices). */
export function outerRingOpenCoords(poly: GeoJSON.Polygon): [number, number][] {
  const ring = poly.coordinates[0];
  if (!ring?.length) return [];
  const out = ring.map(([lng, lat]) => [lng, lat] as [number, number]);
  const f = out[0]!;
  const l = out[out.length - 1]!;
  if (f[0] === l[0] && f[1] === l[1]) return out.slice(0, -1);
  return out;
}

export function areaFeatureId(f: Feature): string {
  const props = (f.properties ?? {}) as { id?: string };
  return String(f.id ?? props.id ?? "");
}

/** Great-circle distance in km (for wind-arrow preview length). */
export function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing from A to B, degrees clockwise from north (0–360). */
export function bearingDeg(lngA: number, latA: number, lngB: number, latB: number): number {
  const φ1 = (latA * Math.PI) / 180;
  const φ2 = (latB * Math.PI) / 180;
  const Δλ = ((lngB - lngA) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Web Mercator meters per pixel at latitude (MapLibre 512 px world width). */
export function metersPerPixelAtLatitude(latDeg: number, zoom: number): number {
  const cosLat = Math.cos((latDeg * Math.PI) / 180);
  return (40075016.686 * Math.max(cosLat, 0.02)) / (512 * Math.pow(2, zoom));
}

export function kmToScreenPx(km: number, latDeg: number, zoom: number): number {
  return (km * 1000) / metersPerPixelAtLatitude(latDeg, zoom);
}

/** Grid resolution for {@link sampleWindFieldGridCandidates} / {@link sampleWindFieldOrigins}. */
export function windFieldGridNForDensityHint(densityHint: number): number {
  return Math.min(32, Math.max(10, Math.ceil(Math.sqrt(densityHint * 3.2))));
}

/**
 * All in-polygon nodes of a regular grid over the polygon bbox (no subsampling).
 * Falls back to centroid when the grid misses the polygon.
 */
export function sampleWindFieldGridCandidates(
  poly: GeoJSON.Polygon,
  centroidLng: number,
  centroidLat: number,
  densityHint: number,
): [number, number][] {
  const [minLng, minLat, maxLng, maxLat] = bbox({
    type: "Feature",
    geometry: poly,
    properties: {},
  } as Feature<Polygon>);
  const w = Math.max(maxLng - minLng, 1e-6);
  const h = Math.max(maxLat - minLat, 1e-6);
  const gridN = windFieldGridNForDensityHint(densityHint);
  const stepLng = w / gridN;
  const stepLat = h / gridN;
  const candidates: [number, number][] = [];
  for (let i = 0; i <= gridN; i++) {
    const la = minLat + i * stepLat;
    for (let j = 0; j <= gridN; j++) {
      const lo = minLng + j * stepLng;
      if (booleanPointInPolygon(turfPoint([lo, la]), poly)) {
        candidates.push([lo, la]);
      }
    }
  }
  if (candidates.length === 0) return [[centroidLng, centroidLat]];
  return candidates;
}

/**
 * Evenly subsample grid candidates (legacy map arrows / small pools).
 * Prefer {@link resolveWindForecastSamplePoints} for server-side forecast samples when using multiple points.
 */
export function sampleWindFieldOrigins(
  poly: GeoJSON.Polygon,
  centroidLng: number,
  centroidLat: number,
  maxPoints: number,
): [number, number][] {
  const candidates = sampleWindFieldGridCandidates(
    poly,
    centroidLng,
    centroidLat,
    maxPoints,
  );
  if (candidates.length <= maxPoints) return candidates;
  const out: [number, number][] = [];
  const denom = Math.max(1, maxPoints - 1);
  for (let k = 0; k < maxPoints; k++) {
    const idx = Math.round((k / denom) * (candidates.length - 1));
    out.push(candidates[idx]!);
  }
  return out;
}

/**
 * Farthest-point sampling in geographic space: spread picks across the polygon before
 * elevation stratification.
 */
export function selectSpatiallyDispersedLngLat(
  candidates: [number, number][],
  count: number,
  seedLng: number,
  seedLat: number,
): [number, number][] {
  if (candidates.length <= count) return [...candidates];
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const [lng, lat] = candidates[i]!;
    const d = haversineKm(seedLng, seedLat, lng, lat);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  const selected: [number, number][] = [candidates[bestI]!];
  const used = new Set<number>([bestI]);

  while (selected.length < count) {
    let pick = -1;
    let bestScore = -1;
    for (let j = 0; j < candidates.length; j++) {
      if (used.has(j)) continue;
      const [lng, lat] = candidates[j]!;
      let minD = Infinity;
      for (const [slng, slat] of selected) {
        minD = Math.min(minD, haversineKm(slng, slat, lng, lat));
      }
      if (minD > bestScore || (minD === bestScore && (pick < 0 || j < pick))) {
        bestScore = minD;
        pick = j;
      }
    }
    if (pick < 0) break;
    used.add(pick);
    selected.push(candidates[pick]!);
  }
  return selected;
}

/** Pick k locations with roughly uniform spacing along the elevation rank (high → low). */
export function stratifyLngLatByElevationRank(
  pts: ReadonlyArray<{ lng: number; lat: number; elevM: number | null }>,
  k: number,
): [number, number][] {
  if (pts.length === 0) return [];
  const sorted = [...pts].sort((a, b) => {
    const fa = a.elevM != null && Number.isFinite(a.elevM);
    const fb = b.elevM != null && Number.isFinite(b.elevM);
    if (fa && fb) {
      const d = b.elevM! - a.elevM!;
      if (d !== 0) return d;
    } else if (fa && !fb) return -1;
    else if (!fa && fb) return 1;
    if (a.lng !== b.lng) return a.lng - b.lng;
    return a.lat - b.lat;
  });
  if (k >= sorted.length) return sorted.map((p) => [p.lng, p.lat]);
  const out: [number, number][] = [];
  const denom = Math.max(1, k - 1);
  for (let i = 0; i < k; i++) {
    const idx = Math.round((i / denom) * (sorted.length - 1));
    out.push([sorted[idx]!.lng, sorted[idx]!.lat]);
  }
  return out;
}
