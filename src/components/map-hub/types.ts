import type { FeatureCollection } from "geojson";

/**
 * Map-hub presentational shapes that are shared across multiple files. The
 * ranking-preferences and experiences shapes have moved to live next to the
 * hooks that own them; what stays here is the bundle/terrain plumbing
 * consumed by both MapHub and its sub-panels.
 */

export type Bundle = {
  activeSport: string;
  practiceAreas: FeatureCollection;
};

export type ClickTerrain = {
  lat: number;
  lng: number;
  elevationM: number | null;
  loading: boolean;
  error?: string;
};
