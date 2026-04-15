export type NormalizedWind = {
  windSpeedMs: number | null;
  windDirDeg: number | null;
  gustMs: number | null;
  temperatureC: number | null;
  /** Horizontal visibility (m) from model; low values ≈ fog, low cloud, haze. */
  visibilityM: number | null;
  observedAt: Date;
  /**
   * True when this data point originates from an observation-like product
   * (e.g. Open-Meteo `current` block or Met.no's first analysis step)
   * rather than a pure forecast hour.
   */
  isObservation?: boolean;
};

export type WeatherProviderId = string;

/** Options for forecast fetches (terrain-aware providers). */
export type ForecastFetchOptions = {
  /** Ground elevation (m AMSL) at the query point — used by Met.no/Yr for temperature/wind correction. */
  altitudeM?: number | null;
};

export interface WeatherProvider {
  readonly id: WeatherProviderId;
  /** Lower = earlier in chain */
  readonly priority: number;
  supports(lat: number, lng: number, at: Date): boolean;
  fetchHistoricalSnapshot(
    lat: number,
    lng: number,
    at: Date,
  ): Promise<{ data: NormalizedWind; raw: unknown } | null>;
  fetchForecastSeries(
    lat: number,
    lng: number,
    from: Date,
    to: Date,
    options?: ForecastFetchOptions,
  ): Promise<{ hourly: NormalizedWind[]; raw: unknown } | null>;
}
