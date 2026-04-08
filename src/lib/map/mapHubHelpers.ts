import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import type { Feature, Polygon } from "geojson";

export function rankColor(score: number) {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#eab308";
  if (score > 0) return "#f97316";
  return "#94a3b8";
}

/** Meteorological: direction wind comes from (same as forecast APIs). */
export const WIND_FROM_OPTIONS: { label: string; deg: number }[] = [
  { label: "N", deg: 0 },
  { label: "NNE", deg: 22.5 },
  { label: "NE", deg: 45 },
  { label: "ENE", deg: 67.5 },
  { label: "E", deg: 90 },
  { label: "ESE", deg: 112.5 },
  { label: "SE", deg: 135 },
  { label: "SSE", deg: 157.5 },
  { label: "S", deg: 180 },
  { label: "SSW", deg: 202.5 },
  { label: "SW", deg: 225 },
  { label: "WSW", deg: 247.5 },
  { label: "W", deg: 270 },
  { label: "WNW", deg: 292.5 },
  { label: "NW", deg: 315 },
  { label: "NNW", deg: 337.5 },
];

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

export function floorToHourMs(d = new Date()): number {
  const a = new Date(d);
  a.setMinutes(0, 0, 0);
  return a.getTime();
}

/** Value for `<input type="datetime-local" />` in local timezone. */
export function toDatetimeLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function cardinalFromDeg(deg: number | null): string {
  if (deg == null || Number.isNaN(deg)) return "—";
  const d = ((deg % 360) + 360) % 360;
  const idx = Math.round(d / 22.5) % 16;
  return WIND_FROM_OPTIONS[idx]!.label;
}

/** Map / list: `4 (7) m/s ENE (66°)` — whole m/s, gust in parentheses (less “too exact” than decimals). */
export function windCompactSummary(w: {
  speedMs: number | null;
  gustMs: number | null;
  dirFromDeg: number | null;
}): string {
  const sp = w.speedMs != null ? Math.round(w.speedMs) : null;
  const gu = w.gustMs != null ? Math.round(w.gustMs) : null;
  const fromC = cardinalFromDeg(w.dirFromDeg);
  const deg = w.dirFromDeg != null ? Math.round(w.dirFromDeg) : null;
  const windPart =
    sp != null ? (gu != null ? `${sp} (${gu}) m/s` : `${sp} m/s`) : "— m/s";
  return deg != null ? `${windPart} ${fromC} (${deg}°)` : `${windPart} ${fromC}`;
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
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Arrow tail → head points **downwind**; returns meteorological wind-from (°). */
export function windFromFromDownwindArrow(
  tailLng: number,
  tailLat: number,
  headLng: number,
  headLat: number,
): number {
  const windTo = bearingDeg(tailLng, tailLat, headLng, headLat);
  return (windTo + 180) % 360;
}

/** Arrow on map points where wind blows; ranking uses wind-from. */
export function windToFromWindFrom(windFromDeg: number): number {
  return (windFromDeg + 180) % 360;
}

/** Web Mercator meters per pixel at latitude (MapLibre 512 px world width). */
export function metersPerPixelAtLatitude(latDeg: number, zoom: number): number {
  const cosLat = Math.cos((latDeg * Math.PI) / 180);
  return (40075016.686 * Math.max(cosLat, 0.02)) / (512 * Math.pow(2, zoom));
}

export function kmToScreenPx(km: number, latDeg: number, zoom: number): number {
  return (km * 1000) / metersPerPixelAtLatitude(latDeg, zoom);
}

/** ~Max sample points per practice polygon (CSS markers; cap total for DOM cost). */
export const WIND_FIELD_MAX_ARROWS = 72;
export const MAX_TOTAL_WIND_FIELD_MARKERS = 560;

export function sampleWindFieldOrigins(
  poly: GeoJSON.Polygon,
  centroidLng: number,
  centroidLat: number,
  maxPoints: number,
): [number, number][] {
  const [minLng, minLat, maxLng, maxLat] = bbox({
    type: "Feature",
    geometry: poly,
    properties: {},
  } as Feature<Polygon>);
  const w = Math.max(maxLng - minLng, 1e-6);
  const h = Math.max(maxLat - minLat, 1e-6);
  const gridN = Math.min(32, Math.max(10, Math.ceil(Math.sqrt(maxPoints * 3.2))));
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
  if (candidates.length <= maxPoints) return candidates;
  const out: [number, number][] = [];
  const denom = Math.max(1, maxPoints - 1);
  for (let k = 0; k < maxPoints; k++) {
    const idx = Math.round((k / denom) * (candidates.length - 1));
    out.push(candidates[idx]!);
  }
  return out;
}
