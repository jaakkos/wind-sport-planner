import type { BasemapId } from "@/lib/map/styles";
import { maptilerOutdoorStyleUrl } from "@/lib/map/styles";
import { CollapsibleSection } from "./CollapsibleSection";

export function MapHubMapTab({
  basemapSummary,
  toolSectionsOpen,
  toggleToolSection,
  basemap,
  setBasemap,
  hasMaptilerKey,
  reliefOpacity,
  setReliefOpacity,
}: {
  basemapSummary: string;
  toolSectionsOpen: { basemap: boolean };
  toggleToolSection: (k: "basemap") => void;
  basemap: BasemapId;
  setBasemap: (b: BasemapId) => void;
  hasMaptilerKey: boolean;
  reliefOpacity: number;
  setReliefOpacity: (n: number) => void;
}) {
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
            className="w-full rounded-xl border border-teal-900/10 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          >
            <option value="hybrid">Hybrid — OSM detail + topo relief &amp; contours</option>
            <option value="osm">OSM — maximum road/path detail</option>
            <option value="topo">Topo — contours &amp; terrain (OpenTopoMap)</option>
            <option value="satellite">Satellite — tree cover vs clearings (Esri)</option>
            {hasMaptilerKey ? (
              <option value="maptiler_outdoor">MapTiler Outdoor (API key)</option>
            ) : null}
          </select>
          <p className="text-[11px] leading-snug text-zinc-500">
            <strong>Height:</strong> click the map for elevation (Open-Meteo).{" "}
            <strong>Forest / openness:</strong> use <em>Topo</em> or <em>Hybrid</em> for wooded
            shading and relief; <em>Satellite</em> shows tree cover visually.
          </p>
        </label>
        {(basemap === "hybrid" || (basemap === "maptiler_outdoor" && !maptilerOutdoorStyleUrl())) && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700">Topo overlay strength</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(reliefOpacity * 100)}
              onChange={(e) => setReliefOpacity(Number(e.target.value) / 100)}
              className="w-full accent-teal-600"
            />
          </label>
        )}
      </CollapsibleSection>
    </>
  );
}
