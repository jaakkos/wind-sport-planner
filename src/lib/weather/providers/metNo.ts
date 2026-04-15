import type { ForecastFetchOptions, WeatherProvider } from "@/lib/weather/types";

/**
 * Norwegian Meteorological Institute (Met.no) Locationforecast — used by Yr.no.
 * @see https://api.met.no/weatherapi/locationforecast/2.0/documentation
 *
 * Sending `altitude` (ground AMSL, metres) improves temperature and wind vs sea-level-only models,
 * especially in mountains. Requires a unique User-Agent (ToS).
 */
function metNoUserAgent(): string {
  const fromEnv = process.env.MET_NO_USER_AGENT?.trim();
  if (fromEnv) return fromEnv;
  return "FjellLift/1.0 (+https://github.com/jaakkos/wind-sport-planner)";
}

type MetNoInstantDetails = {
  air_temperature?: number;
  wind_from_direction?: number;
  wind_speed?: number;
  wind_speed_of_gust?: number;
};

type MetNoCompleteDoc = {
  properties?: {
    timeseries?: Array<{
      time: string;
      data?: { instant?: { details?: MetNoInstantDetails } };
    }>;
  };
};

/** Met.no coverage (Nordics / nearby); router tries Met.no before Open-Meteo when this matches. */
export function metNoPreferredRegion(lat: number, lng: number): boolean {
  return lat >= 43 && lat <= 83 && lng >= -25 && lng <= 35;
}

export const metNoProvider: WeatherProvider = {
  id: "met_no",
  /** Lowest = tried first among forecast providers (before FMI stub and Open-Meteo). */
  priority: 20,
  supports(lat, lng) {
    return metNoPreferredRegion(lat, lng);
  },
  async fetchHistoricalSnapshot() {
    return null;
  },
  async fetchForecastSeries(
    lat: number,
    lng: number,
    from: Date,
    to: Date,
    options?: ForecastFetchOptions,
  ) {
    const url = new URL("https://api.met.no/weatherapi/locationforecast/2.0/complete");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    const alt = options?.altitudeM;
    if (alt != null && Number.isFinite(alt)) {
      url.searchParams.set("altitude", String(Math.round(Math.min(8000, Math.max(-500, alt)))));
    }

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: { "User-Agent": metNoUserAgent() },
      });
    } catch {
      return null;
    }
    if (!res.ok) return null;

    let j: MetNoCompleteDoc;
    try {
      j = (await res.json()) as MetNoCompleteDoc;
    } catch {
      return null;
    }

    const series = j.properties?.timeseries;
    if (!series?.length) return null;

    const fromT = from.getTime();
    const toT = to.getTime();
    const nowMs = Date.now();
    const hourly: import("@/lib/weather/types").NormalizedWind[] = [];

    for (const step of series) {
      if (!step?.time) continue;
      const observedAt = new Date(step.time);
      const t = observedAt.getTime();
      if (t < fromT || t > toT) continue;

      const d = step.data?.instant?.details;
      if (!d) continue;

      const spd = d.wind_speed;
      const gust = d.wind_speed_of_gust;

      const isObservation = Math.abs(t - nowMs) < 90 * 60_000;

      hourly.push({
        observedAt,
        windSpeedMs: spd != null && Number.isFinite(spd) ? spd : null,
        windDirDeg:
          d.wind_from_direction != null && Number.isFinite(d.wind_from_direction)
            ? d.wind_from_direction
            : null,
        gustMs: gust != null && Number.isFinite(gust) ? gust : null,
        temperatureC:
          d.air_temperature != null && Number.isFinite(d.air_temperature)
            ? d.air_temperature
            : null,
        visibilityM: null,
        ...(isObservation ? { isObservation: true } : {}),
      });
    }

    if (!hourly.length) return null;
    return { hourly, raw: j };
  },
};
