"use client";

import Link from "next/link";

import { CollapsibleSection } from "@/components/map-hub/CollapsibleSection";
import { ForecastTimeControl } from "@/components/map-hub/ForecastTimeControl";
import { HelpDisclosure, PersistedCollapsible } from "@/components/map-hub/MapHubDisclosures";
import { RankedAreaRow } from "@/components/map-hub/RankedAreaRow";
import { RankedListSkeleton, ScoringPrefsSkeleton } from "@/components/map-hub/hubSkeleton";
import { hubBtnPrimary, hubBtnSecondary } from "@/components/map-hub/hubUi";
import type { ToolSectionKey } from "@/components/map-hub/constants";
import type {
  MultiPointForecastFormState,
  RankingForm,
} from "@/components/map-hub/hooks/useRankingPreferences";
import type { RankedPracticeArea } from "@/lib/heuristics/rankAreaTypes";
import { floorToHourMs } from "@/lib/map/mapHubHelpers";

type Props = {
  // Sport
  activeSport: "kiteski" | "kitesurf";
  setActiveSport: (next: "kiteski" | "kitesurf") => void;

  // Section state
  toolSectionsOpen: { sport: boolean; forecast: boolean; windRank: boolean };
  toggleToolSection: (key: ToolSectionKey) => void;

  // Forecast time
  hoursAhead: number;
  setHoursAhead: (h: number) => void;
  forecastAtIso: string;
  setForecastAnchorMs: (ms: number) => void;

  // Ranking list
  forecastSummary: string;
  rankLoadError: string | null;
  rankLoading: boolean;
  ranked: ReadonlyArray<RankedPracticeArea>;
  isAuthed: boolean;
  focusRankedAreaOnMap: (area: RankedPracticeArea) => void;

  // Scoring prefs
  rankingPrefsLoading: boolean;
  rankingForm: RankingForm | null;
  multiPointForm: MultiPointForecastFormState | null;
  scoringSummaryCollapsed: string;
  patchActiveSportRanking: (
    patch: Partial<RankingForm["kiteski"]>,
  ) => void;
  patchMultiPoint: (patch: Partial<MultiPointForecastFormState>) => void;
  saveRankingPrefsForActiveSport: () => void | Promise<void>;
  resetRankingPrefsForActiveSport: () => void | Promise<void>;

  // Wind rank section
  windRankSummary: string;
  mapMode: "browse" | "draw" | "pickWind";
  windPickStart: unknown;
  cancelPickWind: () => void;
  optimalWindHalfWidthDeg: number;
  setOptimalWindHalfWidthDeg: (deg: number) => void;
  sectorHalfWidthDeg: number;
  setSectorHalfWidthDeg: (deg: number) => void;
};

/**
 * "Plan" sidebar tab — sport switcher, forecast time control, ranked
 * list of practice areas, scoring/sampling preferences, and the
 * "How spots are ranked" educational section. All state is owned by
 * MapHub; this component is a controlled view.
 */
export function PlanTab(props: Props) {
  return (
    <>
      <SportSection {...props} />
      <ForecastSection {...props} />
      <WindRankSection {...props} />
    </>
  );
}

function SportSection({
  activeSport,
  setActiveSport,
  toolSectionsOpen,
  toggleToolSection,
}: Pick<
  Props,
  "activeSport" | "setActiveSport" | "toolSectionsOpen" | "toggleToolSection"
>) {
  return (
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
  );
}

