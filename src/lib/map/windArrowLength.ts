import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import type { Feature, Polygon } from "geojson";
import { destinationLngLat } from "@/lib/heuristics/windDirection";

function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
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

/** Max distance from centroid to any outer-ring vertex (cheap proxy for polygon span). */
export function maxVertexRadiusKm(
  poly: GeoJSON.Polygon,
  centroidLng: number,
  centroidLat: number,
): number {
  const ring = poly.coordinates[0];
  if (!ring?.length) return 0.5;
  let maxD = 0;
  for (const c of ring) {
    const [lng, lat] = c;
    maxD = Math.max(maxD, haversineKm(centroidLng, centroidLat, lng, lat));
  }
  return Math.max(maxD, 0.05);
}

/**
 * Arrow length (km) along downwind bearing so the tip stays inside the polygon.
 * Caps preferred length by polygon size, then shortens until tip is inside (or floor reached).
 */
export function clampArrowLengthInsidePolygon(
  poly: GeoJSON.Polygon,
  centroidLng: number,
  centroidLat: number,
  windToDeg: number,
  preferredLenKm: number,
): number {
  const polyFeat = { type: "Feature", geometry: poly, properties: {} } as Feature<Polygon>;
  const maxR = maxVertexRadiusKm(poly, centroidLng, centroidLat);
  const startCap = Math.min(preferredLenKm, maxR * 0.48);
  const minLen = Math.min(Math.max(maxR * 0.06, 0.03), startCap);

  let len = Math.max(startCap, minLen);
  for (let i = 0; i < 22; i++) {
    const tip = destinationLngLat(centroidLng, centroidLat, windToDeg, len);
    const inside = booleanPointInPolygon(turfPoint(tip), polyFeat, { ignoreBoundary: false });
    if (inside) return len;
    len *= 0.88;
    if (len < minLen) return minLen;
  }
  return minLen;
}
