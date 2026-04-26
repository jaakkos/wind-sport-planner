import type { ForecastFetchOptions, WeatherProvider } from "@/lib/weather/types";
import { metNoProvider } from "@/lib/weather/providers/metNo";
import { openMeteoProvider } from "@/lib/weather/providers/openMeteo";

/**
 * Ascending `priority` → try order: **Met.no (20) → Open-Meteo (100)**.
 * Outside Met.no's region only Open-Meteo applies.
 */
const providers: WeatherProvider[] = [metNoProvider, openMeteoProvider].sort(
  (a, b) => a.priority - b.priority,
);

function providersForPoint(lat: number, lng: number, at: Date) {
  return providers.filter((p) => p.supports(lat, lng, at));
}

export async function fetchHistoricalWithRouter(
  lat: number,
  lng: number,
  at: Date,
): Promise<{ providerId: string; data: import("@/lib/weather/types").NormalizedWind; raw: unknown } | null> {
  const chain = providersForPoint(lat, lng, at);
  for (const p of chain) {
    try {
      const r = await p.fetchHistoricalSnapshot(lat, lng, at);
      if (r) {
        return { providerId: p.id, data: r.data, raw: r.raw };
      }
    } catch {
      /* provider bug or unexpected parse — try next */
    }
  }
  return null;
}

export async function fetchForecastWithRouter(
  lat: number,
  lng: number,
  from: Date,
  to: Date,
  options?: ForecastFetchOptions,
): Promise<{ providerId: string; hourly: import("@/lib/weather/types").NormalizedWind[]; raw: unknown } | null> {
  const chain = providersForPoint(lat, lng, from);
  for (const p of chain) {
    try {
      const r = await p.fetchForecastSeries(lat, lng, from, to, options);
      if (r?.hourly?.length) {
        return { providerId: p.id, hourly: r.hourly, raw: r.raw };
      }
    } catch {
      /* network / parse — try next provider */
    }
  }
  return null;
}
