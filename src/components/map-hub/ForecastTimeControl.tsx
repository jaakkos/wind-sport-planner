"use client";

import { FORECAST_SLIDER_MAX_H } from "./constants";

/**
 * Forecast hour slider + anchor display + Now — Plan tab (roadmap §5.2).
 */
export function ForecastTimeControl({
  hoursAhead,
  setHoursAhead,
  forecastAtIso,
  setForecastAnchorMs,
  floorToHourMs,
  sliderMaxH = FORECAST_SLIDER_MAX_H,
}: {
  hoursAhead: number;
  setHoursAhead: (n: number) => void;
  forecastAtIso: string;
  setForecastAnchorMs: (ms: number) => void;
  floorToHourMs: (d?: Date) => number;
  /** Override max hours for the range input (defaults to shared constant). */
  sliderMaxH?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-app-fg">Forecast time</span>
      <input
        type="range"
        aria-label="Hours ahead of anchor hour for forecast"
        min={0}
        max={sliderMaxH}
        step={1}
        value={hoursAhead}
        onChange={(e) => setHoursAhead(Number(e.target.value))}
        className="w-full accent-app-accent"
      />
      <p
        className="text-xs font-medium text-app-fg"
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
      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-app-fg-muted">
        <span>
          Anchor +{hoursAhead}h (max {sliderMaxH}h)
        </span>
        <button
          type="button"
          className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-[10px] font-medium text-app-accent-hover hover:bg-app-surface-muted"
          onClick={() => {
            setForecastAnchorMs(floorToHourMs());
            setHoursAhead(0);
          }}
        >
          Now
        </button>
      </div>
    </label>
  );
}
