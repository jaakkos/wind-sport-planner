"use client";

import {
  hubBtnPrimary,
  hubBtnSecondary,
  hubBtnSecondarySm,
  hubInput,
  hubMeta,
  hubSectionTitle,
} from "@/components/map-hub/hubUi";

/**
 * Wind direction & sector controls for the area edit panel. Combines the
 * "draw on map" affordance with the "type degrees" form and the apply/clear
 * sector buttons. All persistence calls are passed in as callbacks.
 */
export function WindSection({
  areaWindPickActive,
  onDrawAreaOptimalWind,
  onCancelWindPick,
  optimalFromInput,
  onOptimalFromChange,
  optimalPreview,
  sectorsPreview,
  busy,
  onSaveAreaOptimal,
  onClearOptimal,
  onApplyWindSector,
  onClearWindSectors,
  onStartBoundaryEdit,
}: {
  areaWindPickActive: boolean;
  onDrawAreaOptimalWind: () => void;
  onCancelWindPick: () => void;
  optimalFromInput: string;
  onOptimalFromChange: (value: string) => void;
  optimalPreview: string;
  sectorsPreview: string;
  busy: boolean;
  onSaveAreaOptimal: () => void;
  onClearOptimal: () => void;
  onApplyWindSector: () => void;
  onClearWindSectors: () => void;
  onStartBoundaryEdit: () => void;
}) {
  return (
    <div className="mt-3 border-t border-app-border pt-2">
      <p className={hubSectionTitle}>Wind &amp; direction</p>
      <p className={`mt-1 ${hubMeta}`}>
        Direction wind comes <strong>from</strong> (°). Drives ranking; optional arc below uses
        the sidebar &quot;Saved-area sector half-width&quot;.
      </p>
      {areaWindPickActive ? (
        <div className="mt-2 space-y-2 rounded-xl border border-app-border bg-app-accent-soft p-2">
          <p className="text-[11px] leading-snug text-app-accent-hover">
            <strong>1.</strong> Click the <strong>tail</strong> on the map.{" "}
            <strong>2.</strong> Click the <strong>head</strong> (downwind). Saves automatically.
          </p>
          <button
            type="button"
            className={`w-full ${hubBtnSecondary}`}
            onClick={onCancelWindPick}
          >
            Cancel drawing
          </button>
          <p className="text-[10px] text-app-fg-muted">
            <kbd className="rounded bg-app-accent-muted px-0.5">Esc</kbd> · right-click resets tail
          </p>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          className={`mt-2 w-full ${hubBtnPrimary}`}
          onClick={onDrawAreaOptimalWind}
        >
          Draw direction on map
        </button>
      )}
      <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-app-fg-subtle">
        Or type degrees
      </p>
      <label className="mt-0.5 block text-xs text-app-fg">
        Wind from (°)
        <input
          type="number"
          min={0}
          max={360}
          step={1}
          value={optimalFromInput}
          onChange={(e) => onOptimalFromChange(e.target.value)}
          className={hubInput}
          placeholder="e.g. 180 — empty = clear saved value"
          disabled={busy || areaWindPickActive}
        />
      </label>
      <div className="mt-1 flex gap-1">
        <button
          type="button"
          disabled={busy || areaWindPickActive}
          className={`flex-1 ${hubBtnSecondarySm}`}
          onClick={onSaveAreaOptimal}
        >
          Save optimal
        </button>
        <button
          type="button"
          disabled={busy || areaWindPickActive}
          className={hubBtnSecondarySm}
          onClick={onClearOptimal}
        >
          Clear
        </button>
      </div>
      <p className={`mt-2 ${hubMeta}`}>
        Saved optimal: {optimalPreview}. Sectors: {sectorsPreview}. Stronger rank when forecast
        aligns; extra boost inside saved sectors.
      </p>
      <button
        type="button"
        disabled={busy || areaWindPickActive}
        className={`mt-3 w-full ${hubBtnSecondary}`}
        onClick={onApplyWindSector}
      >
        Apply acceptable arc from area optimal (sidebar ± width)
      </button>
      <button
        type="button"
        disabled={busy}
        className={`w-full ${hubBtnSecondary}`}
        onClick={onClearWindSectors}
      >
        Clear saved wind sectors
      </button>
      <button
        type="button"
        disabled={busy}
        className={`w-full ${hubBtnSecondary}`}
        onClick={onStartBoundaryEdit}
      >
        Redraw boundary
      </button>
    </div>
  );
}
