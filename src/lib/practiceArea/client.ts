/**
 * Browser-side client for /api/practice-areas. Each call throws on a
 * non-OK response with the raw response body as the error message so
 * callers can surface it to the user.
 */

export type WindSectorTuple = readonly [number, number];

export type PracticeAreaCreatePayload = {
  geojson: GeoJSON.Polygon;
  sports: string[];
  labelPreset: string;
  name: string;
  windSectors?: readonly WindSectorTuple[];
};

export type PracticeAreaPatchPayload = {
  geojson?: GeoJSON.Polygon;
  optimalWindFromDeg?: number | null;
  name?: string;
  sports?: string[];
  windSectors?: readonly WindSectorTuple[] | null;
  labelPreset?: string;
  isPublic?: boolean;
};

async function ensureOk(r: Response): Promise<Response> {
  if (r.ok) return r;
  let body = "";
  try {
    body = await r.text();
  } catch {
    /* ignore */
  }
  throw new Error(body || `HTTP ${r.status}`);
}

export async function createPracticeArea(
  payload: PracticeAreaCreatePayload,
): Promise<Response> {
  const r = await fetch("/api/practice-areas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return ensureOk(r);
}

export async function patchPracticeArea(
  id: string,
  payload: PracticeAreaPatchPayload,
): Promise<Response> {
  const r = await fetch(`/api/practice-areas/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return ensureOk(r);
}

export async function deletePracticeArea(id: string): Promise<Response> {
  const r = await fetch(`/api/practice-areas/${id}`, { method: "DELETE" });
  return ensureOk(r);
}
