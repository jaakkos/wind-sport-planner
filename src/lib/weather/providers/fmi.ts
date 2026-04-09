import type { WeatherProvider } from "@/lib/weather/types";

/** Approximate Finland mainland bbox (WGS84) */
const FINLAND = { minLat: 59.5, maxLat: 70.5, minLng: 19, maxLng: 31.6 };

function inFinland(lat: number, lng: number) {
  return lat >= FINLAND.minLat && lat <= FINLAND.maxLat && lng >= FINLAND.minLng && lng <= FINLAND.maxLng;
}

/**
 * FMI WFS integration is XML-heavy; v1 adapter defers to Open-Meteo in the router.
 * When implemented, return parsed wind here and set id to `fmi_wfs`.
 */
export const fmiProviderStub: WeatherProvider = {
  id: "fmi_wfs",
  /** After Met.no (20); still before Open-Meteo (100). Stub returns null until implemented. */
  priority: 35,
  supports(lat, lng) {
    return inFinland(lat, lng);
  },
  async fetchHistoricalSnapshot() {
    return null;
  },
  async fetchForecastSeries(_lat, _lng, _from, _to, _options) {
    return null;
  },
};
