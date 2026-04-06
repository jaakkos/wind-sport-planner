import type { ForecastFetchOptions, WeatherProvider } from "@/lib/weather/types";
import { fmiProviderStub } from "@/lib/weather/providers/fmi";
import { metNoProvider } from "@/lib/weather/providers/metNo";
import { openMeteoProvider } from "@/lib/weather/providers/openMeteo";

const providers: WeatherProvider[] = [
  fmiProviderStub,
  metNoProvider,
  openMeteoProvider,
].sort((a, b) => a.priority - b.priority);

export function providersForPoint(lat: number, lng: number, at: Date) {
  return providers.filter((p) => p.supports(lat, lng, at));
}

export async function fetchHistoricalWithRouter(
  lat: number,
  lng: number,
  at: Date,
): Promise<{ providerId: string; data: import("@/lib/weather/types").NormalizedWind; raw: unknown } | null> {
  const chain = providersForPoint(lat, lng, at);
  for (const p of chain) {
    const r = await p.fetchHistoricalSnapshot(lat, lng, at);
    if (r) {
      return { providerId: p.id, data: r.data, raw: r.raw };
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
    const r = await p.fetchForecastSeries(lat, lng, from, to, options);
    if (r?.hourly?.length) {
      return { providerId: p.id, hourly: r.hourly, raw: r.raw };
    }
  }
  return null;
}
