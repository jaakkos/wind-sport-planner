"use client";

import { CollapsibleSection } from "@/components/map-hub/CollapsibleSection";
import { MapLayerOverlaysSection } from "@/components/map-hub/MapLayerOverlaysSection";
import type { ToolSectionKey } from "@/components/map-hub/constants";
import type { MapLayerTogglesState } from "@/lib/map/mapLayerToggles";
import { type BasemapId } from "@/lib/map/styles";

type Props = {
  basemap: BasemapId;
  setBasemap: (id: BasemapId) => void;
  basemapSummary: string;
  hasMaptilerKey: boolean;
  reliefOpacity: number;
  setReliefOpacity: (value: number) => void;
  mapLayerToggles: MapLayerTogglesState;
  onPatchMapLayerToggles: (patch: Partial<MapLayerTogglesState>) => void;
  toolSectionsOpen: { basemap: boolean; overlays: boolean };
  toggleToolSection: (key: ToolSectionKey) => void;
};

/**
 * "Map" sidebar tab — basemap picker, relief opacity slider, and the
 * persisted map-overlay visibility toggles. All state lives in the
 * parent (`useBasemap`, `useMapLayerToggles`, `useToolSections`); this
 * component is a pure render of the controls.
 */
export function MapTab({
  basemap,
  setBasemap,
  basemapSummary,
  hasMaptilerKey,
  reliefOpacity,
  setReliefOpacity,
  mapLayerToggles,
  onPatchMapLayerToggles,
  toolSectionsOpen,
  toggleToolSection,
}: Props) {
  return (
    <>
      <CollapsibleSection
        title="Basemap"
        summary={basemapSummary}
        open={toolSectionsOpen.basemap}
        onToggle={() => toggleToolSection("basemap")}
      >
        <label className="flex flex-col gap-1">
          <select
            value={basemap}
            onChange={(e) => setBasemap(e.target.value as BasemapId)}
            className="w-full rounded-xl border border-app-border-subtle bg-app-surface px-3 py-2 text-sm text-app-fg focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/20"
          >
            <option value="hybrid">Hybrid — OSM detail + topo relief &amp; contours</option>
            <option value="osm">OSM — maximum road/path detail</option>
            <option value="topo">Topo — contours &amp; terrain (OpenTopoMap)</option>
            <option value="satellite">Satellite — tree cover vs clearings (Esri)</option>
            {hasMaptilerKey ? (
              <option value="maptiler_outdoor">MapTiler Outdoor (API key)</option>
            ) : null}
          </select>
          <p className="text-[11px] leading-snug text-app-fg-subtle">
            <strong>Height:</strong> click the map for elevation (Open-Meteo).{" "}
            <strong>Forest / openness:</strong> use <em>Topo</em> or <em>Hybrid</em> for wooded
            shading and relief; <em>Satellite</em> shows tree cover visually.
          </p>
        </label>
        {(basemap === "hybrid" || (basemap === "maptiler_outdoor" && !hasMaptilerKey)) && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-app-fg-muted">Topo overlay strength</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(reliefOpacity * 100)}
              onChange={(e) => setReliefOpacity(Number(e.target.value) / 100)}
              className="w-full accent-app-accent"
            />
          </label>
        )}
      </CollapsibleSection>
      <MapLayerOverlaysSection
        toolSectionsOpen={{ overlays: toolSectionsOpen.overlays }}
        toggleToolSection={toggleToolSection}
        mapLayerToggles={mapLayerToggles}
        onPatchMapLayerToggles={onPatchMapLayerToggles}
      />
    </>
  );
}
