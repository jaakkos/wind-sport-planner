"use client";

import { useCallback, useState } from "react";
import { requestExpandMapHelp } from "@/components/map-hub/MapHubDisclosures";
import { hubBtnSecondarySm } from "@/components/map-hub/hubUi";
import { hubOverlayZ } from "@/components/map-hub/mapHubOverlayZ";

const LEGEND_DISMISSED_KEY = "mapHub.mapLegendDismissed";

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(LEGEND_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Compact map symbology key; dismiss hides until user restores via “Map key”.
 * Phase C — docs/ui-roadmap §6.
 */
export function MapHubLegend({
  onBeforeOpenHelp,
  avoidEditPanelOverlap = false,
}: {
  onBeforeOpenHelp?: () => void;
  /**
   * When the practice-area edit panel is open (right column), nudge the legend out of that stack
   * so it does not sit under the higher z-index drawer.
   */
  avoidEditPanelOverlap?: boolean;
}) {
  const [dismissed, setDismissed] = useState(readDismissed);

  /** Edit panel is `w-80` + `right-2`; on narrow screens we tuck the legend bottom-left instead. */
  const cornerPosition = avoidEditPanelOverlap
    ? "bottom-2 right-[calc(20rem+1rem)] max-sm:right-auto max-sm:left-2"
    : "bottom-2 right-2";

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(LEGEND_DISMISSED_KEY, "true");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  const restore = useCallback(() => {
    try {
      localStorage.removeItem(LEGEND_DISMISSED_KEY);
    } catch {
      /* ignore */
    }
    setDismissed(false);
  }, []);

  const learnMore = useCallback(() => {
    onBeforeOpenHelp?.();
    requestExpandMapHelp();
    window.setTimeout(() => {
      document.getElementById("map-hub-help-disclosure")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 120);
  }, [onBeforeOpenHelp]);

  if (dismissed) {
    return (
      <div
        className={`absolute ${cornerPosition} ${hubOverlayZ.mapPopover} flex flex-col gap-1 ${
          avoidEditPanelOverlap ? "max-sm:items-start sm:items-end" : "items-end"
        }`}
      >
        <button
          type="button"
          onClick={restore}
          className={`${hubBtnSecondarySm} shadow-[var(--app-shadow-hub)]`}
          title="Show map legend"
        >
          Map key
        </button>
      </div>
    );
  }

  return (
    <div
      className={`absolute ${cornerPosition} ${hubOverlayZ.mapPopover} max-h-[min(40vh,16rem)] max-w-[min(18rem,calc(100vw-5.5rem))] overflow-y-auto rounded-2xl border border-app-border bg-app-surface/95 p-2.5 text-[10px] leading-snug text-app-fg-muted shadow-[var(--app-shadow-hub)] backdrop-blur-sm`}
      role="region"
      aria-label="Map legend"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[11px] font-semibold text-app-fg">Map key</h2>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] text-app-fg-subtle hover:bg-app-surface-muted hover:text-app-fg"
          aria-label="Dismiss legend"
        >
          ✕
        </button>
      </div>
      <ul className="mt-1.5 list-inside list-disc space-y-1.5">
        <li>
          <span className="font-medium text-app-fg">Polygons</span> — fill colour reflects rank for the
          forecast time (green → yellow → orange → grey). The selected area gets a stronger outline;
          shared areas use a lighter fill.
        </li>
        <li className="flex gap-1.5">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-sky-600 ring-1 ring-white/80" aria-hidden />
          <span>
            <span className="font-medium text-app-fg">Blue dots</span> — forecast sample points (hourly
            model at that spot).
          </span>
        </li>
        <li>
          <span className="font-medium text-app-fg">Arrows</span> — wind along the span of the polygon
          (direction and strength in context).
        </li>
      </ul>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={learnMore} className={hubBtnSecondarySm}>
          How ranking works
        </button>
        <button type="button" onClick={dismiss} className={hubBtnSecondarySm}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
