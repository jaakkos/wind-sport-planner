import type { Feature, FeatureCollection, Polygon } from "geojson";
import centroid from "@turf/centroid";

import type { RankedPracticeArea } from "@/lib/heuristics/rankAreaTypes";
import { rankColor } from "@/lib/map/mapHubHelpers";
import {
  areaFeatureId,
  MAX_TOTAL_WIND_FIELD_MARKERS,
  WIND_FIELD_MAX_ARROWS,
} from "@/lib/map/polygons";
import { windToDegFromDirFrom } from "@/lib/map/windArrowDisplay";
import { windCompactSummary, windMultiPointSubtitle, windToFromWindFrom } from "@/lib/map/windFormat";
import {
  windFieldSpatialProbePoints,
  WIND_MAP_ARROW_MAX_SAMPLES_SETTING,
} from "@/lib/heuristics/windSamplePoints";
import { clampArrowLengthInsidePolygon } from "@/lib/map/windArrowLength";
import { formatVisibilityM } from "@/lib/weather/formatVisibility";

/**
 * Pure builders for the GeoJSON sources MapHub feeds into MapLibre. Each
 * function takes only the data it needs and returns a fresh FeatureCollection
 * (or null where there is nothing to render). They are kept side-effect free
 * so they can be memoised by the caller and unit-tested in isolation.
 */

/**
 * Decorates each practice-area polygon with the rank/score-derived properties
 * that the area fill layer reads (rankScore, rankColor, selectedPractice,
 * isCommunity, hasMapSelection).
 */
export function buildAreasColored(
  practiceAreas: FeatureCollection | null | undefined,
  ranked: ReadonlyArray<RankedPracticeArea>,
  selectedPracticeAreaId: string | null,
): FeatureCollection | null {
  if (!practiceAreas) return null;
  const rankMap = new Map(ranked.map((r) => [r.areaId, r.score]));
  const hasMapSelection = selectedPracticeAreaId != null ? 1 : 0;
  const features: Feature[] = practiceAreas.features.map((f) => {
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const id = String(f.id ?? props.id ?? "");
    const score = rankMap.get(id) ?? 0;
    const sel = id === selectedPracticeAreaId ? 1 : 0;
    const isCommunity = props.isCommunity === 1 || props.isCommunity === true ? 1 : 0;
    return {
      ...f,
      properties: {
        ...props,
        rankScore: score,
        rankColor: rankColor(score),
        selectedPractice: sel,
        isCommunity,
        hasMapSelection,
      },
    };
  });
  return { type: "FeatureCollection", features };
}

/**
 * Centroid points labelled with the area name (and a "shared" suffix for
 * community areas). Returns null when there is nothing to label.
 */
export function buildAreaNameLabels(
  practiceAreas: FeatureCollection | null | undefined,
): FeatureCollection | null {
  if (!practiceAreas?.features.length) return null;
  const features: Feature[] = [];
  for (const f of practiceAreas.features) {
    if (f.geometry?.type !== "Polygon") continue;
    const props = (f.properties ?? {}) as {
      id?: string;
      name?: string;
      isCommunity?: number | boolean;
    };
    const idStr = String(props.id ?? f.id ?? "");
    const raw = typeof props.name === "string" ? props.name.trim() : "";
    const shared =
      props.isCommunity === 1 || props.isCommunity === true ? " · shared" : "";
    const label = `${raw || `Area ${idStr.slice(0, 6)}`}${shared}`.slice(0, 120);
    try {
      const c = centroid(f as Feature<Polygon>);
      features.push({
        type: "Feature",
        properties: { areaName: label },
        geometry: c.geometry,
      });
    } catch {
      /* invalid geometry */
    }
  }
  return features.length ? { type: "FeatureCollection", features } : null;
}

/**
 * Spatially-distributed wind arrow origins for each ranked area. Each feature
 * carries the `windTo` heading so the symbol layer can rotate the icon. The
 * total feature count is capped so the map does not get overwhelmed when many
 * areas are visible.
 */
