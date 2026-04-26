"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { ComponentProps, Ref } from "react";
import MapGL, {
  type MapLayerMouseEvent,
  type MapRef,
  NavigationControl,
} from "react-map-gl/maplibre";
import type { FeatureCollection } from "geojson";

import { MapHubLayers } from "@/components/map-hub/map/MapHubLayers";
import { MapHubMarkers } from "@/components/map-hub/map/MapHubMarkers";
import type { MapLayerTogglesState } from "@/lib/map/mapLayerToggles";
import type { WindPickPreview } from "@/lib/map/interactionLayers";

type MapMode = "browse" | "draw" | "pickWind";

type SelectedOptimalWindMarker = {
  lng: number;
  lat: number;
  windToDeg: number;
};

type MapGLProps = ComponentProps<typeof MapGL>;
type MapLoadEvent = Parameters<NonNullable<MapGLProps["onLoad"]>>[0];

type Props = {
  /** Forwarded MapLibre ref so MapHub can call `flyTo` / `fitBounds`. */
  mapRef: Ref<MapRef>;
  /** Active basemap style — string URL or a `StyleSpecification` object. */
  mapStyle: MapGLProps["mapStyle"];
  /** Drawing/picking gates the cursor (`crosshair`) and disables area selection. */
  mapMode: MapMode;
  /** Layer ids `MapGL` should treat as interactive in browse mode. */
  browseInteractiveLayerIds: string[];
  layerToggles: MapLayerTogglesState;

  // Layer / marker data
  areasColored: FeatureCollection | null;
  areaNameLabels: FeatureCollection | null;
  windFieldArrowsGeoJson: FeatureCollection;
  windLabels: FeatureCollection;
  yrForecastPoints: FeatureCollection;
  areaForecastSampleFc: FeatureCollection | null;
  drawPreview: FeatureCollection | null;
  selectedOptimalWindMarker: SelectedOptimalWindMarker | null;
  optimalWindLenPx: number;
  windPickPreview: WindPickPreview | null;
  windPickArrowLenPx: number;

  // Event callbacks (each fires once per MapGL event)
  onMapLoad: (e: MapLoadEvent) => void;
  onMapStyleData: () => void;
  onMapZoomChange: (zoom: number) => void;
  onMouseMove: (e: MapLayerMouseEvent) => void;
  onContextMenu: (e: MapLayerMouseEvent) => void;
  onClick: (e: MapLayerMouseEvent) => void;
};

/**
 * Presentational MapLibre canvas: the `<MapGL>` instance plus its
 * declarative children (`MapHubLayers`, `MapHubMarkers`, navigation
 * control). All event policy lives in the parent — this component only
 * forwards events and renders. Initial view (Norway-centred), zoom
 * bounds, and `mapStyle` plumbing are kept here because they are
 * MapLibre-specific implementation details.
 */
export function MapCanvas({
  mapRef,
  mapStyle,
  mapMode,
  browseInteractiveLayerIds,
  layerToggles,
  areasColored,
  areaNameLabels,
  windFieldArrowsGeoJson,
  windLabels,
  yrForecastPoints,
  areaForecastSampleFc,
  drawPreview,
  selectedOptimalWindMarker,
  optimalWindLenPx,
  windPickPreview,
  windPickArrowLenPx,
  onMapLoad,
  onMapStyleData,
  onMapZoomChange,
  onMouseMove,
  onContextMenu,
  onClick,
}: Props) {
  return (
    <MapGL
      ref={mapRef}
      initialViewState={{
        longitude: 25,
        latitude: 65,
        zoom: 5,
      }}
      mapStyle={mapStyle}
      style={{
        position: "relative",
        zIndex: 0,
        width: "100%",
        height: "100%",
        cursor: mapMode === "draw" || mapMode === "pickWind" ? "crosshair" : undefined,
      }}
      maxZoom={19}
      minZoom={1}
      interactiveLayerIds={browseInteractiveLayerIds}
      onLoad={onMapLoad}
      onStyleData={onMapStyleData}
      onMove={(e) => onMapZoomChange(e.viewState.zoom)}
      onMouseMove={onMouseMove}
      onContextMenu={onContextMenu}
      onClick={onClick}
    >
      <NavigationControl position="bottom-right" showCompass visualizePitch />
      <MapHubLayers
        areasColored={areasColored}
        areaNameLabels={areaNameLabels}
        windFieldArrowsGeoJson={windFieldArrowsGeoJson}
        windLabels={windLabels}
        yrForecastPoints={yrForecastPoints}
        areaForecastSampleFc={areaForecastSampleFc}
        drawPreview={drawPreview}
        layerToggles={layerToggles}
      />
      <MapHubMarkers
        selectedOptimalWindMarker={selectedOptimalWindMarker}
        optimalWindLenPx={optimalWindLenPx}
        windPickPreview={windPickPreview}
        windPickArrowLenPx={windPickArrowLenPx}
      />
    </MapGL>
  );
}
