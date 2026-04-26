import type { Sport } from "@/generated/prisma/client";

export type WindBands = { minMs: number; maxMs: number; idealMin: number; idealMax: number };

/**
 * Per-sport wind-speed defaults targeting an intermediate rider. Each user can
 * override these via `sportRankingPrefsSchema` (see `ranking/sportPrefs.ts`).
 *
 * Reference ranges, m/s (1 kt ~= 0.514 m/s):
 * - Water (kitesurf): typically need ~6 m/s (12 kt) just to ride out, ideal
 *   8-18 m/s (16-35 kt), upper edge ~25 m/s (50 kt).
 * - Snow (kiteski / snowkite): denser cold air and low surface friction mean
 *   ~3 m/s is enough to start, ideal 5-11 m/s, upper edge ~18 m/s.
 *
 * `idealMax` is intentionally below `maxMs`: above the ideal band the spot is
 * still rideable but overpowered, so it scores in the marginal zone rather
 * than zero.
 */
export const WIND_BANDS: Record<Sport, WindBands> = {
  kiteski: { minMs: 3, maxMs: 18, idealMin: 5, idealMax: 11 },
  kitesurf: { minMs: 6, maxMs: 25, idealMin: 8, idealMax: 18 },
};

export function windFitScore(
  sport: Sport,
  speedMs: number | null,
  bands?: WindBands | null,
): { score: number; ok: boolean } {
  const b = bands ?? WIND_BANDS[sport];
  if (speedMs == null || Number.isNaN(speedMs)) return { score: 0, ok: false };
  if (speedMs < b.minMs || speedMs > b.maxMs) return { score: 0, ok: false };
  if (speedMs >= b.idealMin && speedMs <= b.idealMax) return { score: 100, ok: true };
  const d = Math.min(speedMs - b.minMs, b.maxMs - speedMs);
  return { score: 40 + Math.min(40, d * 10), ok: true };
}

/** Base penalty 0–35; multiply by `scale` (e.g. user preference). */
export function gustPenalty(
  gustMs: number | null,
  speedMs: number | null,
  scale = 1,
): number {
  if (gustMs == null || speedMs == null || speedMs < 0.5) return 0;
  const ratio = gustMs / speedMs;
  let p = 0;
  if (ratio <= 1.4) p = 0;
  else if (ratio <= 2) p = 15;
  else p = 35;
  return p * scale;
}
