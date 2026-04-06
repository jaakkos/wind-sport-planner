/**
 * Point elevation (m AMSL) from Open-Meteo — no API key.
 * @see https://open-meteo.com/en/docs/elevation-api
 */
export async function fetchElevationOpenMeteoM(
  lat: number,
  lng: number,
  fetchInit?: RequestInit,
): Promise<number | null> {
  const url = new URL("https://api.open-meteo.com/v1/elevation");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  const res = await fetch(url.toString(), fetchInit);
  if (!res.ok) return null;
  const data = (await res.json()) as { elevation?: number[] };
  const e = data.elevation?.[0];
  return typeof e === "number" && Number.isFinite(e) ? e : null;
}
