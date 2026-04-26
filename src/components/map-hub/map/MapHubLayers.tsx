"use client";

import type { FeatureCollection } from "geojson";
import { Layer, Source } from "react-map-gl/maplibre";
import { WIND_FIELD_ARROW_IMAGE_ID } from "@/lib/map/windFieldArrowIcon";
import type { MapLayerTogglesState } from "@/lib/map/mapLayerToggles";

type Props = {
  /** Practice-area polygons coloured by rank score. */
  areasColored: FeatureCollection | null;
  /** Centroid labels naming each practice area. */
  areaNameLabels: FeatureCollection | null;
  /** Background wind-field arrow icons sampled inside each polygon. */
  windFieldArrowsGeoJson: FeatureCollection;
  /** Numeric wind labels along the polygon spans. */
  windLabels: FeatureCollection;
  /** Yr.no hourly forecast point markers (one per area centroid). */
  yrForecastPoints: FeatureCollection;
  /** Multi-point forecast sample dots for the area being edited. */
  areaForecastSampleFc: FeatureCollection | null;
  /** Polygon-being-drawn rubber-band geometry. */
  drawPreview: FeatureCollection | null;
  /** Persisted overlay visibility (windArrows / forecastSampleDots / areaLabels). */
  layerToggles: MapLayerTogglesState;
};

/**
 * Pure declarative MapLibre `<Source>`/`<Layer>` blocks for everything
 * MapHub puts on top of the basemap. Every feature collection is
 * pre-built by `lib/map/areaLayers.ts` or `interactionLayers.ts`; this
 * component only concerns itself with paint/layout/visibility and stable
 * source/layer ids.
 *
 * Render order matches the previous inline JSX so MapLibre paints the
 * stack identically: wind-field arrows under the area fill, area fill +
 * outline above that, then labels and forecast points on top.
 */
