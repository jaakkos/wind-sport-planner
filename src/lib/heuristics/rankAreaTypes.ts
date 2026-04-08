/** Present when forecast used several locations inside the practice polygon. */
export type RankedPracticeAreaWindMultiPoint = {
  samples: number;
  speedMinMs: number | null;
  speedMaxMs: number | null;
  speedMedianMs: number | null;
  gustMaxMs: number | null;
  /** Max angular deviation from mean direction across samples (°). */
  dirSpreadDeg: number | null;
};

export type RankedPracticeAreaWind = {
  speedMs: number | null;
  gustMs: number | null;
  /** Meteorological: direction wind comes from, degrees */
  dirFromDeg: number | null;
  /** Horizontal visibility (m) when the forecast API provides it. */
  visibilityM: number | null;
  observedAt: string;
  /** Multi-location forecast summary (median/mean shown in main fields). */
  multiPoint?: RankedPracticeAreaWindMultiPoint;
};

export type RankedPracticeArea = {
  areaId: string;
  name: string;
  score: number;
  centroid: { lat: number; lng: number };
  wind: RankedPracticeAreaWind | null;
  breakdown: Record<string, unknown>;
};
