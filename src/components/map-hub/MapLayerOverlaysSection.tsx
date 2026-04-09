"use client";

import type { MapLayerTogglesState } from "@/lib/map/mapLayerToggles";
import { CollapsibleSection } from "./CollapsibleSection";
import Link from "next/link";

const checkboxClass =
  "mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-app-border text-app-accent focus:ring-app-accent focus:ring-offset-0";

export function MapLayerOverlaysSection({
  toolSectionsOpen,
  toggleToolSection,
  mapLayerToggles,
  onPatchMapLayerToggles,
}: {
  toolSectionsOpen: { overlays: boolean };
  toggleToolSection: (k: "overlays") => void;
  mapLayerToggles: MapLayerTogglesState;
  onPatchMapLayerToggles: (patch: Partial<MapLayerTogglesState>) => void;
}) {
  return (
    <CollapsibleSection
      title="Map overlays"
      summary="Wind, forecast dots, area names"
      open={toolSectionsOpen.overlays}
      onToggle={() => toggleToolSection("overlays")}
    >
      <p className="text-[10px] leading-snug text-app-fg-muted">
        Turn layers off for a cleaner map or screenshots. Polygons and ranking are unchanged.
      </p>
      <div className="flex flex-col gap-2.5 pt-0.5">
        <label className="flex cursor-pointer items-start gap-2 text-[11px] text-app-fg">
          <input
            type="checkbox"
            className={checkboxClass}
            checked={mapLayerToggles.windArrows}
            onChange={(e) => onPatchMapLayerToggles({ windArrows: e.target.checked })}
          />
          <span>
            <span className="font-medium">Wind arrows &amp; labels</span>
            <span className="block text-[10px] text-app-fg-muted">
              Direction arrows along each area span and speed text labels.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-[11px] text-app-fg">
          <input
            type="checkbox"
            className={checkboxClass}
            checked={mapLayerToggles.forecastSampleDots}
            onChange={(e) => onPatchMapLayerToggles({ forecastSampleDots: e.target.checked })}
          />
          <span>
            <span className="font-medium">Forecast sample dots</span>
            <span className="block text-[10px] text-app-fg-muted">
              Blue hourly points (and amber edit previews when sampling an area).
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-[11px] text-app-fg">
          <input
            type="checkbox"
            className={checkboxClass}
            checked={mapLayerToggles.areaLabels}
            onChange={(e) => onPatchMapLayerToggles({ areaLabels: e.target.checked })}
          />
          <span>
            <span className="font-medium">Area name labels</span>
            <span className="block text-[10px] text-app-fg-muted">Names near each practice polygon.</span>
          </span>
        </label>
      </div>
      <p className="text-[10px] text-app-fg-subtle">
        <Link href="/help" className="font-medium text-app-accent-hover underline hover:text-app-fg">
          How scoring works
        </Link>{" "}
        (full page)
      </p>
    </CollapsibleSection>
  );
}