export function buildWindFieldArrows(
  practiceAreas: FeatureCollection | null | undefined,
  ranked: ReadonlyArray<RankedPracticeArea>,
): FeatureCollection {
  const features: Feature[] = [];
  const polyById = new Map<string, Polygon>();
  if (practiceAreas?.features.length) {
    for (const f of practiceAreas.features) {
      if (f.geometry?.type !== "Polygon") continue;
      const geom = f.geometry;
      const props = (f.properties ?? {}) as { id?: string };
      const keys = new Set<string>();
      const primary = areaFeatureId(f);
      if (primary) keys.add(primary);
      if (f.id != null && String(f.id) !== "") keys.add(String(f.id));
      if (props.id != null && String(props.id) !== "") keys.add(String(props.id));
      for (const k of keys) polyById.set(k, geom);
    }
  }
  outer: for (const r of ranked) {
    const w = r.wind;
    if (w?.dirFromDeg == null || Number.isNaN(w.dirFromDeg)) continue;
    const { lng, lat } = r.centroid;
    const windTo = windToDegFromDirFrom(w.dirFromDeg);
    const poly = polyById.get(r.areaId);
    const origins = poly
      ? windFieldSpatialProbePoints(
          poly,
          lng,
          lat,
          WIND_MAP_ARROW_MAX_SAMPLES_SETTING,
          WIND_FIELD_MAX_ARROWS,
        )
      : [[lng, lat]];
    let i = 0;
    for (const [sx, sy] of origins) {
      if (features.length >= MAX_TOTAL_WIND_FIELD_MARKERS) break outer;
      features.push({
        type: "Feature",
        id: `wf-${r.areaId}-${i++}`,
        properties: { windTo },
        geometry: { type: "Point", coordinates: [sx, sy] },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

/**
 * Centroid points labelled with a compact "wind summary + multi-point hint +
 * visibility" string. Pure presentation, one feature per ranked area.
 */
export function buildWindLabels(
  ranked: ReadonlyArray<RankedPracticeArea>,
): FeatureCollection {
  const features: Feature[] = [];
  for (const r of ranked) {
    const w = r.wind;
    const { lng, lat } = r.centroid;
    const line1 = w ? windCompactSummary(w) : "—";
    const mpLine = windMultiPointSubtitle(w);
    const visStr = formatVisibilityM(w?.visibilityM ?? null);
    const lineVis = visStr !== "—" ? `vis ${visStr}` : "";
    features.push({
      type: "Feature",
      properties: {
        windText: [line1, mpLine, lineVis].filter(Boolean).join("\n"),
      },
      geometry: { type: "Point", coordinates: [lng, lat] },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * Centroid points with `areaId`. The layer translates clicks on these into a
 * Yr.no hourly forecast deep-link for the underlying coordinate.
 */
export function buildYrForecastPoints(
  ranked: ReadonlyArray<RankedPracticeArea>,
): FeatureCollection {
  const features: Feature[] = [];
  for (const r of ranked) {
    const { lng, lat } = r.centroid;
    features.push({
      type: "Feature",
      properties: { areaId: r.areaId },
      geometry: { type: "Point", coordinates: [lng, lat] },
    });
  }
  return { type: "FeatureCollection", features };
}

/**
 * For the currently selected area (when it has a saved `optimalWindFromDeg`),
 * returns the downwind arrow descriptor (centroid + heading + clamped length
 * inside the polygon). Returns null when there is nothing to draw.
 */
export function selectedAreaOptimalWindMarker(
  practiceAreas: FeatureCollection | null | undefined,
  selectedPracticeAreaId: string | null,
): { lng: number; lat: number; windToDeg: number; lenKm: number } | null {
  if (!practiceAreas?.features.length || !selectedPracticeAreaId) return null;
  const f = practiceAreas.features.find(
    (x) => areaFeatureId(x) === selectedPracticeAreaId,
  );
  if (!f || f.geometry?.type !== "Polygon") return null;
  const p = f.properties as { optimalWindFromDeg?: number | null };
  const opt = p?.optimalWindFromDeg;
  if (opt == null || typeof opt !== "number" || !Number.isFinite(opt)) return null;
  try {
    const c = centroid(f as Feature<Polygon>);
    const [lng, lat] = c.geometry.coordinates;
    const poly = f.geometry;
    const windTo = windToFromWindFrom(opt);
    const lenKm = clampArrowLengthInsidePolygon(poly, lng, lat, windTo, 14);
    return { lng, lat, windToDeg: windTo, lenKm };
  } catch {
    return null;
  }
}
