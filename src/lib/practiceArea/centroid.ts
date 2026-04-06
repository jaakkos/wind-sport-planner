import centroid from "@turf/centroid";
import type { Feature, Polygon } from "geojson";

export function centroidLngLatFromGeojson(geojson: unknown): { lng: number; lat: number } | null {
  try {
    const f = {
      type: "Feature",
      geometry: geojson as Polygon,
      properties: {},
    } as Feature<Polygon>;
    const c = centroid(f);
    const [lng, lat] = c.geometry.coordinates;
    return { lng, lat };
  } catch {
    return null;
  }
}
