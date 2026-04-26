import type { Feature, FeatureCollection } from "geojson";

import { bearingDeg, haversineKm, kmToScreenPx } from "@/lib/map/polygons";

/**
 * Pure builders for the transient overlays that visualise in-progress map
 * interactions: drawing a polygon and picking the optimal wind direction.
 *
 * They are split into "build the geometry / shape" functions and "convert to
 * a screen-space length" helpers so the caller can memoise and unit-test each
 * step independently of the React tree.
 */

type WindPickPreview =
  | { kind: "dot"; lng: number; lat: number }
  | {
      kind: "arrow";
      tailLng: number;
      tailLat: number;
      windToDeg: number;
      distKm: number;
    };

/** Below this distance the user has not committed a direction yet, so we just
 * show a dot at the click point instead of a (degenerate) arrow. */
const WIND_PICK_DOT_RADIUS_KM = 0.004;

/** Pixel clamps for the saved optimal-wind marker drawn on the selected area. */
const OPTIMAL_WIND_MIN_PX = 28;
const OPTIMAL_WIND_MAX_PX = 160;

/** Pixel clamps for the in-progress "pick wind" arrow rubber-band. */
const WIND_PICK_MIN_PX = 12;
const WIND_PICK_MAX_PX = 420;

/**
 * Wind-direction picker preview. Returns null when the picker is idle, a dot
 * for clicks below the minimum-direction radius, or a tail+heading+distance
 * descriptor once the cursor has moved enough to imply a heading.
 */
export function buildWindPickPreview(args: {
  mapMode: "browse" | "draw" | "pickWind";
  windPickStart: [number, number] | null;
  windPickHover: [number, number] | null;
}): WindPickPreview | null {
  const { mapMode, windPickStart, windPickHover } = args;
  if (mapMode !== "pickWind" || windPickStart == null) return null;
  const [sx, sy] = windPickStart;
  const hx = windPickHover?.[0] ?? sx;
  const hy = windPickHover?.[1] ?? sy;
  const distKm = haversineKm(sx, sy, hx, hy);
  if (distKm < WIND_PICK_DOT_RADIUS_KM) {
    return { kind: "dot", lng: sx, lat: sy };
  }
  const windTo = bearingDeg(sx, sy, hx, hy);
  return { kind: "arrow", tailLng: sx, tailLat: sy, windToDeg: windTo, distKm };
}

/**
 * Convert the saved optimal-wind marker length to a clamped pixel length
 * suitable for an absolutely-positioned CSS marker.
 */
export function optimalWindMarkerLengthPx(
  marker: { lat: number; lenKm: number } | null,
  mapZoom: number,
): number {
  if (!marker) return 0;
  const px = kmToScreenPx(marker.lenKm, marker.lat, mapZoom);
  return Math.min(OPTIMAL_WIND_MAX_PX, Math.max(OPTIMAL_WIND_MIN_PX, px));
}

/**
 * Convert the wind-picker rubber-band length to a clamped pixel length. Zero
 * when the preview is null or still in the "dot" stage.
 */
export function windPickArrowLengthPx(
  preview: WindPickPreview | null,
  mapZoom: number,
): number {
  if (!preview || preview.kind !== "arrow") return 0;
  const px = kmToScreenPx(preview.distKm, preview.tailLat, mapZoom);
  return Math.min(WIND_PICK_MAX_PX, Math.max(WIND_PICK_MIN_PX, px));
}

/**
 * GeoJSON for the polygon-being-drawn overlay: a MultiPoint at the vertices,
 * a LineString tracing the path, and a closing LineString from the last
 * vertex back to the first. Returns null when there is nothing to draw.
 */
export function buildDrawPreview(
  drawRing: ReadonlyArray<[number, number]>,
): FeatureCollection | null {
  if (drawRing.length === 0) return null;
  const features: Feature[] = [];
  features.push({
    type: "Feature",
    properties: { kind: "vertices" },
    geometry: { type: "MultiPoint", coordinates: drawRing as [number, number][] },
  });
  if (drawRing.length >= 2) {
    features.push({
      type: "Feature",
      properties: { kind: "path" },
      geometry: { type: "LineString", coordinates: drawRing as [number, number][] },
    });
    features.push({
      type: "Feature",
      properties: { kind: "close" },
      geometry: {
        type: "LineString",
        coordinates: [drawRing[drawRing.length - 1]!, drawRing[0]!],
      },
    });
  }
  return { type: "FeatureCollection", features };
}
