"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";

import type { RankedPracticeArea } from "@/lib/heuristics/rankAreaTypes";
import { ensureWindFieldArrowImage } from "@/lib/map/windFieldArrowIcon";

type Args = {
  setSelectedPracticeAreaId: (id: string | null) => void;
  clearTerrain: () => void;
};

/**
 * Owns the imperative map instance handle plus the bookkeeping that
 * needs to react to it: the load epoch (so other effects can re-run
 * when the map remounts), the current zoom level, and a fly-to helper
 * that selects a ranked area.
 */
export function useMapInstance({
  setSelectedPracticeAreaId,
  clearTerrain,
}: Args) {
  const mapRef = useRef<MapRef>(null);
  /** Bumps on map `load` so effects can re-sync icons after the map instance exists. */
  const [mapEpoch, setMapEpoch] = useState(0);
  const [mapZoom, setMapZoom] = useState(5);

  const focusRankedAreaOnMap = useCallback(
    (r: RankedPracticeArea) => {
      const map = mapRef.current?.getMap();
      if (map) {
        map.stop();
        const { lng, lat } = r.centroid;
        map.flyTo({
          center: [lng, lat],
          zoom: Math.max(map.getZoom(), 12),
          duration: 1000,
          essential: true,
        });
      }
      setSelectedPracticeAreaId(r.areaId);
      clearTerrain();
    },
    [clearTerrain, setSelectedPracticeAreaId],
  );

  return {
    mapRef,
    mapEpoch,
    setMapEpoch,
    mapZoom,
    setMapZoom,
    focusRankedAreaOnMap,
  };
}

/**
 * Re-uploads the wind-field arrow image whenever the basemap style
 * changes or the map remounts (mapEpoch). Kept here because it is the
 * other half of the imperative map plumbing.
 */
export function useEnsureWindFieldArrowImage({
  mapRef,
  mapEpoch,
  mapStyle,
  windFieldFeatureCount,
}: {
  mapRef: React.RefObject<MapRef | null>;
  mapEpoch: number;
  mapStyle: string | object;
  windFieldFeatureCount: number;
}) {
  useEffect(() => {
    if (windFieldFeatureCount === 0) return;
    const map = mapRef.current?.getMap();
    if (!map?.isStyleLoaded()) return;
    ensureWindFieldArrowImage(map);
  }, [mapRef, mapEpoch, windFieldFeatureCount, mapStyle]);
}
