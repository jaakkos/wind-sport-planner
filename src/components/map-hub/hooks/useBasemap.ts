"use client";

import { useMemo, useState } from "react";
import {
  buildRasterBasemapStyle,
  maptilerOutdoorStyleUrl,
  type BasemapId,
} from "@/lib/map/styles";

const BASEMAP_LABELS: Record<BasemapId, string> = {
  hybrid: "Hybrid",
  osm: "OSM",
  topo: "Topo",
  satellite: "Satellite",
  maptiler_outdoor: "MapTiler Outdoor",
};

/**
 * Owns basemap selection and the relief overlay opacity, and exposes the
 * derived MapLibre style descriptor along with a short summary label and
 * whether a MapTiler key is configured (which gates the corresponding option).
 *
 * The MapTiler outdoor style URL is resolved lazily; if no key is configured
 * we fall back to the hybrid raster style.
 */
export function useBasemap(): {
  basemap: BasemapId;
  setBasemap: (id: BasemapId) => void;
  reliefOpacity: number;
  setReliefOpacity: (value: number) => void;
  mapStyle: ReturnType<typeof buildRasterBasemapStyle> | string;
  summary: string;
  hasMaptilerKey: boolean;
} {
  const [basemap, setBasemap] = useState<BasemapId>("hybrid");
  const [reliefOpacity, setReliefOpacity] = useState(0.42);

  const mapStyle = useMemo(() => {
    if (basemap === "maptiler_outdoor") {
      const url = maptilerOutdoorStyleUrl();
      if (url) return url;
      return buildRasterBasemapStyle("hybrid", reliefOpacity);
    }
    return buildRasterBasemapStyle(basemap, reliefOpacity);
  }, [basemap, reliefOpacity]);

  const summary = useMemo(() => BASEMAP_LABELS[basemap] ?? basemap, [basemap]);

  const hasMaptilerKey = Boolean(
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_MAPTILER_API_KEY,
  );

  return {
    basemap,
    setBasemap,
    reliefOpacity,
    setReliefOpacity,
    mapStyle,
    summary,
    hasMaptilerKey,
  };
}
