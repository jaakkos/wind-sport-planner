import type { StyleSpecification } from "maplibre-gl";

/** Standard OSM carto — roads, paths, place names (zoom to 19). */
const OSM_TILES = ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];

/** OpenTopoMap: contours, hill shading, vegetation tint (max zoom 17 per provider). */
const OPENTOPO_TILES = [
  "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
  "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
  "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
];

/** Esri World Imagery — useful to judge forest vs fields / ice (subject to Esri terms). */
const ESRI_IMAGERY_TILES = [
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];

const ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>';

const ATTRIB_TOPO =
  'Map: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | style: © <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)';

const ATTRIB_ESRI =
  'Tiles © <a href="https://www.esri.com/">Esri</a> — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

/**
 * Raster styles lack bundled fonts; needed for symbol layers (e.g. wind labels on /map).
 * Use demotiles glyph PBFs; font stacks must match paths that exist there (single-face
 * stacks like "Noto Sans Bold" — combined stacks such as "Open Sans Semibold,Arial…" 404).
 */
const GLYPHS_URL = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

export type BasemapId = "osm" | "hybrid" | "topo" | "satellite" | "maptiler_outdoor";

export function maptilerOutdoorStyleUrl(): string | null {
  const key = process.env.NEXT_PUBLIC_MAPTILER_API_KEY?.trim();
  if (!key) return null;
  return `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${key}`;
}

/**
 * Raster basemap styles. Prefer `hybrid` or `topo` for elevation contours and vegetation context.
 * `satellite` helps estimate forest vs open ground; not a numeric “forest density” layer.
 */
export function buildRasterBasemapStyle(
  basemap: Exclude<BasemapId, "maptiler_outdoor">,
  reliefOverlayOpacity: number,
): StyleSpecification {
  const opacity = Math.min(1, Math.max(0, reliefOverlayOpacity));

  if (basemap === "satellite") {
    return {
      version: 8,
      name: "satellite",
      glyphs: GLYPHS_URL,
      sources: {
        esri: {
          type: "raster",
          tiles: ESRI_IMAGERY_TILES,
          tileSize: 256,
          maxzoom: 19,
          attribution: ATTRIB_ESRI,
        },
      },
      layers: [{ id: "esri", type: "raster", source: "esri" }],
    };
  }

  if (basemap === "topo") {
    return {
      version: 8,
      name: "topo",
      glyphs: GLYPHS_URL,
      sources: {
        opentopo: {
          type: "raster",
          tiles: OPENTOPO_TILES,
          tileSize: 256,
          maxzoom: 17,
          attribution: ATTRIB_TOPO,
        },
      },
      layers: [{ id: "opentopo-base", type: "raster", source: "opentopo" }],
    };
  }

  if (basemap === "osm") {
    return {
      version: 8,
      name: "osm",
      glyphs: GLYPHS_URL,
      sources: {
        osm: {
          type: "raster",
          tiles: OSM_TILES,
          tileSize: 256,
          maxzoom: 19,
          attribution: ATTRIBUTION,
        },
      },
      layers: [{ id: "osm-base", type: "raster", source: "osm" }],
    };
  }

  // hybrid: detailed OSM + OpenTopo relief / contours on top
  return {
    version: 8,
    name: "hybrid",
    glyphs: GLYPHS_URL,
    sources: {
      osm: {
        type: "raster",
        tiles: OSM_TILES,
        tileSize: 256,
        maxzoom: 19,
        attribution: ATTRIBUTION,
      },
      opentopo: {
        type: "raster",
        tiles: OPENTOPO_TILES,
        tileSize: 256,
        maxzoom: 17,
        attribution: ATTRIB_TOPO,
      },
    },
    layers: [
      { id: "osm-base", type: "raster", source: "osm" },
      {
        id: "opentopo-relief",
        type: "raster",
        source: "opentopo",
        paint: { "raster-opacity": opacity },
      },
    ],
  };
}
