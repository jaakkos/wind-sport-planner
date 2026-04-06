import { NextResponse } from "next/server";

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

  const om = new URL("https://api.open-meteo.com/v1/elevation");
  om.searchParams.set("latitude", String(lat));
  om.searchParams.set("longitude", String(lng));

  const res = await fetch(om.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) {
    return NextResponse.json({ error: "Elevation provider error" }, { status: 502 });
  }

  const data = (await res.json()) as { elevation?: number[] };
  const elevationM = data.elevation?.[0];
  if (typeof elevationM !== "number" || Number.isNaN(elevationM)) {
    return NextResponse.json({ error: "No elevation data" }, { status: 404 });
  }

  return NextResponse.json({
    lat,
    lng,
    elevationM,
    source: "open_meteo",
  });
}
