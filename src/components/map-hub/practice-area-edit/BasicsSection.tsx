"use client";

import {
  hubBtnPrimary,
  hubInput,
  hubSectionTitle,
  hubSelect,
} from "@/components/map-hub/hubUi";

const LABEL_PRESETS = ["primary", "lakes", "coast", "backup", "other"] as const;

/**
 * Pure presentational section: name, sports, label preset, public toggle and
 * the "save metadata" button. State and the persistence callback are owned by
 * the parent so this component stays trivially testable.
 */
export function BasicsSection({
  areaName,
  onAreaNameChange,
  kiteski,
  onKiteskiChange,
  kitesurf,
  onKitesurfChange,
  labelPreset,
  onLabelPresetChange,
  areaPublic,
  onAreaPublicChange,
  busy,
  onSave,
}: {
  areaName: string;
  onAreaNameChange: (value: string) => void;
  kiteski: boolean;
  onKiteskiChange: (value: boolean) => void;
  kitesurf: boolean;
  onKitesurfChange: (value: boolean) => void;
  labelPreset: string;
  onLabelPresetChange: (value: string) => void;
  areaPublic: boolean;
  onAreaPublicChange: (value: boolean) => void;
  busy: boolean;
  onSave: () => void;
}) {
  return (
    <div className="mt-2 space-y-2">
      <p className={hubSectionTitle}>Basics</p>
      <label className="block text-xs text-app-fg">
        Name
        <input
          type="text"
          value={areaName}
          onChange={(e) => onAreaNameChange(e.target.value.slice(0, 120))}
          className={hubInput}
          maxLength={120}
          placeholder="Visible on map and in lists"
        />
      </label>
      <fieldset className="space-y-1">
        <legend className="text-xs font-medium text-app-fg-muted">Sports</legend>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={kiteski}
            onChange={(e) => onKiteskiChange(e.target.checked)}
          />
          Kite ski
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={kitesurf}
            onChange={(e) => onKitesurfChange(e.target.checked)}
          />
          Kite surf
        </label>
      </fieldset>
      <label className="block text-xs text-app-fg">
        Label preset
        <select
          value={labelPreset}
          onChange={(e) => onLabelPresetChange(e.target.value)}
          className={hubSelect}
        >
          {LABEL_PRESETS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="flex cursor-pointer items-start gap-2 text-xs leading-snug text-app-fg">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={areaPublic}
          onChange={(e) => onAreaPublicChange(e.target.checked)}
        />
        <span>
          <span className="font-medium text-app-fg">Public</span>
          <span className="block text-[10px] text-app-fg-muted">
            Visible on the map and in rankings for every signed-in user (still requires login).
          </span>
        </span>
      </label>
      <button
        type="button"
        disabled={busy}
        className={`w-full ${hubBtnPrimary}`}
        onClick={onSave}
      >
        Save name, label, sports &amp; public
      </button>
    </div>
  );
}
