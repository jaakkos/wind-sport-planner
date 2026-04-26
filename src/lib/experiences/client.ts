/**
 * Browser-side client for /api/experiences. Throws on a non-OK
 * response, prefering an `error` field from the JSON body when
 * present so callers can surface it to the user verbatim.
 */

export type CreateExperiencePayload = {
  practiceAreaId: string;
  sport: string;
  occurredAt: string;
  sessionSuitability: string;
};

async function readErrorMessage(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { error?: string };
    if (j?.error) return j.error;
  } catch {
    /* fall through */
  }
  try {
    const t = await r.text();
    if (t) return t;
  } catch {
    /* fall through */
  }
  return `HTTP ${r.status}`;
}

export async function createExperience(
  payload: CreateExperiencePayload,
): Promise<void> {
  const r = await fetch("/api/experiences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r));
}

export async function deleteExperience(id: string): Promise<void> {
  const r = await fetch(`/api/experiences/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await readErrorMessage(r));
}
