"use client";

import { Marker } from "react-map-gl/maplibre";
import { cssRotateEastBaseToWindTo } from "@/lib/map/windArrowDisplay";
import type { WindPickPreview } from "@/lib/map/interactionLayers";

type SelectedOptimalWindMarker = {
  lng: number;
  lat: number;
  windToDeg: number;
};

type Props = {
  selectedOptimalWindMarker: SelectedOptimalWindMarker | null;
  optimalWindLenPx: number;
  windPickPreview: WindPickPreview | null;
  windPickArrowLenPx: number;
};

/**
 * Pure presentational MapLibre Markers for the saved optimal-wind arrow on
 * the selected practice area, the in-progress wind-pick dot, and the
 * in-progress wind-pick arrow. Lengths are pre-clamped to pixels by the
 * caller (see `interactionLayers.ts`); this component just renders SVG.
 */
export function MapHubMarkers({
  selectedOptimalWindMarker,
  optimalWindLenPx,
  windPickPreview,
  windPickArrowLenPx,
}: Props) {
  return (
    <>
      {selectedOptimalWindMarker && optimalWindLenPx > 0 ? (
        <Marker
          longitude={selectedOptimalWindMarker.lng}
          latitude={selectedOptimalWindMarker.lat}
          anchor="left"
          rotationAlignment="map"
          pitchAlignment="map"
          style={{ pointerEvents: "none" }}
        >
          <SavedOptimalArrow
            widthPx={optimalWindLenPx}
            windToDeg={selectedOptimalWindMarker.windToDeg}
          />
        </Marker>
      ) : null}
      {windPickPreview?.kind === "dot" ? (
        <Marker
          longitude={windPickPreview.lng}
          latitude={windPickPreview.lat}
          anchor="center"
          rotationAlignment="map"
          pitchAlignment="map"
          style={{ pointerEvents: "none" }}
        >
          <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden>
            <circle
              cx="9"
              cy="9"
              r="6"
              fill="#6d28d9"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </svg>
        </Marker>
      ) : null}
      {windPickPreview?.kind === "arrow" && windPickArrowLenPx > 0 ? (
        <Marker
          longitude={windPickPreview.tailLng}
          latitude={windPickPreview.tailLat}
          anchor="left"
          rotationAlignment="map"
          pitchAlignment="map"
          style={{ pointerEvents: "none" }}
        >
          <PickWindArrow
            widthPx={windPickArrowLenPx}
            windToDeg={windPickPreview.windToDeg}
          />
        </Marker>
      ) : null}
    </>
  );
}

function SavedOptimalArrow({ widthPx, windToDeg }: { widthPx: number; windToDeg: number }) {
  const w = widthPx;
  const shaftW = Math.max(6, w - 14);
  const rot = cssRotateEastBaseToWindTo(windToDeg);
  return (
    <svg
      width={w}
      height={20}
      viewBox={`0 0 ${w} 20`}
      style={{
        display: "block",
        transform: `rotate(${rot}deg)`,
        transformOrigin: "0 50%",
        filter:
          "drop-shadow(0 0 1px rgb(255 255 255 / 0.9)) drop-shadow(0 0 2px rgb(255 255 255 / 0.5))",
      }}
      aria-hidden
    >
      <rect
        x="0"
        y="8"
        width={shaftW}
        height="4"
        rx="1"
        fill="#b91c1c"
        fillOpacity={0.92}
      />
      <path
        d={`M${shaftW} 3 L${w} 10 L${shaftW} 17 Z`}
        fill="#dc2626"
        stroke="#7f1d1d"
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PickWindArrow({ widthPx, windToDeg }: { widthPx: number; windToDeg: number }) {
  const w = widthPx;
  const shaftW = Math.max(4, w - 12);
  const rot = cssRotateEastBaseToWindTo(windToDeg);
  return (
    <svg
      width={w}
      height={20}
      viewBox={`0 0 ${w} 20`}
      style={{
        display: "block",
        transform: `rotate(${rot}deg)`,
        transformOrigin: "0 50%",
        filter:
          "drop-shadow(0 0 1px rgb(255 255 255 / 0.9)) drop-shadow(0 0 2px rgb(255 255 255 / 0.5))",
      }}
      aria-hidden
    >
      <rect
        x="0"
        y="8"
        width={shaftW}
        height="4"
        rx="1"
        fill="#7c3aed"
        fillOpacity={0.95}
      />
      <path
        d={`M${shaftW} 4 L${w} 10 L${shaftW} 16 Z`}
        fill="#8b5cf6"
        stroke="#5b21b6"
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </svg>
  );
}
