import type { Sport } from "@/generated/prisma";

export type WindBands = { minMs: number; maxMs: number; idealMin: number; idealMax: number };

export const WIND_BANDS: Record<Sport, WindBands> = {
  kiteski: { minMs: 2, maxMs: 18, idealMin: 4, idealMax: 12 },
  kitesurf: { minMs: 3, maxMs: 25, idealMin: 6, idealMax: 16 },
};

export function windFitScore(sport: Sport, speedMs: number | null): { score: number; ok: boolean } {
  const b = WIND_BANDS[sport];
  if (speedMs == null || Number.isNaN(speedMs)) return { score: 0, ok: false };
  if (speedMs < b.minMs || speedMs > b.maxMs) return { score: 0, ok: false };
  if (speedMs >= b.idealMin && speedMs <= b.idealMax) return { score: 100, ok: true };
  const d = Math.min(speedMs - b.minMs, b.maxMs - speedMs);
  return { score: 40 + Math.min(40, d * 10), ok: true };
}

export function gustPenalty(gustMs: number | null, speedMs: number | null): number {
  if (gustMs == null || speedMs == null || speedMs < 0.5) return 0;
  const ratio = gustMs / speedMs;
  if (ratio <= 1.4) return 0;
  if (ratio <= 2) return 15;
  return 35;
}