export function MapHubLayers({
  areasColored,
  areaNameLabels,
  windFieldArrowsGeoJson,
  windLabels,
  yrForecastPoints,
  areaForecastSampleFc,
  drawPreview,
  layerToggles,
}: Props) {
  return (
    <>
      {windFieldArrowsGeoJson.features.length > 0 ? (
        <Source id="wind-field-arrows" type="geojson" data={windFieldArrowsGeoJson}>
          <Layer
            id="wind-field-arrows-symbol"
            type="symbol"
            layout={{
              "icon-image": WIND_FIELD_ARROW_IMAGE_ID,
              "icon-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                6,
                0.28,
                10,
                0.42,
                14,
                0.56,
                18,
                0.65,
              ],
              "icon-rotate": ["get", "windTo"],
              "icon-rotation-alignment": "map",
              "icon-pitch-alignment": "map",
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              visibility: layerToggles.windArrows ? "visible" : "none",
            }}
            paint={{
              "icon-opacity": 0.52,
            }}
          />
        </Source>
      ) : null}
      {areaForecastSampleFc && areaForecastSampleFc.features.length > 0 ? (
        <Source id="area-forecast-samples" type="geojson" data={areaForecastSampleFc}>
          <Layer
            id="area-forecast-samples-circle"
            type="circle"
            layout={{
              visibility: layerToggles.forecastSampleDots ? "visible" : "none",
            }}
            paint={{
              "circle-radius": 5,
              "circle-color": "#d97706",
              "circle-opacity": 0.92,
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#ffffff",
            }}
          />
          <Layer
            id="area-forecast-samples-label"
            type="symbol"
            minzoom={10.5}
            layout={{
              visibility: layerToggles.forecastSampleDots ? "visible" : "none",
              "text-field": ["get", "mapLabel"],
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                10.5,
                9,
                13,
                10,
                16,
                11,
              ],
              "text-anchor": "top",
              "text-offset": [0, 0.85],
              "text-max-width": 14,
              "text-line-height": 1.15,
              "text-allow-overlap": true,
              "text-ignore-placement": true,
              "text-font": ["Noto Sans Bold"],
            }}
            paint={{
              "text-color": "#292524",
              "text-halo-color": "#ffffff",
              "text-halo-width": 2,
            }}
          />
        </Source>
      ) : null}
      {drawPreview?.features.length ? (
        <Source id="draw-preview" type="geojson" data={drawPreview}>
          <Layer
            id="draw-path"
            type="line"
            filter={["==", ["get", "kind"], "path"]}
            paint={{ "line-color": "#0369a1", "line-width": 2.5 }}
          />
          <Layer
            id="draw-close"
            type="line"
            filter={["==", ["get", "kind"], "close"]}
            paint={{
              "line-color": "#0369a1",
              "line-width": 2,
              "line-dasharray": [2, 2],
              "line-opacity": 0.7,
            }}
          />
          <Layer
            id="draw-vertices"
            type="circle"
            filter={["==", ["get", "kind"], "vertices"]}
            paint={{
              "circle-radius": 5,
              "circle-color": "#0c4a6e",
              "circle-stroke-width": 1,
              "circle-stroke-color": "#fff",
            }}
          />
        </Source>
      ) : null}
      {areasColored?.features.length ? (
        <Source id="areas" type="geojson" data={areasColored}>
          <Layer
            id="areas-fill"
            type="fill"
            paint={{
              "fill-color": ["get", "rankColor"],
              "fill-opacity": [
                "case",
                ["==", ["get", "hasMapSelection"], 0],
                ["case", ["==", ["get", "isCommunity"], 1], 0.22, 0.35],
                [
                  "case",
                  ["==", ["get", "selectedPractice"], 1],
                  ["case", ["==", ["get", "isCommunity"], 1], 0.22, 0.35],
                  [
                    "*",
                    ["case", ["==", ["get", "isCommunity"], 1], 0.22, 0.35],
                    0.72,
                  ],
                ],
              ],
            }}
          />
          <Layer
            id="areas-outline"
            type="line"
            paint={{
              "line-color": [
                "case",
                ["==", ["get", "selectedPractice"], 1],
                "#0f766e",
                ["==", ["get", "isCommunity"], 1],
                "#64748b",
                "#1e3a5f",
              ],
              "line-width": [
                "case",
                ["==", ["get", "selectedPractice"], 1],
                3.5,
                2,
              ],
            }}
          />
        </Source>
      ) : null}
      {areaNameLabels?.features.length ? (
        <Source id="area-names" type="geojson" data={areaNameLabels}>
          <Layer
            id="area-name-labels"
            type="symbol"
            layout={{
              visibility: layerToggles.areaLabels ? "visible" : "none",
              "text-field": ["get", "areaName"],
              "text-size": 12,
              "text-offset": [0, 0.6],
              "text-anchor": "top",
              "text-allow-overlap": false,
              "text-ignore-placement": false,
              "text-font": ["Noto Sans Bold"],
              "text-padding": 4,
            }}
            paint={{
              "text-color": "#0f172a",
              "text-halo-color": "#ffffff",
              "text-halo-width": 2,
            }}
          />
        </Source>
      ) : null}
      {windLabels.features.length > 0 ? (
        <Source id="wind-labels" type="geojson" data={windLabels}>
          <Layer
            id="wind-label-text"
            type="symbol"
            layout={{
              visibility: layerToggles.windArrows ? "visible" : "none",
              "text-field": ["get", "windText"],
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                6,
                9,
                12,
                11,
                16,
                12,
              ],
              "text-offset": [0, -1.25],
              "text-anchor": "bottom",
              "text-allow-overlap": true,
              "text-font": ["Noto Sans Bold"],
            }}
            paint={{
              "text-color": "#0f172a",
              "text-halo-color": "#ffffff",
              "text-halo-width": 2,
            }}
          />
        </Source>
      ) : null}
      {yrForecastPoints.features.length > 0 ? (
        <Source id="yr-forecast-points" type="geojson" data={yrForecastPoints}>
          <Layer
            id="yr-forecast-point-halo"
            type="circle"
            layout={{
              visibility: layerToggles.forecastSampleDots ? "visible" : "none",
            }}
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                6,
                14,
                10,
                16,
                14,
                18,
                18,
                20,
              ],
              "circle-color": "#ffffff",
              "circle-opacity": 0.55,
            }}
          />
          <Layer
            id="yr-forecast-point"
            type="circle"
            layout={{
              visibility: layerToggles.forecastSampleDots ? "visible" : "none",
            }}
            paint={{
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                6,
                5,
                10,
                6.5,
                14,
                8,
                18,
                9,
                20,
                10,
              ],
              "circle-color": "#0284c7",
              "circle-opacity": 0.92,
              "circle-stroke-width": 2.25,
              "circle-stroke-color": "#ffffff",
            }}
          />
        </Source>
      ) : null}
    </>
  );
}
