/**
 * Browser-side client for the /api/elevation endpoint. Centralises the URL
 * shape and the JSON error contract ({ error?: string }) so callers do not
 * have to repeat the boilerplate.
 */

export type ElevationResult = {
  elevationM: number | null;
};

export class ElevationFetchError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ElevationFetchError";
    this.status = status;
  }
}

export async function fetchElevation(
  lat: number,
  lng: number,
): Promise<ElevationResult> {
  const r = await fetch(`/api/elevation?lat=${lat}&lng=${lng}`);
  const body = (await r.json()) as { elevationM?: number; error?: string };
  if (!r.ok) {
    throw new ElevationFetchError(body.error ?? r.statusText, r.status);
  }
  return { elevationM: body.elevationM ?? null };
}
