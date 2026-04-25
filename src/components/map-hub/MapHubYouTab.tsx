import Link from "next/link";
import { signOut } from "next-auth/react";
import type { Dispatch, SetStateAction } from "react";
import { toDatetimeLocalInput } from "@/lib/map/mapHubHelpers";
import { areaFeatureId } from "@/lib/map/polygons";
import { cardinalFromDeg } from "@/lib/map/windFormat";
import { CollapsibleSection } from "./CollapsibleSection";
import {
  hubBtnPrimary,
  hubBtnSecondaryToolbar,
  hubInputNative,
  hubKbd,
  hubListRow,
} from "./hubUi";
import type { Bundle, ExperienceRow } from "./types";

export function MapHubYouTab({
  sessionPending,
  isAuthed,
  toolSectionsOpen,
  toggleToolSection,
  mapMode,
  editingAreaId,
  drawAreaName,
  setDrawAreaName,
  drawRing,
  setDrawRing,
  loading,
  finishDrawing,
  onStartDrawing,
  setMapMode,
  setEditingAreaId,
  bundle,
  clientReady,
  activeSport,
  experiences,
  setLoading,
  setMsg,
  loadExperiences,
  loadRank,
  msg,
}: {
  sessionPending: boolean;
  isAuthed: boolean;
  toolSectionsOpen: { draw: boolean; experiences: boolean; account: boolean };
  toggleToolSection: (k: "draw" | "experiences" | "account") => void;
  mapMode: "browse" | "draw" | "pickWind";
  editingAreaId: string | null;
  drawAreaName: string;
  setDrawAreaName: (s: string) => void;
  drawRing: [number, number][];
  setDrawRing: Dispatch<SetStateAction<[number, number][]>>;
  loading: boolean;
  finishDrawing: () => void;
  onStartDrawing: () => void;
  setMapMode: (m: "browse" | "draw" | "pickWind") => void;
  setEditingAreaId: (id: string | null) => void;
  bundle: Bundle | null;
  clientReady: boolean;
  activeSport: "kiteski" | "kitesurf";
  experiences: ExperienceRow[];
  setLoading: (v: boolean) => void;
  setMsg: (s: string | null) => void;
  loadExperiences: () => void | Promise<void>;
  loadRank: () => void | Promise<void>;
  msg: string | null;
}) {
  return (
    <>
      <CollapsibleSection
        title="Practice areas"
        summary={
          !isAuthed
            ? "Sign in to draw your own polygons"
            : mapMode === "draw"
              ? editingAreaId
                ? "Editing boundary…"
                : "Drawing polygon…"
              : "Draw & save polygons on the map"
        }
        open={toolSectionsOpen.draw}
        onToggle={() => toggleToolSection("draw")}
      >
        {sessionPending ? (
          <p className="text-[11px] text-app-fg-subtle">Checking session…</p>
        ) : !isAuthed ? (
          <p className="text-[11px] leading-snug text-app-fg-muted">
            Anyone can browse <strong>public</strong> areas.{" "}
            <Link href="/login" className="font-medium text-app-accent-hover underline hover:text-app-fg">
              Sign in
            </Link>{" "}
            to add your own spots.
          </p>
        ) : (
          <>
            <p className="text-[11px] leading-snug text-app-fg-muted">
              Uses forecast at polygon centre and each area’s wind settings (set under{" "}
              <strong>Edit area</strong>).
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-app-fg-muted">Name for new drawings</span>
              <input
                type="text"
                value={drawAreaName}
                onChange={(e) => setDrawAreaName(e.target.value.slice(0, 120))}
                placeholder="e.g. West beach"
                className="rounded-xl border border-app-border-subtle bg-app-surface px-3 py-2 text-xs text-app-fg focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/20"
                maxLength={120}
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {mapMode === "browse" ? (
                <button type="button" className={hubBtnPrimary} onClick={onStartDrawing}>
                  Start drawing
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={hubBtnPrimary}
                    disabled={loading}
                    onClick={() => void finishDrawing()}
                  >
                    Finish &amp; save
                  </button>
                  <button
                    type="button"
                    className={hubBtnSecondaryToolbar}
                    onClick={() => setDrawRing((r) => r.slice(0, -1))}
                    disabled={drawRing.length === 0}
                  >
                    Undo point
                  </button>
                  <button
                    type="button"
                    className={hubBtnSecondaryToolbar}
                    onClick={() => {
                      setDrawRing([]);
                      setMapMode("browse");
                      setEditingAreaId(null);
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
            {mapMode === "draw" && (
              <p className="text-[11px] text-app-fg-muted">
                {editingAreaId ? (
                  <span className="font-medium text-app-warning-fg">Editing boundary · </span>
                ) : null}
                {drawRing.length} point{drawRing.length === 1 ? "" : "s"} · click map for corners ·{" "}
                <kbd className={hubKbd}>Esc</kbd> cancels
              </p>
            )}
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Session experiences"
        summary={
          !isAuthed
            ? "Sign in to log sessions"
            : experiences.length
              ? `${experiences.length} logged · used to boost rank when weather matches`
              : "Log past sessions → smarter rankings"
        }
        open={toolSectionsOpen.experiences}
        onToggle={() => toggleToolSection("experiences")}
        variant="accent"
      >
        {sessionPending ? (
          <p className="text-[11px] text-app-fg-subtle">Checking session…</p>
        ) : !isAuthed ? (
          <p className="text-[11px] leading-snug text-app-fg-muted">
            <Link href="/login" className="font-medium text-app-accent-hover underline hover:text-app-fg">
              Sign in
            </Link>{" "}
            to log sessions and get personalized ranking boosts on your areas.
          </p>
        ) : (
          <>
            <p className="text-[10px] leading-snug text-app-fg-muted">
              Add when and where you went (active sport:{" "}
              <strong>{activeSport === "kiteski" ? "Kite ski" : "Kite surf"}</strong>). We pull archive
              wind at the area centre; when forecast matches those buckets, areas with good sessions get a
              small score boost (needs at least two matching experiences per area).
            </p>
            <form
              className="flex flex-col gap-2 border-t border-app-border pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const practiceAreaId = String(fd.get("practiceAreaId") ?? "");
                const occurredAtRaw = String(fd.get("occurredAt") ?? "");
                const sessionSuitability = String(fd.get("sessionSuitability") ?? "suitable");
                if (!practiceAreaId) {
                  setMsg("Choose a practice area.");
                  return;
                }
                const at = new Date(occurredAtRaw);
                if (Number.isNaN(at.getTime())) {
                  setMsg("Invalid date/time.");
                  return;
                }
                setLoading(true);
                setMsg(null);
                void (async () => {
                  try {
                    const r = await fetch("/api/experiences", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        practiceAreaId,
                        sport: activeSport,
                        occurredAt: at.toISOString(),
                        sessionSuitability,
                      }),
                    });
                    const j = (await r.json()) as { error?: string };
                    if (!r.ok) throw new Error(j.error ?? "Save failed");
                    await loadExperiences();
                    await loadRank();
                    setMsg("Experience saved.");
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : "Save failed");
                  } finally {
                    setLoading(false);
                  }
                })();
              }}
            >
              <label className="text-[11px] font-medium text-app-fg">
                When
                <input
                  key={clientReady ? "occurredAt" : "occurredAt-pending"}
                  type="datetime-local"
                  name="occurredAt"
                  required
                  defaultValue={clientReady ? toDatetimeLocalInput(new Date()) : ""}
                  className={hubInputNative}
                />
              </label>
              <label className="text-[11px] font-medium text-app-fg">
                Area
                <select
                  name="practiceAreaId"
                  required
                  className={hubInputNative}
                  disabled={!bundle?.practiceAreas?.features.length}
                >
                  <option value="">Select area…</option>
                  {(bundle?.practiceAreas.features ?? []).map((f) => {
                    const id = areaFeatureId(f);
                    const props = (f.properties ?? {}) as { name?: string };
                    const label = (props.name?.trim() || `Area ${id.slice(0, 6)}`).slice(0, 80);
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="text-[11px] font-medium text-app-fg">
                How were conditions?
                <select
                  name="sessionSuitability"
                  className={hubInputNative}
                  defaultValue="suitable"
                >
                  <option value="ideal">Ideal</option>
                  <option value="suitable">Suitable</option>
                  <option value="marginal">Marginal</option>
                  <option value="unsuitable">Unsuitable</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={loading || !bundle?.practiceAreas?.features.length}
                className={hubBtnPrimary}
              >
                Save experience
              </button>
            </form>
            {experiences.length > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto border-t border-app-border pt-2 text-[10px] text-app-fg-muted">
                {experiences.map((ex) => (
                  <li
                    key={ex.id}
                    className={hubListRow}
                  >
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="font-medium">{ex.practiceAreaName}</span>
                      <br />
                      <span suppressHydrationWarning>
                        {new Date(ex.occurredAt).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>{" "}
                      · {ex.sessionSuitability}
                      {ex.windDirDeg != null ? (
                        <>
                          {" "}
                          · wind {cardinalFromDeg(ex.windDirDeg)} (
                          {Math.round(ex.windDirDeg)}°)
                        </>
                      ) : (
                        " · no archive wind"
                      )}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-[10px] text-app-danger hover:underline"
                      onClick={() => {
                        setLoading(true);
                        void (async () => {
                          try {
                            const r = await fetch(`/api/experiences/${ex.id}`, { method: "DELETE" });
                            if (!r.ok) throw new Error("Delete failed");
                            await loadExperiences();
                            await loadRank();
                            setMsg("Experience removed.");
                          } catch {
                            setMsg("Could not delete experience.");
                          } finally {
                            setLoading(false);
                          }
                        })();
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] text-app-fg-subtle">No experiences for this sport yet.</p>
            )}
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Account"
        summary={
          sessionPending
            ? "Loading…"
            : isAuthed
              ? msg
                ? "Has a status message · open for sign out"
                : "Open to sign out"
              : "Sign in for your areas & drawing"
        }
        open={toolSectionsOpen.account}
        onToggle={() => toggleToolSection("account")}
      >
        {sessionPending ? (
          <p className="text-xs text-app-fg-subtle">Checking session…</p>
        ) : isAuthed ? (
          <>
            {msg && <p className="text-xs text-app-fg-muted">{msg}</p>}
            <button
              type="button"
              className="text-left text-xs font-medium text-app-accent-hover underline decoration-app-accent/50 underline-offset-2 hover:text-app-fg"
              onClick={() => void signOut({ callbackUrl: "/login" })}
            >
              Sign out
            </button>
          </>
        ) : (
          <p className="text-xs leading-snug text-app-fg-muted">
            <Link
              href="/login"
              className="font-medium text-app-accent-hover underline decoration-app-accent/50 underline-offset-2 hover:text-app-fg"
            >
              Sign in
            </Link>{" "}
            to save practice areas, draw polygons, and log sessions.
          </p>
        )}
      </CollapsibleSection>
    </>
  );
}
