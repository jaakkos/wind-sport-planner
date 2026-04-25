import type { RankedPracticeAreaWind } from "@/lib/heuristics/rankAreaTypes";
import { bearingDeg } from "@/lib/map/polygons";

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

/** Second line when multi-spot forecast was used inside the polygon. */
export function windMultiPointSubtitle(w: RankedPracticeAreaWind | null): string | null {
  const mp = w?.multiPoint;
  if (!mp || mp.samples < 2) return null;
  const bits: string[] = [];
  if (
    mp.speedMinMs != null &&
    mp.speedMaxMs != null &&
    Math.round(mp.speedMinMs) !== Math.round(mp.speedMaxMs)
  ) {
    bits.push(`${Math.round(mp.speedMinMs)}–${Math.round(mp.speedMaxMs)} m/s in area`);
  }
  bits.push(`${mp.samples} spots`);
  if (mp.dirSpreadDeg != null && mp.dirSpreadDeg >= 12) {
    bits.push(`dir ±${Math.round(mp.dirSpreadDeg)}°`);
  }
  return bits.join(" · ");
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

/**
 * Places the terrain popover near the map click (pixel coords from MapLibre) and clamps it
 * so the card stays inside the viewport.
 */
export function terrainPopoverScreenPosition(
  anchorX: number,
  anchorY: number,
  vw: number,
  vh: number,
): { left: number; top: number } {
  const gap = 8;
  const cardW = 320;
  const cardH = 280;
  const maxLeft = Math.max(gap, vw - cardW - gap);
  const maxTop = Math.max(gap, vh - cardH - gap);
  return {
    left: Math.min(Math.max(gap, anchorX + gap), maxLeft),
    top: Math.min(Math.max(gap, anchorY + gap), maxTop),
  };
}
