/** Persisted map overlay visibility (Phase F — docs/ui-roadmap §6.2). */

export type MapLayerTogglesState = {
  /** Wind field arrow icons + numeric wind labels along spans. */
  windArrows: boolean;
  /** Yr hourly sample dots (blue) and edit-panel multi-point preview (amber). */
  forecastSampleDots: boolean;
  /** Practice area name labels on the map. */
  areaLabels: boolean;
};

const MAP_LAYER_TOGGLES_STORAGE_KEY = "mapHub.layerOverlays";

export function defaultMapLayerToggles(): MapLayerTogglesState {
  return {
    windArrows: true,
    forecastSampleDots: true,
    areaLabels: true,
  };
}

export function readMapLayerTogglesFromStorage(): MapLayerTogglesState {
  const base = defaultMapLayerToggles();
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(MAP_LAYER_TOGGLES_STORAGE_KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<MapLayerTogglesState>;
    return {
      windArrows: typeof p.windArrows === "boolean" ? p.windArrows : base.windArrows,
      forecastSampleDots:
        typeof p.forecastSampleDots === "boolean" ? p.forecastSampleDots : base.forecastSampleDots,
      areaLabels: typeof p.areaLabels === "boolean" ? p.areaLabels : base.areaLabels,
    };
  } catch {
    return base;
  }
}

export function writeMapLayerTogglesToStorage(next: MapLayerTogglesState): void {
  try {
    localStorage.setItem(MAP_LAYER_TOGGLES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
