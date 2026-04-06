export type RankedPracticeAreaWind = {
  speedMs: number | null;
  gustMs: number | null;
  /** Meteorological: direction wind comes from, degrees */
  dirFromDeg: number | null;
  observedAt: string;
};

export type RankedPracticeArea = {
  areaId: string;
  name: string;
  score: number;
  centroid: { lat: number; lng: number };
  wind: RankedPracticeAreaWind | null;
  breakdown: Record<string, unknown>;
};
