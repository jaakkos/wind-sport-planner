import { NextResponse } from "next/server";
import { fetchElevationOpenMeteoM } from "@/lib/weather/elevationOpenMeteo";

/**
 * Elevation (m) from Open-Meteo — no API key, fair use.
 * @see https://open-meteo.com/en/docs/elevation-api
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng") ?? url.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "coordinates out of range" }, { status: 400 });
  }

  const elevationM = await fetchElevationOpenMeteoM(lat, lng, {
    next: { revalidate: 86_400 },
  });
  if (elevationM == null) {
    return NextResponse.json({ error: "No elevation data" }, { status: 404 });
  }

  return NextResponse.json({
    lat,
    lng,
    elevationM,
    source: "open_meteo",
  });
}
