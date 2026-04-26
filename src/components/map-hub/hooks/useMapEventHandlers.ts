"use client";

import { useCallback } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type * as React from "react";

import type { MapCanvas } from "@/components/map-hub/map/MapCanvas";
import { ensureWindFieldArrowImage } from "@/lib/map/windFieldArrowIcon";
import { haversineKm } from "@/lib/map/polygons";
import { cardinalFromDeg, windFromFromDownwindArrow } from "@/lib/map/windFormat";
import { patchPracticeArea } from "@/lib/practiceArea/client";
import { yrNoHourlyTableUrlEn } from "@/lib/yrNoUrls";

type MapCanvasProps = React.ComponentProps<typeof MapCanvas>;

type Args = {
  mapRef: React.RefObject<MapRef | null>;
  mapMode: "browse" | "draw" | "pickWind";
  setMapMode: (next: "browse" | "draw" | "pickWind") => void;
  windPickStart: [number, number] | null;
  windPickAreaId: string | null;
  setWindPickStart: (v: [number, number] | null) => void;
  setWindPickHover: (v: [number, number] | null) => void;
  setWindPickAreaId: (v: string | null) => void;
  setDrawRing: React.Dispatch<React.SetStateAction<[number, number][]>>;
  setSelectedPracticeAreaId: (id: string | null) => void;
  setMsg: (msg: string | null) => void;
  setLoading: (loading: boolean) => void;
  setMapEpoch: React.Dispatch<React.SetStateAction<number>>;
  setMapZoom: (z: number) => void;
  loadBundle: () => Promise<void> | void;
  loadRank: () => Promise<void> | void;
  clearTerrain: () => void;
  probeTerrain: (lat: number, lng: number) => void;
};

/**
 * Bundles the five MapCanvas event handlers (load, style data, mouse
 * move, context menu, click) along with their state-machine logic for
 * pickWind and draw modes. Keeping them in one place makes the
 * interactions auditable as a unit and keeps MapHub free of imperative
 * map plumbing.
 */
export function useMapEventHandlers({
  mapRef,
  mapMode,
  setMapMode,
  windPickStart,
  windPickAreaId,
  setWindPickStart,
  setWindPickHover,
  setWindPickAreaId,
  setDrawRing,
  setSelectedPracticeAreaId,
  setMsg,
  setLoading,
  setMapEpoch,
  setMapZoom,
  loadBundle,
  loadRank,
  clearTerrain,
  probeTerrain,
}: Args) {
  const onMapLoad = useCallback<NonNullable<MapCanvasProps["onMapLoad"]>>(
    (e) => {
      const map = e.target;
      setMapEpoch((n) => n + 1);
      const z = map.getZoom();
      if (typeof z === "number" && Number.isFinite(z)) setMapZoom(z);
      const syncWindFieldArrow = () => ensureWindFieldArrowImage(map);
      syncWindFieldArrow();
      map.on("style.load", syncWindFieldArrow);
    },
    [setMapEpoch, setMapZoom],
  );

  const onMapStyleData = useCallback<NonNullable<MapCanvasProps["onMapStyleData"]>>(() => {
    const map = mapRef.current?.getMap();
    if (map?.isStyleLoaded()) ensureWindFieldArrowImage(map);
  }, [mapRef]);

  const onMouseMove = useCallback<NonNullable<MapCanvasProps["onMouseMove"]>>(
    (e) => {
      if (mapMode !== "pickWind" || windPickStart == null) return;
      const { lng, lat } = e.lngLat;
      setWindPickHover([lng, lat]);
    },
    [mapMode, windPickStart, setWindPickHover],
  );

  const onContextMenu = useCallback<NonNullable<MapCanvasProps["onContextMenu"]>>(
    (e) => {
      if (mapMode === "draw") {
        e.preventDefault();
        setDrawRing((r) => r.slice(0, -1));
        return;
      }
      if (mapMode === "pickWind") {
        e.preventDefault();
        setWindPickStart(null);
        setWindPickHover(null);
      }
    },
    [mapMode, setDrawRing, setWindPickStart, setWindPickHover],
  );

  const onClick = useCallback<NonNullable<MapCanvasProps["onClick"]>>(
    (e) => {
      if (mapMode === "pickWind") {
        handlePickWindClick({
          e,
          windPickStart,
          windPickAreaId,
          setWindPickStart,
          setWindPickHover,
          setWindPickAreaId,
          setMapMode,
          setMsg,
          setLoading,
          loadBundle,
          loadRank,
        });
        return;
      }
      if (mapMode === "draw") {
        const { lng, lat } = e.lngLat;
        setDrawRing((r) => [...r, [lng, lat]]);
        return;
      }
      handleBrowseClick({
        e,
        setSelectedPracticeAreaId,
        clearTerrain,
        probeTerrain,
      });
    },
    [
      mapMode,
      windPickStart,
      windPickAreaId,
      setWindPickStart,
      setWindPickHover,
      setWindPickAreaId,
      setMapMode,
      setDrawRing,
      setSelectedPracticeAreaId,
      setMsg,
      setLoading,
      loadBundle,
      loadRank,
      clearTerrain,
      probeTerrain,
    ],
  );

  return {
    onMapLoad,
    onMapStyleData,
    onMouseMove,
    onContextMenu,
    onClick,
  };
}

