"use client";

import type { FeatureCollection } from "geojson";

import { AreaForecastSamples } from "@/components/map-hub/AreaForecastSamples";
import { PersistedCollapsible } from "@/components/map-hub/MapHubDisclosures";
import { hubMeta, hubSectionTitle } from "@/components/map-hub/hubUi";

/**
 * Read-only summary shown when the viewer is not the area owner. Mirrors the
 * editable panel's section structure (basics, optimal wind, forecast samples)
 * but renders text instead of inputs.
 */
export function ReadOnlyView({
  areaId,
  areaName,
  kiteski,
  kitesurf,
  isPublic,
  optimalPreview,
  sectorsPreview,
  forecastAtIso,
  activeSport,
  optimalWindHalfWidthDeg,
  onForecastSamplesMapChange,
  onForecastSamplesOpenChange,
}: {
  areaId: string;
  areaName: string;
  kiteski: boolean;
  kitesurf: boolean;
  isPublic: boolean;
  optimalPreview: string;
  sectorsPreview: string;
  forecastAtIso: string;
  activeSport: "kiteski" | "kitesurf";
  optimalWindHalfWidthDeg: number;
  onForecastSamplesMapChange: (fc: FeatureCollection | null) => void;
  onForecastSamplesOpenChange: (open: boolean) => void;
}) {
  const sportsList =
    [kiteski && "kiteski", kitesurf && "kitesurf"].filter(Boolean).join(", ") || "—";
  return (
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
        {sportsList}
      </p>
      {isPublic ? (
        <p className="mt-2 text-[11px] text-app-fg-muted">
          Listed as public — visible to all signed-in users.
        </p>
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
        onOpenChange={onForecastSamplesOpenChange}
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
  );
}
