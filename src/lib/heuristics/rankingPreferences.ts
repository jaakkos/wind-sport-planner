import type { Sport } from "@/generated/prisma/client";
import { WIND_BANDS, type WindBands } from "@/lib/heuristics/profiles";
import { z } from "zod";
import {
  multiPointForecastPrefsSchema,
  MULTI_POINT_DEFAULTS,
  type ResolvedMultiPointForecastPrefs,
} from "@/lib/heuristics/ranking/multiPointPrefs";
import {
  sportRankingPrefsSchema,
  type SportRankingPrefs,
} from "@/lib/heuristics/ranking/sportPrefs";

export const rankingPreferencesDocSchema = z
  .object({
    kiteski: sportRankingPrefsSchema.optional(),
    kitesurf: sportRankingPrefsSchema.optional(),
    multiPointForecast: multiPointForecastPrefsSchema.optional(),
  })
  .strict();

export type RankingPreferencesDoc = z.infer<typeof rankingPreferencesDocSchema>;

export function parseRankingPreferencesDoc(raw: unknown): RankingPreferencesDoc | null {
  if (raw == null) return null;
  const r = rankingPreferencesDocSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Shape served by GET /api/user/ranking-preferences when no doc is saved. */
export function defaultRankingPreferencesResponse(): {
  defaults: Record<Sport, SportRankingPrefs & { bands: WindBands }>;
  multiPointForecast: ResolvedMultiPointForecastPrefs;
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
  return { defaults, multiPointForecast: { ...MULTI_POINT_DEFAULTS } };
}
