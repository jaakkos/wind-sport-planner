"use client";

import bbox from "@turf/bbox";
import type { FeatureCollection } from "geojson";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { areaFeatureId } from "@/lib/map/polygons";

const MAX_FIT_ZOOM = 14;
const FIT_DURATION_MS = 500;
const SIDEBAR_PAD_FRACTION = 0.36;
const SIDEBAR_PAD_MAX_PX = 380;
const SIDEBAR_PAD_FALLBACK_PX = 72;

/** Auto-fit the map to all practice-area polygons whenever the area set changes. */
export function useFitMapToPracticeAreas(args: {
  mapRef: RefObject<MapRef | null>;
  practiceAreas: FeatureCollection | null | undefined;
  activeSport: string;
  /** Bumps when the map instance becomes available so we can re-fit after `load`. */
  mapEpoch: number;
}): void {
  const { mapRef, practiceAreas, activeSport, mapEpoch } = args;
  const lastFitSigRef = useRef<string>("");

  useEffect(() => {
    if (!practiceAreas?.features.length) return;
    const ids = practiceAreas.features
      .map((f) => areaFeatureId(f))
      .filter((id) => id.length > 0)
      .sort()
      .join(",");
    const sig = `${activeSport}:${ids}`;
    if (lastFitSigRef.current === sig) return;

    const map = mapRef.current?.getMap();
    if (!map) return;

    const runFit = () => {
      if (lastFitSigRef.current === sig) return;
      try {
        const bounds = bbox(practiceAreas);
        const [minLng, minLat, maxLng, maxLat] = bounds;
        if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return;
        const sidebarPad =
          typeof window !== "undefined"
            ? Math.min(SIDEBAR_PAD_MAX_PX, Math.round(window.innerWidth * SIDEBAR_PAD_FRACTION))
            : SIDEBAR_PAD_FALLBACK_PX;
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          {
            padding: { top: 64, bottom: 64, left: sidebarPad, right: 48 },
            maxZoom: MAX_FIT_ZOOM,
            duration: FIT_DURATION_MS,
          },
        );
        lastFitSigRef.current = sig;
      } catch {
        /* invalid geometry for bbox */
      }
    };

    if (map.isStyleLoaded()) runFit();
    else map.once("load", runFit);
  }, [mapRef, practiceAreas, activeSport, mapEpoch]);
}
