"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import { sectorsFromCenter } from "@/lib/heuristics/windDirection";
import { areaFeatureId } from "@/lib/map/polygons";
import {
  deletePracticeArea,
  patchPracticeArea,
  type PracticeAreaPatchPayload,
} from "@/lib/practiceArea/client";
import { AreaForecastSamples } from "./AreaForecastSamples";
import { PersistedCollapsible } from "./MapHubDisclosures";
import { hubOverlayZ } from "./mapHubOverlayZ";
import { hubBtnDanger, hubPanelShell } from "./hubUi";
import type { Bundle } from "./types";
import { BasicsSection } from "./practice-area-edit/BasicsSection";
import { WindSection } from "./practice-area-edit/WindSection";
import { ReadOnlyView } from "./practice-area-edit/ReadOnlyView";

export function PracticeAreaEditPanel({
  areaId,
  bundle,
  sectorHalfWidthDeg,
  forecastAtIso,
  activeSport,
  optimalWindHalfWidthDeg,
  onForecastSamplesMapChange,
  areaWindPickActive,
  windPickStep,
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
  windPickStep: "tail" | "head";
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

  async function patch(body: PracticeAreaPatchPayload) {
    setBusy(true);
    setLocalMsg(null);
    try {
      await patchPracticeArea(areaId, body);
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
      await deletePracticeArea(areaId);
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
        <ReadOnlyView
          areaId={areaId}
          areaName={areaName}
          kiteski={kiteski}
          kitesurf={kitesurf}
          isPublic={props?.isPublic === true}
          optimalPreview={optimalPreview}
          sectorsPreview={sectorsPreview}
          forecastAtIso={forecastAtIso}
          activeSport={activeSport}
          optimalWindHalfWidthDeg={optimalWindHalfWidthDeg}
          onForecastSamplesMapChange={onForecastSamplesMapChange}
          onForecastSamplesOpenChange={handleForecastSamplesOpenChange}
        />
      ) : (
        <>
          <BasicsSection
            areaName={areaName}
            onAreaNameChange={setAreaName}
            kiteski={kiteski}
            onKiteskiChange={setKiteski}
            kitesurf={kitesurf}
            onKitesurfChange={setKitesurf}
            labelPreset={labelPreset}
            onLabelPresetChange={setLabelPreset}
            areaPublic={areaPublic}
            onAreaPublicChange={setAreaPublic}
            busy={busy}
            onSave={() => void saveMeta()}
          />

          <WindSection
            areaWindPickActive={areaWindPickActive}
            windPickStep={windPickStep}
            onDrawAreaOptimalWind={onDrawAreaOptimalWind}
            onCancelWindPick={onCancelWindPick}
            optimalFromInput={optimalFromInput}
            onOptimalFromChange={setOptimalFromInput}
            optimalPreview={optimalPreview}
            sectorsPreview={sectorsPreview}
            busy={busy}
            onSaveAreaOptimal={() => void saveAreaOptimal()}
            onClearOptimal={() => void patch({ optimalWindFromDeg: null })}
            onApplyWindSector={() => void applyWindSector()}
            onClearWindSectors={() => void clearWindSectors()}
            onStartBoundaryEdit={() => {
              const g = feature.geometry as GeoJSON.Polygon;
              if (g?.type === "Polygon") onStartBoundaryEdit(g);
            }}
          />

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
            <p className="mt-2 break-all font-mono text-[10px] text-app-fg-subtle">
              ID {areaId}
            </p>
          </div>
        </>
      )}
      {localMsg && <p className="mt-2 text-xs text-app-fg-muted">{localMsg}</p>}
    </div>
  );
}
