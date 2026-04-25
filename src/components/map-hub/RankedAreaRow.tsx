"use client";

import type { RankedPracticeArea } from "@/lib/heuristics/rankAreaTypes";
import { windCompactSummary, windMultiPointSubtitle } from "@/lib/map/windFormat";
import { formatVisibilityM } from "@/lib/weather/formatVisibility";

/**
 * One ranked practice area row — tap to focus on map (roadmap §5.2).
 */
export function RankedAreaRow({
  area: r,
  index,
  onSelect,
}: {
  area: RankedPracticeArea;
  index: number;
  onSelect: (area: RankedPracticeArea) => void;
}) {
  const visLabel = r.wind ? formatVisibilityM(r.wind.visibilityM) : "—";
  const mpSub = windMultiPointSubtitle(r.wind);

  return (
    <li className="border-b border-app-border-subtle last:border-0">
      <button
        type="button"
        className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-app-accent-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-app-accent"
        onClick={() => onSelect(r)}
      >
        <span className="flex items-start gap-2">
          <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-[10px] text-app-fg-subtle tabular-nums">
            {index + 1}.
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-medium text-app-fg">
              {r.name.trim() ? r.name.trim() : `Area ${r.areaId.slice(0, 6)}`}
            </span>
            <span className="text-app-fg-muted">
              {" · score "}
              <strong className="text-app-fg">{r.score}</strong>
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
                  {mpSub ? (
                    <span className="mt-0.5 block text-[10px] text-app-fg-subtle">{mpSub}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-app-fg-subtle"> · no forecast</span>
              )}
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}
