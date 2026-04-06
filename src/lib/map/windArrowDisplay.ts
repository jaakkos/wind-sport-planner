/**
 * Map wind arrow display helpers (geographic bearings ° clockwise from north).
 */

/** Meteorological wind-from -> direction the air moves toward (downwind). */
export function windToDegFromDirFrom(dirFromDeg: number): number {
  return ((dirFromDeg + 180) % 360 + 360) % 360;
}

/**
 * CSS `rotate()` for an element drawn along +X (east). Aligns it with geographic wind-to,
 * matching shaft+head markers (optimal / pick) under MapLibre `rotationAlignment="map"`.
 */
export function cssRotateEastBaseToWindTo(windToDeg: number): number {
  return windToDeg - 90;
}
