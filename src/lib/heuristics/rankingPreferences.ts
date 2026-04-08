import type { Sport } from "@/generated/prisma/client";
import { WIND_BANDS, type WindBands } from "@/lib/heuristics/profiles";
import { z } from "zod";

/** One sport’s overrides (all fields optional). */
export const sportRankingPrefsSchema = z.object({
  minWindMs: z.number().min(0.5).max(60).optional(),
  maxWindMs: z.number().min(0.5).max(60).optional(),
  idealMinMs: z.number().min(0.5).max(60).optional(),
  idealMaxMs: z.number().min(0.5).max(60).optional(),
  /** Multiplier on wind-speed fit score (0.25–2). Default 1. */
  windFitScale: z.number().min(0.25).max(2).optional(),
  /** Multiplier on gust penalty (0–2). 0 ignores gusts; default 1. */
  gustPenaltyScale: z.number().min(0).max(2).optional(),
  /** How strongly direction affects score (0–1). 0 = ignore direction; 1 = full effect. */
  directionEmphasis: z.number().min(0).max(1).optional(),
});

export const rankingPreferencesDocSchema = z
  .object({
    kiteski: sportRankingPrefsSchema.optional(),
    kitesurf: sportRankingPrefsSchema.optional(),
  })
  .strict();

export type SportRankingPrefs = z.infer<typeof sportRankingPrefsSchema>;
export type RankingPreferencesDoc = z.infer<typeof rankingPreferencesDocSchema>;

export type ResolvedSportRankingOptions = {
  bands: WindBands;
  windFitScale: number;
  gustPenaltyScale: number;
  directionEmphasis: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Merge saved prefs with defaults into bands safe for scoring. */
export function resolveBands(sport: Sport, prefs: SportRankingPrefs | undefined): WindBands {
  const b = WIND_BANDS[sport];
  if (!prefs) return b;
  let minMs = prefs.minWindMs ?? b.minMs;
  let maxMs = prefs.maxWindMs ?? b.maxMs;
  if (!(minMs < maxMs)) {
    minMs = b.minMs;
    maxMs = b.maxMs;
  }
  let idealMin = prefs.idealMinMs ?? b.idealMin;
  let idealMax = prefs.idealMaxMs ?? b.idealMax;
  idealMin = clamp(idealMin, minMs, maxMs);
  idealMax = clamp(idealMax, minMs, maxMs);
  if (idealMin > idealMax) {
    idealMin = b.idealMin;
    idealMax = b.idealMax;
    idealMin = clamp(idealMin, minMs, maxMs);
    idealMax = clamp(idealMax, minMs, maxMs);
  }
  return { minMs, maxMs, idealMin, idealMax };
}

export function resolveSportRankingOptions(
  sport: Sport,
  doc: RankingPreferencesDoc | null | undefined,
): ResolvedSportRankingOptions {
  const prefs = doc?.[sport];
  return {
    bands: resolveBands(sport, prefs),
    windFitScale: prefs?.windFitScale ?? 1,
    gustPenaltyScale: prefs?.gustPenaltyScale ?? 1,
    directionEmphasis: prefs?.directionEmphasis ?? 1,
  };
}

export function parseRankingPreferencesDoc(raw: unknown): RankingPreferencesDoc | null {
  if (raw == null) return null;
  const r = rankingPreferencesDocSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export function defaultRankingPreferencesResponse(): {
  defaults: Record<Sport, SportRankingPrefs & { bands: WindBands }>;
} {
  const sports: Sport[] = ["kiteski", "kitesurf"];
  const defaults = {} as Record<Sport, SportRankingPrefs & { bands: WindBands }>;
  for (const s of sports) {
    const b = WIND_BANDS[s];
    defaults[s] = {
      bands: { ...b },
      minWindMs: b.minMs,
      maxWindMs: b.maxMs,
      idealMinMs: b.idealMin,
      idealMaxMs: b.idealMax,
      windFitScale: 1,
      gustPenaltyScale: 1,
      directionEmphasis: 1,
    };
  }
  return { defaults };
}
