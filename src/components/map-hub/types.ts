import type { FeatureCollection } from "geojson";

export type Bundle = {
  activeSport: string;
  practiceAreas: FeatureCollection;
};

export type ExperienceRow = {
  id: string;
  practiceAreaId: string;
  practiceAreaName: string;
  sport: string;
  occurredAt: string;
  sessionSuitability: string;
  windDirDeg: number | null;
  windSpeedMs: number | null;
  weatherProviderId: string | null;
  weatherObservedAt: string | null;
};

export type SportRankingFormState = {
  minWindMs: number;
  maxWindMs: number;
  idealMinMs: number;
  idealMaxMs: number;
  windFitScale: number;
  gustPenaltyScale: number;
  directionEmphasis: number;
};

export type MultiPointForecastFormState = {
  mode: "off" | "auto" | "on";
  maxSamples: number;
  scoringPolicy: "representative" | "conservative";
};

export type RankingPrefsApiResponse = {
  doc: {
    kiteski?: Partial<SportRankingFormState>;
    kitesurf?: Partial<SportRankingFormState>;
    multiPointForecast?: Partial<MultiPointForecastFormState>;
  } | null;
  defaults: Record<
    "kiteski" | "kitesurf",
    SportRankingFormState & {
      bands: { minMs: number; maxMs: number; idealMin: number; idealMax: number };
    }
  >;
  multiPointForecast: MultiPointForecastFormState;
};

export function sportFormFromDefaults(
  sport: "kiteski" | "kitesurf",
  doc: RankingPrefsApiResponse["doc"],
  defaults: RankingPrefsApiResponse["defaults"],
): SportRankingFormState {
  const d = defaults[sport];
  const p = doc?.[sport];
  return {
    minWindMs: p?.minWindMs ?? d.minWindMs,
    maxWindMs: p?.maxWindMs ?? d.maxWindMs,
    idealMinMs: p?.idealMinMs ?? d.idealMinMs,
    idealMaxMs: p?.idealMaxMs ?? d.idealMaxMs,
    windFitScale: p?.windFitScale ?? d.windFitScale,
    gustPenaltyScale: p?.gustPenaltyScale ?? d.gustPenaltyScale,
    directionEmphasis: p?.directionEmphasis ?? d.directionEmphasis,
  };
}

export type ClickTerrain = {
  lat: number;
  lng: number;
  elevationM: number | null;
  loading: boolean;
  error?: string;
};
