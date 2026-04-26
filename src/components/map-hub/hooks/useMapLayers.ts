"use client";

import { useMemo } from "react";
import type { FeatureCollection } from "geojson";

import {
  buildAreaNameLabels,
  buildAreasColored,
  buildWindFieldArrows,
  buildWindLabels,
  buildYrForecastPoints,
  selectedAreaOptimalWindMarker,
} from "@/lib/map/areaLayers";
import {
  buildDrawPreview,
  buildWindPickPreview,
  optimalWindMarkerLengthPx,
  windPickArrowLengthPx,
} from "@/lib/map/interactionLayers";
import type { Bundle } from "@/components/map-hub/types";
import type { RankedPracticeArea } from "@/lib/heuristics/rankAreaTypes";

type Args = {
  bundle: Bundle | null;
  ranked: ReadonlyArray<RankedPracticeArea>;
  selectedPracticeAreaId: string | null;
  mapMode: "browse" | "draw" | "pickWind";
  drawRing: ReadonlyArray<[number, number]>;
  windPickStart: [number, number] | null;
  windPickHover: [number, number] | null;
  mapZoom: number;
};

/**
 * Bundles all derived map layer data — GeoJSON feature collections,
 * marker descriptors, transient previews, and pixel sizes — into a
 * single hook. Each value memoizes against just the inputs it actually
 * depends on so the calling component does not need to manage the
 * dependency arrays itself.
 */
export function useMapLayers({
  bundle,
  ranked,
  selectedPracticeAreaId,
  mapMode,
  drawRing,
  windPickStart,
  windPickHover,
  mapZoom,
}: Args) {
  const areasColored = useMemo(
    () => buildAreasColored(bundle?.practiceAreas, ranked, selectedPracticeAreaId),
    [bundle, ranked, selectedPracticeAreaId],
  );

  const areaNameLabels = useMemo(
    () => buildAreaNameLabels(bundle?.practiceAreas),
    [bundle],
  );

  /** Wind field: GeoJSON points under area fill; SVG icon + map rotation in MapLibre symbol layer. */
  const windFieldArrowsGeoJson: FeatureCollection = useMemo(
    () => buildWindFieldArrows(bundle?.practiceAreas, ranked),
    [ranked, bundle],
  );

  const windLabels = useMemo(() => buildWindLabels(ranked), [ranked]);

  /** Centroid markers: click opens Yr.no hourly (point) forecast for that coordinate. */
  const yrForecastPoints = useMemo(() => buildYrForecastPoints(ranked), [ranked]);

  /** Downwind preview at selected area centroid when that area has a saved optimal (CSS marker). */
  const selectedOptimalWindMarker = useMemo(
    () => selectedAreaOptimalWindMarker(bundle?.practiceAreas, selectedPracticeAreaId),
    [bundle, selectedPracticeAreaId],
  );

  const windPickPreview = useMemo(
    () => buildWindPickPreview({ mapMode, windPickStart, windPickHover }),
    [mapMode, windPickStart, windPickHover],
  );

  const optimalWindLenPx = useMemo(
    () => optimalWindMarkerLengthPx(selectedOptimalWindMarker, mapZoom),
    [selectedOptimalWindMarker, mapZoom],
  );

  const windPickArrowLenPx = useMemo(
    () => windPickArrowLengthPx(windPickPreview, mapZoom),
    [windPickPreview, mapZoom],
  );

  const drawPreview = useMemo(() => buildDrawPreview(drawRing as [number, number][]), [drawRing]);

  return {
    areasColored,
    areaNameLabels,
    windFieldArrowsGeoJson,
    windLabels,
    yrForecastPoints,
    selectedOptimalWindMarker,
    windPickPreview,
    optimalWindLenPx,
    windPickArrowLenPx,
    drawPreview,
  };
}
