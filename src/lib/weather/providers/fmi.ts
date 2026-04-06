import type { WeatherProvider } from "@/lib/weather/types";

/**
 * WGS84 bbox: mainland Norway, Sweden, and Finland (excludes Svalbard and other
 * high-Arctic territories). Used so the FMI-first chain applies across Fennoscandia;
 * the stub still defers data to Open-Meteo until WFS is implemented.
 */
const NORDIC_MAINLAND = {
  minLat: 55.25,
  maxLat: 71.35,
  minLng: 4.5,
  maxLng: 31.65,
};

function inNordicMainland(lat: number, lng: number) {
  return (
    lat >= NORDIC_MAINLAND.minLat &&
    lat <= NORDIC_MAINLAND.maxLat &&
    lng >= NORDIC_MAINLAND.minLng &&
    lng <= NORDIC_MAINLAND.maxLng
  );
}

/**
 * FMI WFS integration is XML-heavy; v1 adapter defers to Open-Meteo in the router.
 * When implemented, return parsed wind here and set id to `fmi_wfs`.
 */
export const fmiProviderStub: WeatherProvider = {
  id: "fmi_wfs",
  priority: 10,
  supports(lat, lng) {
    return inNordicMainland(lat, lng);
  },
  async fetchHistoricalSnapshot() {
    return null;
  },
  async fetchForecastSeries() {
    return null;
  },
};
