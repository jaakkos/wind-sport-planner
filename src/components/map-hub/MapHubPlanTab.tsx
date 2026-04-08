import Link from "next/link";
import type { RankedPracticeArea } from "@/lib/heuristics/rankAreaTypes";
import { formatVisibilityM } from "@/lib/weather/formatVisibility";
import { windCompactSummary } from "@/lib/map/mapHubHelpers";
import { CollapsibleSection } from "./CollapsibleSection";
import { FORECAST_SLIDER_MAX_H } from "./constants";
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
            value={activeSport}
            onChange={(e) => setActiveSport(e.target.value as "kiteski" | "kitesurf")}
            className="w-full rounded-xl border border-teal-900/10 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner shadow-teal-900/[0.03] focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
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
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-800">Forecast time</span>
          <input
            type="range"
            min={0}
            max={FORECAST_SLIDER_MAX_H}
            step={1}
            value={hoursAhead}
            onChange={(e) => setHoursAhead(Number(e.target.value))}
            className="w-full accent-teal-600"
          />
          <p
            className="text-xs font-medium text-zinc-800"
            suppressHydrationWarning
            title="Shown in your device timezone after load"
          >
            {new Date(forecastAtIso).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-zinc-600">
            <span>
              Anchor +{hoursAhead}h (max {FORECAST_SLIDER_MAX_H}h)
            </span>
            <button
              type="button"
              className="rounded-lg border border-teal-200/80 bg-white px-2 py-1 text-[10px] font-medium text-teal-900 hover:bg-teal-50/80"
              onClick={() => {
                setForecastAnchorMs(floorToHourMs());
                setHoursAhead(0);
              }}
            >
              Now
            </button>
          </div>
          <p className="text-[10px] leading-snug text-zinc-500">
            Slider moves the forecast hour (Met.no / Yr in Europe with terrain elevation, otherwise
            Open-Meteo). Many small <strong>downwind</strong> SVG arrows sit <strong>under</strong> the tinted
            area fill (map rotation keeps them aligned with true north).{" "}
            Labels: wind <strong>from</strong> (meteorology), whole m/s with gust in parentheses.{" "}
            <strong>Sky dot</strong> at each area centre opens Yr.no <strong>hourly</strong> forecast (new
            tab) for that point; <strong>Shift+click</strong> elsewhere does the same. <strong>Vis</strong> when
            shown
            is modelled visibility — not used in score.
          </p>
        </label>
        {ranked.length > 0 ? (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-zinc-600">
              Areas (best score first) — tap to fly the map here
            </p>
            <ul className="max-h-52 space-y-0 overflow-auto rounded-xl bg-teal-50/20 text-[11px] leading-snug text-zinc-700 ring-1 ring-teal-900/5">
              {ranked.map((r, idx) => {
                const visLabel = r.wind ? formatVisibilityM(r.wind.visibilityM) : "—";
                return (
                  <li key={r.areaId} className="border-b border-teal-900/[0.06] last:border-0">
                    <button
                      type="button"
                      className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-teal-100/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600"
                      onClick={() => focusRankedAreaOnMap(r)}
                    >
                      <span className="flex items-start gap-2">
                        <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-[10px] text-zinc-400 tabular-nums">
                          {idx + 1}.
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-zinc-900">
                            {r.name.trim() ? r.name.trim() : `Area ${r.areaId.slice(0, 6)}`}
                          </span>
                          <span className="text-zinc-600">
                            {" · score "}
                            <strong className="text-zinc-900">{r.score}</strong>
                            {r.wind ? (
                              <>
                                {" · "}
                                {windCompactSummary(r.wind)}
                                {visLabel !== "—" ? (
                                  <>
                                    {" · vis "}
                                    {visLabel}
                                  </>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-zinc-400"> · no forecast</span>
                            )}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-[10px] text-zinc-500">
            {isAuthed
              ? "No ranked areas yet — add a practice polygon or mark an area public."
              : "No public areas for this sport yet — check the other sport or sign in to explore private spots you have saved."}
          </p>
        )}
        {isAuthed ? (
          rankingPrefsLoading || !rankingForm ? (
            <p className="mt-3 text-[10px] text-zinc-500">Loading your scoring settings…</p>
          ) : (
            <div className="mt-3 space-y-3 rounded-2xl border border-teal-200/80 bg-teal-50/30 p-3 ring-1 ring-teal-900/[0.06]">
              <p className="text-[11px] font-semibold text-zinc-800">
                Your forecast scoring — {activeSport === "kiteski" ? "kite ski" : "kite surf"}
              </p>
              <p className="text-[10px] leading-snug text-zinc-600">
                Wind speed window and ideal band set how strongly forecast speed matches your sport.
                Weights scale wind fit, gust penalty, and how much direction matters before the
                experience boost.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-zinc-700">Min wind (m/s)</span>
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
                    className="rounded-lg border border-teal-900/15 bg-white px-2 py-1 text-xs text-zinc-900"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-zinc-700">Max wind (m/s)</span>
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
                    className="rounded-lg border border-teal-900/15 bg-white px-2 py-1 text-xs text-zinc-900"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-zinc-700">Ideal min (m/s)</span>
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
                    className="rounded-lg border border-teal-900/15 bg-white px-2 py-1 text-xs text-zinc-900"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-zinc-700">Ideal max (m/s)</span>
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
                    className="rounded-lg border border-teal-900/15 bg-white px-2 py-1 text-xs text-zinc-900"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-zinc-700">
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
                  className="w-full accent-teal-600"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-zinc-700">
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
                  className="w-full accent-teal-600"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-zinc-700">
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
                  className="w-full accent-teal-600"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-teal-600/40 bg-teal-600 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-teal-700"
                  onClick={() => void saveRankingPrefsForActiveSport()}
                >
                  Save scoring
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-teal-900/15 bg-white px-3 py-2 text-[11px] font-medium text-zinc-800 hover:bg-teal-50/80"
                  onClick={() => void resetRankingPrefsForActiveSport()}
                >
                  Use defaults (this sport)
                </button>
              </div>
            </div>
          )
        ) : (
          <p className="mt-3 text-[10px] leading-snug text-zinc-500">
            <Link href="/login" className="font-medium text-teal-800 underline-offset-2 hover:underline">
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
          <p className="text-[11px] leading-snug text-zinc-600">
            Optimal wind is <strong>per practice area</strong> only. Open an area →{" "}
            <strong>Edit area</strong> to draw direction on the map or type degrees. Areas without
            an optimal get <strong>no direction penalty</strong> (unless you use saved wind sectors).
          </p>
          {mapMode === "pickWind" ? (
            <div className="space-y-2 rounded-2xl border border-violet-200/80 bg-gradient-to-b from-violet-50/95 to-white/90 p-3 shadow-inner shadow-violet-900/5">
              <p className="text-[10px] font-medium text-violet-950">
                Saving to the open practice area — see the edit panel for tips.
              </p>
              <p className="text-[11px] leading-snug text-violet-950">
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
              <button
                type="button"
                className="w-full rounded-xl border border-violet-300/80 bg-white px-2 py-2 text-[11px] font-medium text-violet-900 hover:bg-violet-50"
                onClick={() => cancelPickWind()}
              >
                Cancel drawing
              </button>
              <p className="text-[10px] text-violet-800/90">
                <kbd className="rounded-md bg-violet-200/80 px-1 py-0.5">Esc</kbd> cancel · right-click
                resets tail
              </p>
            </div>
          ) : null}
        </div>
        <label className="mt-2 flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">
            Match width ±{optimalWindHalfWidthDeg}° (~{Math.round((optimalWindHalfWidthDeg / 180) * 100)}%
            of half-circle)
          </span>
          <input
            type="range"
            min={5}
            max={90}
            value={optimalWindHalfWidthDeg}
            onChange={(e) => setOptimalWindHalfWidthDeg(Number(e.target.value))}
            className="w-full"
          />
          <span className="text-[10px] leading-snug text-zinc-500">
            Full direction score when forecast is within this window of each area’s saved optimal.
            Wider = more forgiving; also scales the bonus inside saved wind sectors.
          </span>
        </label>
        <p className="mt-2 text-[10px] leading-snug text-zinc-500">
          When a practice area is selected and has an optimal, a short <strong>downwind</strong> arrow
          is shown from that area’s centre (inside the polygon).
        </p>
        <label className="mt-1 flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-700">
            Saved-area sector half-width: {sectorHalfWidthDeg}°
          </span>
          <input
            type="range"
            min={15}
            max={90}
            value={sectorHalfWidthDeg}
            onChange={(e) => setSectorHalfWidthDeg(Number(e.target.value))}
            className="w-full"
          />
          <span className="text-[10px] text-zinc-500">
            Used in <strong>Edit area</strong> when saving a wind sector arc around the area’s optimal
            bearing.
          </span>
        </label>
        <p className="mt-2 text-[10px] leading-snug text-zinc-500">
          Min/max wind, ideal band, and score weights are in <strong>Forecast &amp; ranked areas</strong>{" "}
          above. This section is for direction match width and drawing optimal wind on the map.
        </p>
        <div className="flex flex-wrap gap-2 text-[10px] text-zinc-600">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-4 rounded-sm" style={{ background: "#22c55e" }} />
            strong
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-4 rounded-sm" style={{ background: "#eab308" }} />
            ok
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-4 rounded-sm" style={{ background: "#f97316" }} />
            weak
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-4 rounded-sm" style={{ background: "#94a3b8" }} />
            poor
          </span>
        </div>
      </CollapsibleSection>
    </>
  );
}