type ClickEvent = Parameters<NonNullable<MapCanvasProps["onClick"]>>[0];

function handlePickWindClick({
  e,
  windPickStart,
  windPickAreaId,
  setWindPickStart,
  setWindPickHover,
  setWindPickAreaId,
  setMapMode,
  setMsg,
  setLoading,
  loadBundle,
  loadRank,
}: {
  e: ClickEvent;
  windPickStart: Args["windPickStart"];
  windPickAreaId: Args["windPickAreaId"];
  setWindPickStart: Args["setWindPickStart"];
  setWindPickHover: Args["setWindPickHover"];
  setWindPickAreaId: Args["setWindPickAreaId"];
  setMapMode: Args["setMapMode"];
  setMsg: Args["setMsg"];
  setLoading: Args["setLoading"];
  loadBundle: Args["loadBundle"];
  loadRank: Args["loadRank"];
}) {
  const { lng, lat } = e.lngLat;
  if (windPickStart == null) {
    setWindPickStart([lng, lat]);
    setWindPickHover([lng, lat]);
    setMsg("Click where the wind blows (arrow head). Right-click = reset tail.");
    return;
  }
  const [sx, sy] = windPickStart;
  if (haversineKm(sx, sy, lng, lat) < 0.003) {
    setMsg("Move farther and click again to set direction.");
    return;
  }
  const from = windFromFromDownwindArrow(sx, sy, lng, lat);
  const aid = windPickAreaId;
  setWindPickStart(null);
  setWindPickHover(null);
  setWindPickAreaId(null);
  setMapMode("browse");
  if (!aid) {
    setMsg("Wind draw had no target area — open Edit area and try again.");
    return;
  }
  setLoading(true);
  void (async () => {
    try {
      await patchPracticeArea(aid, { optimalWindFromDeg: from });
      await loadBundle();
      await loadRank();
      setMsg(
        `Saved area optimal: ${cardinalFromDeg(from)} (${Math.round(from)}°) wind from.`,
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save area optimal.");
    } finally {
      setLoading(false);
    }
  })();
}

function handleBrowseClick({
  e,
  setSelectedPracticeAreaId,
  clearTerrain,
  probeTerrain,
}: {
  e: ClickEvent;
  setSelectedPracticeAreaId: Args["setSelectedPracticeAreaId"];
  clearTerrain: Args["clearTerrain"];
  probeTerrain: Args["probeTerrain"];
}) {
  const hits = e.features ?? [];
  const yrHit = hits.find(
    (h) =>
      h.layer?.id === "yr-forecast-point" || h.layer?.id === "yr-forecast-point-halo",
  );
  if (yrHit?.geometry?.type === "Point") {
    const c = yrHit.geometry.coordinates;
    const lng = c[0]!;
    const lat = c[1]!;
    window.open(yrNoHourlyTableUrlEn(lat, lng), "_blank", "noopener,noreferrer");
    return;
  }
  const areaHit = hits.find((h) => h.layer?.id === "areas-fill");
  if (
    !e.originalEvent.shiftKey &&
    areaHit?.properties &&
    typeof (areaHit.properties as { id?: string }).id === "string"
  ) {
    setSelectedPracticeAreaId(String((areaHit.properties as { id: string }).id));
    clearTerrain();
    return;
  }
  if (e.originalEvent.shiftKey) {
    const { lng, lat } = e.lngLat;
    window.open(yrNoHourlyTableUrlEn(lat, lng), "_blank", "noopener,noreferrer");
    return;
  }
  const { lng, lat } = e.lngLat;
  probeTerrain(lat, lng);
}
