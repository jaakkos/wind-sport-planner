/** Format Open-Meteo visibility (metres) for UI. */
export function formatVisibilityM(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m) || m < 0) return "—";
  if (m >= 10_000) return `${Math.round(m / 1000)} km`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}
