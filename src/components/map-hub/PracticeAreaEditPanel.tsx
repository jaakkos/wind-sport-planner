"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import { sectorsFromCenter } from "@/lib/heuristics/windDirection";
import { areaFeatureId } from "@/lib/map/polygons";
import { AreaForecastSamples } from "./AreaForecastSamples";
import { PersistedCollapsible } from "./MapHubDisclosures";
import { hubOverlayZ } from "./mapHubOverlayZ";
import {
  hubBtnDanger,
  hubBtnPrimary,
  hubBtnSecondary,
  hubBtnSecondarySm,
  hubInput,
  hubMeta,
  hubPanelShell,
  hubSectionTitle,
  hubSelect,
} from "./hubUi";
import type { Bundle } from "./types";

const LABEL_PRESETS = ["primary", "lakes", "coast", "backup", "other"] as const;

export function PracticeAreaEditPanel({
  areaId,
  bundle,
  sectorHalfWidthDeg,
  forecastAtIso,
  activeSport,
  optimalWindHalfWidthDeg,
  onForecastSamplesMapChange,
  areaWindPickActive,
  onDrawAreaOptimalWind,
  onCancelWindPick,
  onClose,
  onSaved,
  onStartBoundaryEdit,
}: {
  areaId: string;
  bundle: Bundle;
  sectorHalfWidthDeg: number;
  forecastAtIso: string;
  activeSport: "kiteski" | "kitesurf";
  optimalWindHalfWidthDeg: number;
  onForecastSamplesMapChange: (fc: FeatureCollection | null) => void;
  areaWindPickActive: boolean;
  onDrawAreaOptimalWind: () => void;
  onCancelWindPick: () => void;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onStartBoundaryEdit: (poly: GeoJSON.Polygon) => void;
}) {
  const feature = useMemo(
    () => bundle.practiceAreas.features.find((f) => areaFeatureId(f) === areaId),
    [bundle, areaId],
  );

  const props = feature?.properties as
    | {
        name?: string;
        sports?: string[];
        labelPreset?: string;
        windSectors?: unknown;
        optimalWindFromDeg?: number | null;
        isOwn?: boolean;
        isPublic?: boolean;
        isCommunity?: number | boolean;
      }
    | undefined;

  const isOwn =
    typeof props?.isOwn === "boolean"
      ? props.isOwn
      : !(props?.isCommunity === 1 || props?.isCommunity === true);

  const [areaName, setAreaName] = useState("");
  const [kiteski, setKiteski] = useState(false);
  const [kitesurf, setKitesurf] = useState(false);
  const [labelPreset, setLabelPreset] = useState<string>("other");
  const [areaPublic, setAreaPublic] = useState(false);
  const [optimalFromInput, setOptimalFromInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  useEffect(() => {
    setAreaName(typeof props?.name === "string" ? props.name : "");
    const sp = props?.sports ?? [];
    setKiteski(sp.includes("kiteski"));
    setKitesurf(sp.includes("kitesurf"));
    setLabelPreset(props?.labelPreset ?? "other");
    setAreaPublic(props?.isPublic === true);
    const o = props?.optimalWindFromDeg;
    setOptimalFromInput(
      o != null && typeof o === "number" && Number.isFinite(o) ? String(Math.round(o)) : "",
    );
  }, [areaId, props?.name, props?.sports, props?.labelPreset, props?.optimalWindFromDeg, props?.isPublic]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setLocalMsg(null);
    try {
      const r = await fetch(`/api/practice-areas/${areaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      await onSaved();
      setLocalMsg("Saved.");
    } catch (e) {
      setLocalMsg(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveMeta() {
    if (!isOwn) return;
    const sports: ("kiteski" | "kitesurf")[] = [];
    if (kiteski) sports.push("kiteski");
    if (kitesurf) sports.push("kitesurf");
    if (sports.length === 0) {
      setLocalMsg("Select at least one sport.");
      return;
    }
    await patch({
      name: areaName.trim().slice(0, 120),
      sports,
      labelPreset,
      isPublic: areaPublic,
    });
  }

  function effectiveAreaOptimalWindFrom(): number | null {
    const t = optimalFromInput.trim();
    if (t !== "") {
      const v = Number(t);
      if (Number.isFinite(v)) return ((v % 360) + 360) % 360;
    }
    const o = props?.optimalWindFromDeg;
    if (o != null && typeof o === "number" && Number.isFinite(o)) {
      return ((o % 360) + 360) % 360;
    }
    return null;
  }

  async function applyWindSector() {
    if (!isOwn) return;
    const opt = effectiveAreaOptimalWindFrom();
    if (opt == null) {
      setLocalMsg("Set this area’s optimal first (draw on map, or type ° and Save optimal).");
      return;
    }
    const sectors = sectorsFromCenter(opt, sectorHalfWidthDeg);
    await patch({
      windSectors: sectors,
      optimalWindFromDeg: opt,
    });
  }

  async function clearWindSectors() {
    if (!isOwn) return;
    await patch({ windSectors: null });
  }

  async function saveAreaOptimal() {
    if (!isOwn) return;
    const t = optimalFromInput.trim();
    if (t === "") {
      await patch({ optimalWindFromDeg: null });
      return;
    }
    const v = Number(t);
    if (!Number.isFinite(v)) {
      setLocalMsg("Invalid degrees (use 0–360, meteorological wind-from).");
      return;
    }
    await patch({ optimalWindFromDeg: v });
  }

  async function deleteArea() {
    if (!isOwn) return;
    if (!globalThis.confirm("Delete this practice area?")) return;
    setBusy(true);
    setLocalMsg(null);
    try {
      const r = await fetch(`/api/practice-areas/${areaId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      await onSaved();
      onClose();
    } catch (e) {
      setLocalMsg(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const sectorsPreview =
    Array.isArray(props?.windSectors) && props.windSectors.length > 0
      ? JSON.stringify(props.windSectors)
      : "None";
  const optimalPreview =
    props?.optimalWindFromDeg != null &&
    typeof props.optimalWindFromDeg === "number" &&
    Number.isFinite(props.optimalWindFromDeg)
      ? `${Math.round(props.optimalWindFromDeg)}° (wind from)`
      : "Not set";

  const handleForecastSamplesOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onForecastSamplesMapChange(null);
    },
    [onForecastSamplesMapChange],
  );

  return (
    <div
      className={`absolute right-2 top-2 w-80 max-h-[85vh] overflow-auto p-3 text-sm ${hubPanelShell} ${hubOverlayZ.editPanel}`}
    >
      {busy ? (
        <div
          className="pointer-events-none absolute inset-0 z-[1] flex items-start justify-center rounded-2xl bg-app-surface/60 pt-8 backdrop-blur-[1px]"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="rounded-full border border-app-border bg-app-surface px-2.5 py-1 text-[10px] font-medium text-app-fg-muted shadow-sm">
            Saving…
          </span>
        </div>
      ) : null}
      <div className="mb-2 flex justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="font-medium text-app-fg">{isOwn ? "Edit area" : "Area"}</span>
          {feature ? (
            <p className="truncate text-sm text-app-fg-muted">
              {props?.name?.trim() ||
                (isOwn ? "Untitled — add a name below" : "Shared practice area")}
            </p>
          ) : null}
        </div>
        <button type="button" className="text-app-fg-subtle" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      {!feature ? (
        <p className="text-xs text-app-fg-muted">
          This area is not visible with the current sport filter. Switch sport in the sidebar to
          edit it, or it may have been removed.
        </p>
      ) : !isOwn ? (
        <>
          <p className="mt-2 rounded border border-app-info-border bg-app-info-bg px-2 py-1.5 text-[11px] leading-snug text-app-info-fg">
            This practice area belongs to another user. You can view it and log sessions here; only
            the owner can change boundaries, wind settings, or visibility.
          </p>
          <p className="break-all font-mono text-[10px] text-app-fg-subtle">{areaId}</p>
          <p className="mt-2 text-xs">
            <span className="font-medium text-app-fg-muted">Name</span>
            <br />
            {areaName.trim() || "Untitled"}
          </p>
          <p className="mt-2 text-xs">
            <span className="font-medium text-app-fg-muted">Sports</span>
            <br />
            {[kiteski && "kiteski", kitesurf && "kitesurf"].filter(Boolean).join(", ") || "—"}
          </p>
          {props?.isPublic === true ? (
            <p className="mt-2 text-[11px] text-app-fg-muted">Listed as public — visible to all signed-in users.</p>
          ) : null}
          <div className="mt-3 border-t border-app-border pt-2">
            <p className={hubSectionTitle}>Optimal wind</p>
            <p className={`mt-1 ${hubMeta}`}>
              Saved optimal: {optimalPreview}. Sectors: {sectorsPreview}.
            </p>
          </div>
          <PersistedCollapsible
            title="Forecast samples"
            summaryCollapsed="Elevations, Yr links, amber dots on map"
            storageKey="mapHub.editForecastSamplesExpanded"
            onOpenChange={handleForecastSamplesOpenChange}
          >
            <AreaForecastSamples
              key={`${areaId}-${forecastAtIso}-${activeSport}-${optimalWindHalfWidthDeg}`}
              areaId={areaId}
              forecastAtIso={forecastAtIso}
              sport={activeSport}
              optimalWindHalfWidthDeg={optimalWindHalfWidthDeg}
              onMapPointsChange={onForecastSamplesMapChange}
              embedded
            />
          </PersistedCollapsible>
        </>
      ) : (
        <>
          <p className="break-all font-mono text-[10px] text-app-fg-subtle">{areaId}</p>

          <div className="mt-2 space-y-2">
            <p className={hubSectionTitle}>Basics</p>
            <label className="block text-xs text-app-fg">
              Name
              <input
                type="text"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value.slice(0, 120))}
                className={hubInput}
                maxLength={120}
                placeholder="Visible on map and in lists"
              />
            </label>
            <fieldset className="space-y-1">
              <legend className="text-xs font-medium text-app-fg-muted">Sports</legend>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={kiteski} onChange={(e) => setKiteski(e.target.checked)} />
                Kite ski
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={kitesurf}
                  onChange={(e) => setKitesurf(e.target.checked)}
                />
                Kite surf
              </label>
            </fieldset>
            <label className="block text-xs text-app-fg">
              Label preset
              <select value={labelPreset} onChange={(e) => setLabelPreset(e.target.value)} className={hubSelect}>
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
                onChange={(e) => setAreaPublic(e.target.checked)}
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
              onClick={() => void saveMeta()}
            >
              Save name, label, sports &amp; public
            </button>
          </div>

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
                  onClick={() => onCancelWindPick()}
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
                onClick={() => onDrawAreaOptimalWind()}
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
                onChange={(e) => setOptimalFromInput(e.target.value)}
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
                onClick={() => void saveAreaOptimal()}
              >
                Save optimal
              </button>
              <button
                type="button"
                disabled={busy || areaWindPickActive}
                className={hubBtnSecondarySm}
                onClick={() => void patch({ optimalWindFromDeg: null })}
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
              onClick={() => void applyWindSector()}
            >
              Apply acceptable arc from area optimal (sidebar ± width)
            </button>
            <button
              type="button"
              disabled={busy}
              className={`w-full ${hubBtnSecondary}`}
              onClick={() => void clearWindSectors()}
            >
              Clear saved wind sectors
            </button>
            <button
              type="button"
              disabled={busy}
              className={`w-full ${hubBtnSecondary}`}
              onClick={() => {
                const g = feature.geometry as GeoJSON.Polygon;
                if (g?.type === "Polygon") onStartBoundaryEdit(g);
              }}
            >
              Redraw boundary
            </button>
          </div>

          <PersistedCollapsible
            title="Forecast samples"
            summaryCollapsed="Elevations, Yr links, amber dots on map"
            storageKey="mapHub.editForecastSamplesExpanded"
            onOpenChange={handleForecastSamplesOpenChange}
          >
            <AreaForecastSamples
              key={`${areaId}-${forecastAtIso}-${activeSport}-${optimalWindHalfWidthDeg}`}
              areaId={areaId}
              forecastAtIso={forecastAtIso}
              sport={activeSport}
              optimalWindHalfWidthDeg={optimalWindHalfWidthDeg}
              onMapPointsChange={onForecastSamplesMapChange}
              embedded
            />
          </PersistedCollapsible>

          <div className="mt-3 border-t border-app-danger-border pt-2">
            <button
              type="button"
              disabled={busy}
              className={`w-full ${hubBtnDanger}`}
              onClick={() => void deleteArea()}
            >
              Delete area
            </button>
          </div>
        </>
      )}
      {localMsg && <p className="mt-2 text-xs text-app-fg-muted">{localMsg}</p>}
    </div>
  );
}