function ForecastSection({
  forecastSummary,
  toolSectionsOpen,
  toggleToolSection,
  hoursAhead,
  setHoursAhead,
  forecastAtIso,
  setForecastAnchorMs,
  rankLoadError,
  rankLoading,
  ranked,
  isAuthed,
  focusRankedAreaOnMap,
  activeSport,
  rankingPrefsLoading,
  rankingForm,
  multiPointForm,
  scoringSummaryCollapsed,
  patchActiveSportRanking,
  patchMultiPoint,
  saveRankingPrefsForActiveSport,
  resetRankingPrefsForActiveSport,
}: Props) {
  return (
    <CollapsibleSection
      title="Forecast & ranked areas"
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
          Open-Meteo). Many small <strong>downwind</strong> SVG arrows sit <strong>under</strong> the
          tinted area fill (map rotation keeps them aligned with true north). Labels: wind{" "}
          <strong>from</strong> (meteorology), whole m/s with gust in parentheses.{" "}
          <strong>Sky dot</strong> at each area centre opens Yr.no <strong>hourly</strong> forecast (new
          tab) for that point; <strong>Shift+click</strong> elsewhere does the same. <strong>Vis</strong>{" "}
          when shown is modelled visibility — not used in score. Large or hilly areas may show a{" "}
          <strong>speed range</strong> and <strong>spot count</strong> when multi-point forecast runs (see
          scoring settings when signed in; guests use a smaller cap).
        </p>
      </HelpDisclosure>
      {rankLoadError && !rankLoading ? (
        <div className="space-y-2">
          <p className="rounded-xl bg-app-warning-bg p-2.5 text-[10px] leading-snug text-app-warning-fg ring-1 ring-app-warning-border">
            {rankLoadError}
            <span className="mt-1.5 block text-app-fg-muted">
              Practice polygons may still appear on the map once the view fits your areas. Check the
              terminal or network tab for{" "}
              <code className="rounded bg-white/60 px-0.5">/api/forecast/rank</code>.
            </span>
          </p>
        </div>
      ) : null}
      {rankLoading && ranked.length === 0 && !rankLoadError ? <RankedListSkeleton /> : null}
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
        rankingPrefsLoading || !rankingForm || !multiPointForm ? (
          <ScoringPrefsSkeleton />
        ) : (
          <ScoringPrefsForm
            activeSport={activeSport}
            scoringSummaryCollapsed={scoringSummaryCollapsed}
            rankingForm={rankingForm}
            multiPointForm={multiPointForm}
            patchActiveSportRanking={patchActiveSportRanking}
            patchMultiPoint={patchMultiPoint}
            saveRankingPrefsForActiveSport={saveRankingPrefsForActiveSport}
            resetRankingPrefsForActiveSport={resetRankingPrefsForActiveSport}
          />
        )
      ) : (
        <p className="mt-3 text-[10px] leading-snug text-app-fg-subtle">
          <Link
            href="/login"
            className="font-medium text-app-accent-hover underline-offset-2 hover:underline"
          >
            Sign in
          </Link>{" "}
          to set your own wind bands and scoring weights for the ranked list.
        </p>
      )}
    </CollapsibleSection>
  );
}

function ScoringPrefsForm({
  activeSport,
  scoringSummaryCollapsed,
  rankingForm,
  multiPointForm,
  patchActiveSportRanking,
  patchMultiPoint,
  saveRankingPrefsForActiveSport,
  resetRankingPrefsForActiveSport,
}: {
  activeSport: "kiteski" | "kitesurf";
  scoringSummaryCollapsed: string;
  rankingForm: RankingForm;
  multiPointForm: MultiPointForecastFormState;
  patchActiveSportRanking: Props["patchActiveSportRanking"];
  patchMultiPoint: Props["patchMultiPoint"];
  saveRankingPrefsForActiveSport: Props["saveRankingPrefsForActiveSport"];
  resetRankingPrefsForActiveSport: Props["resetRankingPrefsForActiveSport"];
}) {
  const sportPrefs = rankingForm[activeSport];
  return (
    <PersistedCollapsible
      title={`Your forecast scoring — ${activeSport === "kiteski" ? "kite ski" : "kite surf"}`}
      summaryCollapsed={scoringSummaryCollapsed}
      storageKey="mapHub.scoringPrefsExpanded"
    >
      <p className="text-[10px] leading-snug text-app-fg-muted">
        Wind speed window and ideal band set how strongly forecast speed matches your sport. Weights
        scale wind fit, gust penalty, and how much direction matters before the experience boost.
      </p>
      <div className="rounded-xl border border-app-info-border bg-app-info-bg p-2.5 ring-1 ring-app-border-subtle">
        <p className="text-[10px] font-semibold text-app-info-fg-strong">Area forecast sampling</p>
        <p className="mt-1 text-[10px] leading-snug text-app-info-fg">
          <strong>Auto</strong> adds extra API calls when the polygon is wide (≈3+ km) or terrain
          varies a lot inside it. <strong>On</strong> always samples up to your max spots.{" "}
          <strong>Conservative</strong> scoring uses the weakest wind and strictest direction match
          among spots; <strong>representative</strong> uses medians and mean direction.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-app-info-fg-strong">Mode</span>
            <select
              value={multiPointForm.mode}
              onChange={(e) =>
                patchMultiPoint({
                  mode: e.target.value as MultiPointForecastFormState["mode"],
                })
              }
              className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
            >
              <option value="off">Off (centre only)</option>
              <option value="auto">Auto (large / hilly areas)</option>
              <option value="on">On (always multi-spot)</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-app-info-fg-strong">Max spots (3–9)</span>
            <input
              type="number"
              min={3}
              max={9}
              step={1}
              value={multiPointForm.maxSamples}
              onChange={(e) => {
                const v = Math.round(Number(e.target.value));
                if (!Number.isFinite(v)) return;
                patchMultiPoint({ maxSamples: Math.min(9, Math.max(3, v)) });
              }}
              className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-app-info-fg-strong">Collapse policy</span>
            <select
              value={multiPointForm.scoringPolicy}
              onChange={(e) =>
                patchMultiPoint({
                  scoringPolicy: e.target.value as MultiPointForecastFormState["scoringPolicy"],
                })
              }
              className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
            >
              <option value="conservative">Conservative (min wind / strict dir)</option>
              <option value="representative">Representative (median / mean dir)</option>
            </select>
          </label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumericField
          label="Min wind (m/s)"
          value={sportPrefs.minWindMs}
          onChange={(v) => patchActiveSportRanking({ minWindMs: v })}
        />
        <NumericField
          label="Max wind (m/s)"
          value={sportPrefs.maxWindMs}
          onChange={(v) => patchActiveSportRanking({ maxWindMs: v })}
        />
        <NumericField
          label="Ideal min (m/s)"
          value={sportPrefs.idealMinMs}
          onChange={(v) => patchActiveSportRanking({ idealMinMs: v })}
        />
        <NumericField
          label="Ideal max (m/s)"
          value={sportPrefs.idealMaxMs}
          onChange={(v) => patchActiveSportRanking({ idealMaxMs: v })}
        />
      </div>
      <SliderField
        label={`Wind speed fit weight ×${sportPrefs.windFitScale.toFixed(2)}`}
        value={sportPrefs.windFitScale}
        min={0.25}
        max={2}
        step={0.05}
        onChange={(v) => patchActiveSportRanking({ windFitScale: v })}
      />
      <SliderField
        label={`Gust penalty ×${sportPrefs.gustPenaltyScale.toFixed(2)} (0 = ignore gusts)`}
        value={sportPrefs.gustPenaltyScale}
        min={0}
        max={2}
        step={0.05}
        onChange={(v) => patchActiveSportRanking({ gustPenaltyScale: v })}
      />
      <SliderField
        label={`Direction emphasis ${(sportPrefs.directionEmphasis * 100).toFixed(0)}% (0 = ignore direction match)`}
        value={sportPrefs.directionEmphasis}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => patchActiveSportRanking({ directionEmphasis: v })}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={hubBtnPrimary}
          onClick={() => void saveRankingPrefsForActiveSport()}
        >
          Save scoring &amp; sampling
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
  );
}

