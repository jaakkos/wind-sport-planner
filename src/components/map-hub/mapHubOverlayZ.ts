/**
 * Stacking order for map hub UI above the MapLibre canvas (low → high).
 * Map canvas / built-in controls use their own stack; these sit in one DOM subtree.
 */
export const hubOverlayZ = {
  /** Left sidebar (Plan / Map / You). */
  sidebar: "z-[20]",
  /** Terrain click card, map legend, other map-attached popovers (not the edit drawer). */
  mapPopover: "z-[25]",
  /** Practice area edit panel (should sit above sidebar + map popovers). */
  editPanel: "z-[30]",
} as const;
