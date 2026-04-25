export function rankColor(score: number) {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#eab308";
  if (score > 0) return "#f97316";
  return "#94a3b8";
}

export function floorToHourMs(d = new Date()): number {
  const a = new Date(d);
  a.setMinutes(0, 0, 0);
  return a.getTime();
}

/** Value for `<input type="datetime-local" />` in local timezone. */
export function toDatetimeLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Places the terrain popover near the map click (pixel coords from MapLibre) and clamps it
 * so the card stays inside the viewport.
 */
export function terrainPopoverScreenPosition(
  anchorX: number,
  anchorY: number,
  vw: number,
  vh: number,
): { left: number; top: number } {
  const gap = 8;
  const cardW = 320;
  const cardH = 280;
  const maxLeft = Math.max(gap, vw - cardW - gap);
  const maxTop = Math.max(gap, vh - cardH - gap);
  return {
    left: Math.min(Math.max(gap, anchorX + gap), maxLeft),
    top: Math.min(Math.max(gap, anchorY + gap), maxTop),
  };
}
