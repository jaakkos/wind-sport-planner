/**
 * Yr.no (NRK / Norwegian Meteorological Institute) forecast URLs for a geographic point.
 * @see https://developer.yr.no/
 */
function coordPair(lat: number, lng: number): { latStr: string; lngStr: string } {
  return { latStr: lat.toFixed(3), lngStr: lng.toFixed(3) };
}

/** Hour-by-hour table — closest to Finnish “pisteennuste”. */
export function yrNoHourlyTableUrlEn(lat: number, lng: number): string {
  const { latStr, lngStr } = coordPair(lat, lng);
  return `https://www.yr.no/en/forecast/hourly-table/${latStr},%20${lngStr}`;
}

/** Long-term daily overview (same coordinates). */
export function yrNoDailyTableUrlEn(lat: number, lng: number): string {
  const { latStr, lngStr } = coordPair(lat, lng);
  return `https://www.yr.no/en/forecast/daily-table/${latStr},%20${lngStr}`;
}
