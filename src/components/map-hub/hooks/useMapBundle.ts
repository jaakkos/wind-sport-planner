"use client";

import type { FeatureCollection } from "geojson";
import { useCallback, useEffect, useState } from "react";

export type MapBundle = {
  activeSport: string;
  practiceAreas: FeatureCollection;
};

export function useMapBundle(activeSport: "kiteski" | "kitesurf"): {
  bundle: MapBundle | null;
  loading: boolean;
  reload: () => Promise<void>;
} {
  const [bundle, setBundle] = useState<MapBundle | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/map/bundle?activeSport=${activeSport}`);
      if (!r.ok) return;
      const j = (await r.json()) as MapBundle;
      setBundle(j);
    } finally {
      setLoading(false);
    }
  }, [activeSport]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { bundle, loading, reload };
}
