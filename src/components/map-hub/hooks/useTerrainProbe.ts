"use client";

import { useCallback, useState } from "react";
import { fetchElevation, ElevationFetchError } from "@/lib/elevation/client";
import type { ClickTerrain } from "@/components/map-hub/types";

/**
 * Owns the "click the map for elevation" interaction. The hook keeps the
 * current probe (or null when nothing is shown) and exposes two actions:
 *
 *  - probe(lat, lng): seeds the loading state and fetches the elevation;
 *    handles HTTP and network errors by attaching an `error` field.
 *  - clear(): hides the probe (e.g. when the popover is dismissed or the
 *    user starts another interaction).
 */
export function useTerrainProbe(): {
  terrain: ClickTerrain | null;
  probe: (lat: number, lng: number) => void;
  clear: () => void;
} {
  const [terrain, setTerrain] = useState<ClickTerrain | null>(null);

  const clear = useCallback(() => setTerrain(null), []);

  const probe = useCallback((lat: number, lng: number) => {
    setTerrain({ lat, lng, elevationM: null, loading: true });
    void fetchElevation(lat, lng)
      .then(({ elevationM }) => {
        setTerrain({ lat, lng, elevationM, loading: false });
      })
      .catch((err: unknown) => {
        const message =
          err instanceof ElevationFetchError ? err.message : "Network error";
        setTerrain({
          lat,
          lng,
          elevationM: null,
          loading: false,
          error: message,
        });
      });
  }, []);

  return { terrain, probe, clear };
}
