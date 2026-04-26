import { z } from "zod";

export const multiPointForecastPrefsSchema = z
  .object({
    /** `off` = centroid only. `auto` = multi when area is large or relief is high. `on` = always sample up to maxSamples. */
    mode: z.enum(["off", "auto", "on"]).optional(),
    /** Forecast locations per area (clamped 3–9). */
    maxSamples: z.number().int().min(3).max(9).optional(),
    /** How multi-sample wind collapses into score (logged-in only; guests use conservative + smaller cap). */
    scoringPolicy: z.enum(["representative", "conservative"]).optional(),
  })
  .strict();

type MultiPointForecastPrefs = z.infer<typeof multiPointForecastPrefsSchema>;
export type MultiPointForecastMode = NonNullable<MultiPointForecastPrefs["mode"]>;
export type MultiPointScoringPolicy = NonNullable<MultiPointForecastPrefs["scoringPolicy"]>;

export type ResolvedMultiPointForecastPrefs = {
  mode: MultiPointForecastMode;
  maxSamples: number;
  scoringPolicy: MultiPointScoringPolicy;
};

export const MULTI_POINT_DEFAULTS: ResolvedMultiPointForecastPrefs = {
  mode: "auto",
  maxSamples: 5,
  scoringPolicy: "conservative",
};

/** Guests: tighter API budget; always auto triggers, conservative scoring. */
const MULTI_POINT_GUEST: ResolvedMultiPointForecastPrefs = {
  mode: "auto",
  maxSamples: 4,
  scoringPolicy: "conservative",
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function resolveMultiPointForecastPrefs(
  prefs: MultiPointForecastPrefs | null | undefined,
  isAuthed: boolean,
): ResolvedMultiPointForecastPrefs {
  if (!isAuthed) return { ...MULTI_POINT_GUEST };
  return {
    mode: prefs?.mode ?? MULTI_POINT_DEFAULTS.mode,
    maxSamples: clamp(
      prefs?.maxSamples ?? MULTI_POINT_DEFAULTS.maxSamples,
      3,
      9,
    ),
    scoringPolicy: prefs?.scoringPolicy ?? MULTI_POINT_DEFAULTS.scoringPolicy,
  };
}
