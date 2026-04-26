/**
 * Meteorological convention: degrees clockwise from N (0–360), direction wind comes **from**.
 */

type WindSector = readonly [number, number];

/** Smallest difference between two bearings, in [0, 180]. */
export function angularDiffDeg(a: number, b: number): number {
  const x = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(x, 360 - x);
}

/**
 * Expand a preferred "wind from" bearing into one or two non-wrapping [lo, hi] ranges in [0, 360).
 */
export function sectorsFromCenter(centerDeg: number, halfWidthDeg: number): WindSector[] {
  const c = ((centerDeg % 360) + 360) % 360;
  const w = Math.min(Math.max(halfWidthDeg, 1), 180);
  const lo = c - w;
  const hi = c + w;
  if (lo >= 0 && hi <= 360) return [[lo, hi]];
  if (lo < 0) {
    const out: WindSector[] = [[360 + lo, 360]];
    if (hi > 0) out.push([0, hi]);
    return out;
  }
  // hi > 360
  return [
    [lo, 360],
    [0, hi - 360],
  ];
}

export function windFromInSectors(windDirDeg: number, sectors: WindSector[]): boolean {
  const d = ((windDirDeg % 360) + 360) % 360;
  for (const [lo, hi] of sectors) {
    const a = ((lo % 360) + 360) % 360;
    const b = ((hi % 360) + 360) % 360;
    if (a <= b) {
      if (d >= a && d <= b) return true;
    } else {
      if (d >= a || d <= b) return true;
    }
  }
  return false;
}

function parseSectors(raw: unknown): WindSector[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: WindSector[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const a = Number(row[0]);
    const b = Number(row[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    out.push([a, b]);
  }
  return out;
}

function normDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

function clampHalfWidthDeg(v: number): number {
  return Math.min(90, Math.max(5, v));
}

/**
 * Score multiplier (plateau then falloff) for how close forecast wind-from is to a target bearing.
 * Full credit for angular diff ≤ `halfWidthDeg`; linear falloff to `floor` at 180°.
 */
export function directionFactorFromOptimalDiff(
  diffDeg: number,
  halfWidthDeg: number,
  floor = 0.12,
): number {
  const w = clampHalfWidthDeg(halfWidthDeg);
  const d = Math.min(Math.max(diffDeg, 0), 180);
  if (d <= w) return 1;
  const span = 180 - w;
  if (span <= 0) return floor;
  const t = (d - w) / span;
  return Math.max(floor, floor + (1 - floor) * (1 - t));
}

/**
 * Multiplier for ranking (typically 0.12–1.22): forecast direction vs area sectors and optimal bearings.
 * - Sectors: outside → `outsideSectorFactor`; inside → 1, or bonus when area optimal is set (decays over `optimalMatchHalfWidthDeg`)
 * - No sectors: plateau ± `optimalMatchHalfWidthDeg` around **area** optimal, then falloff (no area optimal → 1)
 */
export function directionRankFactor(args: {
  forecastWindFromDeg: number | null;
  areaWindSectorsJson: unknown;
  /** Per-area preferred wind-from; boosts score when set (inside sectors or alone). */
  areaOptimalWindFromDeg?: number | null;
  /** ± half-width (degrees) around optimal for full score / peak bonus; default 30. */
  optimalMatchHalfWidthDeg?: number | null;
  outsideSectorFactor?: number;
  /** Max multiplier when forecast matches area optimal inside sectors (default 1.2). */
  sectorOptimalBonusCap?: number;
}): number {
  const outside = args.outsideSectorFactor ?? 0.22;
  const bonusCap = args.sectorOptimalBonusCap ?? 1.2;
  const halfW =
    args.optimalMatchHalfWidthDeg != null && Number.isFinite(args.optimalMatchHalfWidthDeg)
      ? clampHalfWidthDeg(args.optimalMatchHalfWidthDeg)
      : 30;
  const sectors = parseSectors(args.areaWindSectorsJson);
  const fc = args.forecastWindFromDeg;
  const areaOpt =
    args.areaOptimalWindFromDeg != null && Number.isFinite(args.areaOptimalWindFromDeg)
      ? normDeg(args.areaOptimalWindFromDeg)
      : null;

  if (sectors.length > 0) {
    if (fc == null || Number.isNaN(fc)) return 0.55;
    if (!windFromInSectors(fc, sectors)) return outside;
    if (areaOpt == null) return 1;
    const diff = angularDiffDeg(areaOpt, fc);
    const ramp = Math.max(halfW, 8);
    return 1 + (bonusCap - 1) * Math.max(0, 1 - Math.min(1, diff / ramp));
  }

  if (areaOpt == null) return 1;
  if (fc == null || Number.isNaN(fc)) return 0.55;

  const diff = angularDiffDeg(areaOpt, fc);
  return directionFactorFromOptimalDiff(diff, halfW);
}

/** Haversine destination: start (lng, lat), bearing deg clockwise from N, distance km → [lng, lat] */
export function destinationLngLat(
  lng: number,
  lat: number,
  bearingDeg: number,
  distanceKm: number,
): [number, number] {
  const R = 6371;
  const δ = distanceKm / R;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);
  return [((λ2 * 180) / Math.PI + 540) % 360 - 180, (φ2 * 180) / Math.PI];
}
