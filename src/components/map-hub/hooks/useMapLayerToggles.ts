"use client";

import { useCallback, useEffect, useState } from "react";
import {
  defaultMapLayerToggles,
  readMapLayerTogglesFromStorage,
  writeMapLayerTogglesToStorage,
  type MapLayerTogglesState,
} from "@/lib/map/mapLayerToggles";

/**
 * Holds the map's optional overlay toggles (forecast dots, etc.) with
 * localStorage persistence. SSR renders with defaults; the stored values
 * hydrate in an effect to avoid mismatches.
 */
export function useMapLayerToggles(): {
  toggles: MapLayerTogglesState;
  patch: (patch: Partial<MapLayerTogglesState>) => void;
} {
  const [toggles, setToggles] = useState<MapLayerTogglesState>(() =>
    defaultMapLayerToggles(),
  );

  useEffect(() => {
    setToggles(readMapLayerTogglesFromStorage());
  }, []);

  const patch = useCallback((patch: Partial<MapLayerTogglesState>) => {
    setToggles((prev) => {
      const next = { ...prev, ...patch };
      writeMapLayerTogglesToStorage(next);
      return next;
    });
  }, []);

  return { toggles, patch };
}
