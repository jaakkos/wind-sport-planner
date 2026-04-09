/* Small static favicons in links — match prior MapHub markup. */
/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import { yrNoDailyTableUrlEn, yrNoHourlyTableUrlEn } from "@/lib/yrNoUrls";
import { hubOverlayZ } from "@/components/map-hub/mapHubOverlayZ";
import type { ClickTerrain } from "./types";
import { ExternalTabIcon } from "./ExternalTabIcon";

export function TerrainClickPanel({
  terrain,
  onClose,
  style,
}: {
  terrain: ClickTerrain;
  onClose: () => void;
  /** When set (e.g. from map click), panel is anchored in the map stack instead of bottom-left. */
  style?: CSSProperties;
}) {
  return (
    <div
      className={`absolute max-w-xs rounded-2xl border border-app-border-subtle bg-app-surface/95 p-3 text-xs shadow-[var(--app-shadow-hub)] backdrop-blur-sm ${hubOverlayZ.mapPopover}`}
      style={style}
    >
      <div className="flex justify-between gap-2">
        <span className="font-medium text-app-fg">Terrain</span>
        <button type="button" className="text-app-fg-subtle" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <p className="mt-1 font-mono text-[11px] text-app-fg-muted">
        {terrain.lat.toFixed(5)}, {terrain.lng.toFixed(5)}
      </p>
      {terrain.loading ? (
        <p className="text-app-fg-subtle">Elevation…</p>
      ) : terrain.error ? (
        <p className="text-app-danger">{terrain.error}</p>
      ) : (
        <p className="text-app-fg">
          <strong>{terrain.elevationM != null ? `${Math.round(terrain.elevationM)} m` : "—"}</strong>{" "}
          AMSL
        </p>
      )}
      <div className="mt-2 flex flex-col gap-1.5">
        <a
          href={yrNoHourlyTableUrlEn(terrain.lat, terrain.lng)}
          target="_blank"
          rel="noopener noreferrer"
          title="Opens yr.no in a new tab"
          aria-label="Open Yr.no hourly forecast in a new tab"
          className="flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-2.5 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          <img
            src="/yr-external.ico"
            alt=""
            width={18}
            height={18}
            decoding="async"
            className="h-[18px] w-[18px] shrink-0 rounded-[4px] bg-white/10 ring-1 ring-white/25"
          />
          <span className="min-w-0 text-center leading-tight">Hourly forecast (point)</span>
          <ExternalTabIcon className="h-3 w-3 shrink-0 opacity-90" />
        </a>
        <a
          href={yrNoDailyTableUrlEn(terrain.lat, terrain.lng)}
          target="_blank"
          rel="noopener noreferrer"
          title="Opens yr.no in a new tab"
          aria-label="Open Yr.no long-term table in a new tab"
          className="flex items-center justify-center gap-2 text-center text-[10px] font-medium text-sky-800 underline-offset-2 hover:underline"
        >
          <img
            src="/yr-external.ico"
            alt=""
            width={16}
            height={16}
            decoding="async"
            className="h-4 w-4 shrink-0 rounded-[3px] ring-1 ring-sky-900/15"
          />
          <span>Long-term table</span>
          <ExternalTabIcon className="h-3 w-3 shrink-0 text-sky-700 opacity-90" />
        </a>
      </div>
    </div>
  );
}