function NumericField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-app-fg-muted">{label}</span>
      <input
        type="number"
        min={0.5}
        max={60}
        step={0.5}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
      />
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-app-fg-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-app-accent"
      />
    </label>
  );
}

function WindRankSection({
  windRankSummary,
  toolSectionsOpen,
  toggleToolSection,
  mapMode,
  windPickStart,
  cancelPickWind,
  optimalWindHalfWidthDeg,
  setOptimalWindHalfWidthDeg,
  sectorHalfWidthDeg,
  setSectorHalfWidthDeg,
}: Props) {
  return (
    <CollapsibleSection
      title="How spots are ranked"
      summary={windRankSummary}
      open={toolSectionsOpen.windRank}
      onToggle={() => toggleToolSection("windRank")}
    >
      <div className="flex flex-col gap-2">
        {mapMode === "pickWind" ? (
          <div className="space-y-2 rounded-2xl border border-app-border bg-gradient-to-b from-app-accent-soft to-app-surface p-3 shadow-inner shadow-app-fg/5">
            <p className="text-[10px] font-medium text-app-accent-hover">
              Saving to the open practice area — see the edit panel for tips.
            </p>
            <p className="text-[11px] leading-snug text-app-fg">
              {windPickStart == null ? (
                <>
                  <strong>1.</strong> Click the <strong>tail</strong> of the arrow (upwind / where wind
                  comes toward you).
                </>
              ) : (
                <>
                  <strong>2.</strong> Click the <strong>head</strong> — arrow points where the wind{" "}
                  <strong>blows</strong> (downwind).
                </>
              )}
            </p>
            <button
              type="button"
              className={`w-full ${hubBtnSecondary}`}
              onClick={() => cancelPickWind()}
            >
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
          Match width ±{optimalWindHalfWidthDeg}° (~
          {Math.round((optimalWindHalfWidthDeg / 180) * 100)}% of half-circle)
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
          Full direction score when forecast is within this window of each area’s saved optimal. Wider
          = more forgiving; also scales the bonus inside saved wind sectors.
        </span>
      </label>
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
      <HelpDisclosure
        title="How spots are scored"
        storageKey="mapHub.helpScoringExpanded"
      >
        <p>
          Optimal wind is <strong>per practice area</strong> only. Open an area →{" "}
          <strong>Edit area</strong> to draw direction on the map or type degrees. Areas without an
          optimal get <strong>no direction penalty</strong> (unless you use saved wind sectors).
        </p>
        <p className="mt-1.5">
          <strong>Multi-spot forecast</strong> (when enabled) fetches several grid-aligned points
          inside each polygon with per-spot elevation for Met.no. Scores combine those samples:
          conservative mode penalises using the lowest wind speed and the worst direction match; gust
          penalty uses the strongest gust vs median speed.
        </p>
        <p className="mt-1.5">
          When a practice area is selected and has an optimal, a short <strong>downwind</strong>{" "}
          arrow is shown from that area’s centre. Min/max wind, ideal band, and score weights live in{" "}
          <strong>Forecast &amp; ranked areas</strong> above.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-app-fg-muted">
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
      </HelpDisclosure>
    </CollapsibleSection>
  );
}
