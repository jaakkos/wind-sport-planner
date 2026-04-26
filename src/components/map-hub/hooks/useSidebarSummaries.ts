"use client";

import { useMemo } from "react";

import type {
  MultiPointForecastFormState,
  RankingForm,
} from "@/components/map-hub/hooks/useRankingPreferences";

type Args = {
  isAuthed: boolean;
  sessionPending: boolean;
  activeSport: "kiteski" | "kitesurf";
  mapMode: "browse" | "draw" | "pickWind";
  optimalWindHalfWidthDeg: number;
  rankingForm: RankingForm | null;
  multiPointForm: MultiPointForecastFormState | null;
  hoursAhead: number;
  rankedCount: number;
};

/**
 * Builds the short status strings shown next to the Plan tab's
 * collapsible sections. Pure derivation; kept out of MapHub so the
 * composition root stays focused on wiring.
 */
export function useSidebarSummaries({
  isAuthed,
  sessionPending,
  activeSport,
  mapMode,
  optimalWindHalfWidthDeg,
  rankingForm,
  multiPointForm,
  hoursAhead,
  rankedCount,
}: Args) {
  const windRankSummary = useMemo(() => {
    if (mapMode === "pickWind") {
      return "Drawing optimal wind for practice area…";
    }
    const pctHalf = Math.round((optimalWindHalfWidthDeg / 180) * 100);
    let band = "";
    if (isAuthed && rankingForm) {
      const w = rankingForm[activeSport];
      band = ` · ${w.minWindMs}–${w.maxWindMs} m/s`;
    }
    return `Per-area optimal · match width ±${optimalWindHalfWidthDeg}° (${pctHalf}% half-circle)${band}`;
  }, [mapMode, optimalWindHalfWidthDeg, isAuthed, rankingForm, activeSport]);

  const forecastSummary = useMemo(() => {
    const rel =
      hoursAhead === 0
        ? "anchored to this hour"
        : `+${hoursAhead}h from the anchor hour`;
    const scoringHint = sessionPending
      ? ""
      : isAuthed && rankingForm
        ? " · scoring below"
        : !isAuthed
          ? " · sign in for custom scoring"
          : "";
    return `${rankedCount} area(s) · ${rel}${scoringHint}`;
  }, [hoursAhead, rankedCount, sessionPending, isAuthed, rankingForm]);

  const scoringSummaryCollapsed = useMemo(() => {
    if (!rankingForm || !multiPointForm) return "Customize wind bands, sampling & weights";
    const w = rankingForm[activeSport];
    const modeLabel =
      multiPointForm.mode === "off"
        ? "centre only"
        : multiPointForm.mode === "auto"
          ? "auto multi-spot"
          : "multi-spot on";
    return `${w.minWindMs}–${w.maxWindMs} m/s · ${modeLabel}`;
  }, [rankingForm, multiPointForm, activeSport]);

  return { windRankSummary, forecastSummary, scoringSummaryCollapsed };
}
