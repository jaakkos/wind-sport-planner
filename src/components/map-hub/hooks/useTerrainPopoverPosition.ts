"use client";

import type { RefObject } from "react";
import { useEffect, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { terrainPopoverScreenPosition } from "@/lib/map/mapHubHelpers";

/** Track the screen-space position of the terrain popover anchored to a lng/lat. */
export function useTerrainPopoverPosition(args: {
  mapRef: RefObject<MapRef | null>;
  anchor: { lat: number; lng: number } | null;
}): { left: number; top: number } | null {
  const { mapRef, anchor } = args;
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!anchor) {
      setPos(null);
      return;
    }
    const map = mapRef.current?.getMap();
    if (!map) return;
    const { lng, lat } = anchor;
    const sync = () => {
      if (typeof window === "undefined") return;
      const p = map.project([lng, lat]);
      setPos(
        terrainPopoverScreenPosition(p.x, p.y, window.innerWidth, window.innerHeight),
      );
    };
    sync();
    map.on("move", sync);
    map.on("zoom", sync);
    map.on("resize", sync);
    window.addEventListener("resize", sync);
    return () => {
      map.off("move", sync);
      map.off("zoom", sync);
      map.off("resize", sync);
      window.removeEventListener("resize", sync);
    };
  }, [mapRef, anchor]);

  return pos;
}
