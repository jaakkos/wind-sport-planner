export type NormalizedWind = {
  windSpeedMs: number | null;
  windDirDeg: number | null;
  gustMs: number | null;
  temperatureC: number | null;
  observedAt: Date;
};

export type WeatherProviderId = string;

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
  ): Promise<{ hourly: NormalizedWind[]; raw: unknown } | null>;
}
