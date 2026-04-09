import Link from "next/link";
import type { RankedPracticeArea } from "@/lib/heuristics/rankAreaTypes";
import { CollapsibleSection } from "./CollapsibleSection";
import { ForecastTimeControl } from "./ForecastTimeControl";
import { HelpDisclosure, PersistedCollapsible } from "./MapHubDisclosures";
import { hubBtnPrimary, hubBtnSecondary } from "./hubUi";
import { RankedListSkeleton, ScoringPrefsSkeleton } from "./hubSkeleton";
import { RankedAreaRow } from "./RankedAreaRow";
import type { SportRankingFormState } from "./types";

export function MapHubPlanTab({
  activeSport,
  setActiveSport,
  toolSectionsOpen,
  toggleToolSection,
  forecastSummary,
  hoursAhead,
  setHoursAhead,
  forecastAtIso,
  setForecastAnchorMs,
  floorToHourMs,
  ranked,
  rankLoading = false,
  rankLoadError = null,
  focusRankedAreaOnMap,
  isAuthed,
  rankingPrefsLoading,
  rankingForm,
  patchActiveSportRanking,
  saveRankingPrefsForActiveSport,
  resetRankingPrefsForActiveSport,
  windRankSummary,
  mapMode,
  windPickStart,
  cancelPickWind,
  optimalWindHalfWidthDeg,
  setOptimalWindHalfWidthDeg,
  sectorHalfWidthDeg,
  setSectorHalfWidthDeg,
}: {
  activeSport: "kiteski" | "kitesurf";
  setActiveSport: (s: "kiteski" | "kitesurf") => void;
  toolSectionsOpen: { sport: boolean; forecast: boolean; windRank: boolean };
  toggleToolSection: (k: "sport" | "forecast" | "windRank") => void;
  forecastSummary: string;
  hoursAhead: number;
  setHoursAhead: (n: number) => void;
  forecastAtIso: string;
  setForecastAnchorMs: (ms: number) => void;
  floorToHourMs: (d?: Date) => number;
  ranked: RankedPracticeArea[];
  /** When true, show list skeleton (initial load) or “Updating…” above list. */
  rankLoading?: boolean;
  rankLoadError?: string | null;
  focusRankedAreaOnMap: (r: RankedPracticeArea) => void;
  isAuthed: boolean;
  rankingPrefsLoading: boolean;
  rankingForm: { kiteski: SportRankingFormState; kitesurf: SportRankingFormState } | null;
  patchActiveSportRanking: (patch: Partial<SportRankingFormState>) => void;
  saveRankingPrefsForActiveSport: () => void | Promise<void>;
  resetRankingPrefsForActiveSport: () => void | Promise<void>;
  windRankSummary: string;
  mapMode: "browse" | "draw" | "pickWind";
  windPickStart: [number, number] | null;
  cancelPickWind: () => void;
  optimalWindHalfWidthDeg: number;
  setOptimalWindHalfWidthDeg: (n: number) => void;
  sectorHalfWidthDeg: number;
  setSectorHalfWidthDeg: (n: number) => void;
}) {
  const scoringSummaryCollapsed =
    rankingForm != null
      ? `${rankingForm[activeSport].minWindMs}–${rankingForm[activeSport].maxWindMs} m/s · weights & direction`
      : "Customize wind bands & weights";

  return (
    <>
      <CollapsibleSection
        title="Sport"
        summary={`Active: ${activeSport === "kiteski" ? "Kite ski" : "Kite surf"}`}
        open={toolSectionsOpen.sport}
        onToggle={() => toggleToolSection("sport")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Active sport"
            value={activeSport}
            onChange={(e) => setActiveSport(e.target.value as "kiteski" | "kitesurf")}
            className="w-full rounded-xl border border-app-border-subtle bg-app-surface px-3 py-2 text-sm text-app-fg shadow-inner shadow-app-fg/5 focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/20"
          >
            <option value="kiteski">Kite ski</option>
            <option value="kitesurf">Kite surf</option>
          </select>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Forecast &amp; ranked areas"
        summary={forecastSummary}
        open={toolSectionsOpen.forecast}
        onToggle={() => toggleToolSection("forecast")}
      >
        <ForecastTimeControl
          hoursAhead={hoursAhead}
          setHoursAhead={setHoursAhead}
          forecastAtIso={forecastAtIso}
          setForecastAnchorMs={setForecastAnchorMs}
          floorToHourMs={floorToHourMs}
        />
        <HelpDisclosure title="How ranking & map work">
          <p>
            Slider moves the forecast hour (Met.no / Yr in Europe with terrain elevation, otherwise
            Open-Meteo). Many small <strong>downwind</strong> SVG arrows sit <strong>under</strong> the tinted
            area fill (map rotation keeps them aligned with true north).{" "}
            Labels: wind <strong>from</strong> (meteorology), whole m/s with gust in parentheses.{" "}
            <strong>Sky dot</strong> at each area centre opens Yr.no <strong>hourly</strong> forecast (new
            tab) for that point; <strong>Shift+click</strong> elsewhere does the same. <strong>Vis</strong> when
            shown
            is modelled visibility — not used in score.
          </p>
        </HelpDisclosure>
        {rankLoadError && !rankLoading ? (
          <div className="space-y-2">
            <p className="rounded-xl bg-app-warning-bg p-2.5 text-[10px] leading-snug text-app-warning-fg ring-1 ring-app-warning-border">
              {rankLoadError}
            </p>
          </div>
        ) : null}
        {rankLoading && ranked.length === 0 && !rankLoadError ? (
          <RankedListSkeleton />
        ) : null}
        {ranked.length > 0 ? (
          <div className="space-y-1">
            {rankLoading ? (
              <p className="text-[10px] text-app-fg-subtle" aria-live="polite">
                Updating ranking…
              </p>
            ) : null}
            <p className="text-[10px] text-app-fg-muted" suppressHydrationWarning>
              Ranking for{" "}
              <time dateTime={forecastAtIso}>
                {new Date(forecastAtIso).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              . Met.no / Yr in Europe (terrain elevation) where available; otherwise Open-Meteo.
            </p>
            <p className="text-[10px] font-medium text-app-fg-muted">
              Areas (best score first) — tap to fly the map here
            </p>
            <ul className="max-h-52 space-y-0 overflow-auto rounded-xl bg-app-surface-muted text-[11px] leading-snug text-app-fg-muted ring-1 ring-app-border-subtle">
              {ranked.map((r, idx) => (
                <RankedAreaRow
                  key={r.areaId}
                  area={r}
                  index={idx}
                  onSelect={focusRankedAreaOnMap}
                />
              ))}
            </ul>
          </div>
        ) : !rankLoading && !rankLoadError ? (
          <p className="text-[10px] text-app-fg-subtle">
            {isAuthed
              ? "No ranked areas yet — add a practice polygon or mark an area public."
              : "No public areas for this sport yet — check the other sport or sign in to explore private spots you have saved."}
          </p>
        ) : null}
        {isAuthed ? (
          rankingPrefsLoading || !rankingForm ? (
            <ScoringPrefsSkeleton />
          ) : (
            <PersistedCollapsible
              title={`Your forecast scoring — ${activeSport === "kiteski" ? "kite ski" : "kite surf"}`}
              summaryCollapsed={scoringSummaryCollapsed}
              storageKey="mapHub.scoringPrefsExpanded"
            >
              <p className="text-[10px] leading-snug text-app-fg-muted">
                Wind speed window and ideal band set how strongly forecast speed matches your sport.
                Weights scale wind fit, gust penalty, and how much direction matters before the
                experience boost.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-app-fg-muted">Min wind (m/s)</span>
                  <input
                    type="number"
                    min={0.5}
                    max={60}
                    step={0.5}
                    value={rankingForm[activeSport].minWindMs}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) patchActiveSportRanking({ minWindMs: v });
                    }}
                    className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-app-fg-muted">Max wind (m/s)</span>
                  <input
                    type="number"
                    min={0.5}
                    max={60}
                    step={0.5}
                    value={rankingForm[activeSport].maxWindMs}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) patchActiveSportRanking({ maxWindMs: v });
                    }}
                    className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-app-fg-muted">Ideal min (m/s)</span>
                  <input
                    type="number"
                    min={0.5}
                    max={60}
                    step={0.5}
                    value={rankingForm[activeSport].idealMinMs}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) patchActiveSportRanking({ idealMinMs: v });
                    }}
                    className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-app-fg-muted">Ideal max (m/s)</span>
                  <input
                    type="number"
                    min={0.5}
                    max={60}
                    step={0.5}
                    value={rankingForm[activeSport].idealMaxMs}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) patchActiveSportRanking({ idealMaxMs: v });
                    }}
                    className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-app-fg-muted">
                  Wind speed fit weight ×{rankingForm[activeSport].windFitScale.toFixed(2)}
                </span>
                <input
                  type="range"
                  min={0.25}
                  max={2}
                  step={0.05}
                  value={rankingForm[activeSport].windFitScale}
                  onChange={(e) =>
                    patchActiveSportRanking({ windFitScale: Number(e.target.value) })
                  }
                  className="w-full accent-app-accent"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-app-fg-muted">
                  Gust penalty ×{rankingForm[activeSport].gustPenaltyScale.toFixed(2)} (0 = ignore gusts)
                </span>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={rankingForm[activeSport].gustPenaltyScale}
                  onChange={(e) =>
                    patchActiveSportRanking({ gustPenaltyScale: Number(e.target.value) })
                  }
                  className="w-full accent-app-accent"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-app-fg-muted">
                  Direction emphasis {(rankingForm[activeSport].directionEmphasis * 100).toFixed(0)}%
                  (0 = ignore direction match)
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={rankingForm[activeSport].directionEmphasis}
                  onChange={(e) =>
                    patchActiveSportRanking({ directionEmphasis: Number(e.target.value) })
                  }
                  className="w-full accent-app-accent"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={hubBtnPrimary} onClick={() => void saveRankingPrefsForActiveSport()}>
                  Save scoring
                </button>
                <button
                  type="button"
                  className={hubBtnSecondary}
                  onClick={() => void resetRankingPrefsForActiveSport()}
                >
                  Use defaults (this sport)
                </button>
              </div>
            </PersistedCollapsible>
          )
        ) : (
          <p className="mt-3 text-[10px] leading-snug text-app-fg-subtle">
            <Link href="/login" className="font-medium text-app-accent-hover underline-offset-2 hover:underline">
              Sign in
            </Link>{" "}
            to set your own wind bands and scoring weights for the ranked list.
          </p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="How spots are ranked"
        summary={windRankSummary}
        open={toolSectionsOpen.windRank}
        onToggle={() => toggleToolSection("windRank")}
      >
        <div className="flex flex-col gap-2">
          <p className="text-[11px] leading-snug text-app-fg-muted">
            Optimal wind is <strong>per practice area</strong> only. Open an area →{" "}
            <strong>Edit area</strong> to draw direction on the map or type degrees. Areas without
            an optimal get <strong>no direction penalty</strong> (unless you use saved wind sectors).
          </p>
          {mapMode === "pickWind" ? (
            <div className="space-y-2 rounded-2xl border border-app-border bg-gradient-to-b from-app-accent-soft to-app-surface p-3 shadow-inner shadow-app-fg/5">
              <p className="text-[10px] font-medium text-app-accent-hover">
                Saving to the open practice area — see the edit panel for tips.
              </p>
              <p className="text-[11px] leading-snug text-app-fg">
                {windPickStart == null ? (
                  <>
                    <strong>1.</strong> Click the <strong>tail</strong> of the arrow (upwind / where
                    wind comes toward you).
                  </>
                ) : (
                  <>
                    <strong>2.</strong> Click the <strong>head</strong> — arrow points where the wind{" "}
                    <strong>blows</strong> (downwind).
                  </>
                )}
              </p>
              <button type="button" className={`w-full ${hubBtnSecondary}`} onClick={() => cancelPickWind()}>
                Cancel drawing
              </button>
              <p className="text-[10px] text-app-fg-muted">
                <kbd className="rounded-md bg-app-accent-muted px-1 py-0.5">Esc</kbd> cancel · right-click
                resets tail
              </p>
            </div>
          ) : null}
        </div>
        <label className="mt-2 flex flex-col gap-1">
          <span className="text-xs font-medium text-app-fg-muted">
            Match width ±{optimalWindHalfWidthDeg}° (~{Math.round((optimalWindHalfWidthDeg / 180) * 100)}%
            of half-circle)
          </span>
          <input
            type="range"
            min={5}
            max={90}
            value={optimalWindHalfWidthDeg}
            onChange={(e) => setOptimalWindHalfWidthDeg(Number(e.target.value))}
            className="w-full accent-app-accent"
          />
          <span className="text-[10px] leading-snug text-app-fg-subtle">
            Full direction score when forecast is within this window of each area’s saved optimal.
            Wider = more forgiving; also scales the bonus inside saved wind sectors.
          </span>
        </label>
        <p className="mt-2 text-[10px] leading-snug text-app-fg-subtle">
          When a practice area is selected and has an optimal, a short <strong>downwind</strong> arrow
          is shown from that area’s centre (inside the polygon).
        </p>
        <label className="mt-1 flex flex-col gap-1">
          <span className="text-xs font-medium text-app-fg-muted">
            Saved-area sector half-width: {sectorHalfWidthDeg}°
          </span>
          <input
            type="range"
            min={15}
            max={90}
            value={sectorHalfWidthDeg}
            onChange={(e) => setSectorHalfWidthDeg(Number(e.target.value))}
            className="w-full accent-app-accent"
          />
          <span className="text-[10px] text-app-fg-subtle">
            Used in <strong>Edit area</strong> when saving a wind sector arc around the area’s optimal
            bearing.
          </span>
        </label>
        <p className="mt-2 text-[10px] leading-snug text-app-fg-subtle">
          Min/max wind, ideal band, and score weights are in <strong>Forecast &amp; ranked areas</strong>{" "}
          above. This section is for direction match width and drawing optimal wind on the map.
        </p>
        <div className="flex flex-wrap gap-2 text-[10px] text-app-fg-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-4 rounded-sm bg-[var(--app-rank-strong)]" />
            strong
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-4 rounded-sm bg-[var(--app-rank-ok)]" />
            ok
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-4 rounded-sm bg-[var(--app-rank-weak)]" />
            weak
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-4 rounded-sm bg-[var(--app-rank-poor)]" />
            poor
          </span>
        </div>
      </CollapsibleSection>
    </>
  );
}
