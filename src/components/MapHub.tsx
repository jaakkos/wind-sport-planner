"use client";

import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type { FeatureCollection } from "geojson";
import { useSidebarTab } from "@/components/map-hub/hooks/useSidebarTab";
import { useMapLayerToggles } from "@/components/map-hub/hooks/useMapLayerToggles";
import { useMapBundle } from "@/components/map-hub/hooks/useMapBundle";
import { useExperiences } from "@/components/map-hub/hooks/useExperiences";
import { useForecastRanking } from "@/components/map-hub/hooks/useForecastRanking";
import { useRankingPreferences } from "@/components/map-hub/hooks/useRankingPreferences";
import { useForecastTime } from "@/components/map-hub/hooks/useForecastTime";
import { useToolSections } from "@/components/map-hub/hooks/useToolSections";
import { useFitMapToPracticeAreas } from "@/components/map-hub/hooks/useFitMapToPracticeAreas";
import { useTerrainPopoverPosition } from "@/components/map-hub/hooks/useTerrainPopoverPosition";
import { useTerrainProbe } from "@/components/map-hub/hooks/useTerrainProbe";
import { MapHubLegend } from "@/components/map-hub/MapHubLegend";
import { TerrainClickPanel } from "@/components/map-hub/TerrainClickPanel";
import { PracticeAreaEditPanel } from "@/components/map-hub/PracticeAreaEditPanel";
import { MapCanvas } from "@/components/map-hub/map/MapCanvas";
import { MapTab } from "@/components/map-hub/sidebar/MapTab";
import { PlanTab } from "@/components/map-hub/sidebar/PlanTab";
import { Sidebar } from "@/components/map-hub/sidebar/Sidebar";
import { YouTab } from "@/components/map-hub/sidebar/YouTab";
import { useBasemap } from "@/components/map-hub/hooks/useBasemap";
import type { RankedPracticeArea } from "@/lib/heuristics/rankAreaTypes";
import { yrNoHourlyTableUrlEn } from "@/lib/yrNoUrls";
import { ensureWindFieldArrowImage } from "@/lib/map/windFieldArrowIcon";
import {
  cardinalFromDeg,
  windFromFromDownwindArrow,
} from "@/lib/map/windFormat";
import {
  closePolygonCoordinates,
  haversineKm,
  outerRingOpenCoords,
} from "@/lib/map/polygons";
import {
  buildAreaNameLabels,
  buildAreasColored,
  buildWindFieldArrows,
  buildWindLabels,
  buildYrForecastPoints,
  selectedAreaOptimalWindMarker,
} from "@/lib/map/areaLayers";
import {
  buildDrawPreview,
  buildWindPickPreview,
  optimalWindMarkerLengthPx,
  windPickArrowLengthPx,
} from "@/lib/map/interactionLayers";
import {
  createPracticeArea,
  patchPracticeArea,
} from "@/lib/practiceArea/client";
import {
  createExperience,
  deleteExperience,
} from "@/lib/experiences/client";

export function MapHub() {
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const sessionPending = status === "loading";

  useEffect(() => {
    if (sessionPending || isAuthed) return;
    setMapMode("browse");
    setDrawRing([]);
    setEditingAreaId(null);
    setWindPickAreaId(null);
    setWindPickStart(null);
    setWindPickHover(null);
  }, [sessionPending, isAuthed]);

  const mapRef = useRef<MapRef>(null);
  /** Bumps on map `load` so effects can re-sync icons after the map instance exists. */
  const [mapEpoch, setMapEpoch] = useState(0);
  const [mapZoom, setMapZoom] = useState(5);
  const {
    basemap,
    setBasemap,
    reliefOpacity,
    setReliefOpacity,
    mapStyle,
    summary: basemapSummary,
    hasMaptilerKey,
  } = useBasemap();
  const [activeSport, setActiveSport] = useState<"kiteski" | "kitesurf">("kiteski");
  const {
    bundle,
    loading: bundleLoading,
    reload: loadBundle,
  } = useMapBundle(activeSport);
  const { experiences, reload: loadExperiences } = useExperiences(activeSport);
  const {
    setAnchorMs: setForecastAnchorMs,
    hoursAhead,
    setHoursAhead,
    atIso: forecastAtIso,
  } = useForecastTime();
  const [selectedPracticeAreaId, setSelectedPracticeAreaId] = useState<string | null>(null);
  const [areaForecastSampleFc, setAreaForecastSampleFc] = useState<FeatureCollection | null>(null);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const {
    terrain: terrainClick,
    probe: probeTerrain,
    clear: clearTerrain,
  } = useTerrainProbe();
  const [mapMode, setMapMode] = useState<"browse" | "draw" | "pickWind">("browse");
  const [drawRing, setDrawRing] = useState<[number, number][]>([]);
  const [drawAreaName, setDrawAreaName] = useState("");
  const [windPickStart, setWindPickStart] = useState<[number, number] | null>(null);
  const [windPickHover, setWindPickHover] = useState<[number, number] | null>(null);
  /** When set, user is drawing optimal wind for this practice area on the map. */
  const [windPickAreaId, setWindPickAreaId] = useState<string | null>(null);
  /** ± degrees around each area’s saved optimal for full direction multiplier before taper. */
  const [optimalWindHalfWidthDeg, setOptimalWindHalfWidthDeg] = useState(30);
  const [sectorHalfWidthDeg, setSectorHalfWidthDeg] = useState(45);
  const {
    ranked,
    loading: rankLoading,
    error: rankLoadError,
    reload: loadRank,
  } = useForecastRanking({
    sport: activeSport,
    atIso: forecastAtIso,
    optimalWindHalfWidthDeg,
    onError: setMsg,
  });
  /** Logged-in: editable wind bands & weights for forecast ranking (per sport). */
  const {
    rankingForm,
    multiPointForm,
    loading: rankingPrefsLoading,
    patchActiveSport: patchActiveSportRanking,
    patchMultiPoint,
    save: saveRankingPrefsForActiveSport,
    reset: resetRankingPrefsForActiveSport,
  } = useRankingPreferences({
    activeSport,
    enabled: isAuthed,
    pending: sessionPending,
    onSaved: loadRank,
    onError: setMsg,
    onClearError: () => setMsg(null),
  });
  const { tab: sidebarTab, setTab: setSidebarTab } = useSidebarTab();
  const {
    open: toolSectionsOpen,
    toggle: toggleToolSection,
    openSection: openToolSection,
    expandCurrentTab: expandCurrentTabSections,
    collapseCurrentTab: collapseCurrentTabSections,
    expandAll: expandAllToolSections,
  } = useToolSections(sidebarTab);

  /** Avoid SSR/client mismatch for `datetime-local` default and similar. */
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    setClientReady(true);
  }, []);

  const { toggles: mapLayerToggles, patch: patchMapLayerToggles } =
    useMapLayerToggles();

  const browseInteractiveLayerIds = useMemo(() => {
    if (mapMode !== "browse") return [];
    const ids: string[] = ["areas-fill"];
    if (mapLayerToggles.forecastSampleDots) {
      ids.push("yr-forecast-point", "yr-forecast-point-halo");
    }
    return ids;
  }, [mapMode, mapLayerToggles.forecastSampleDots]);

  const terrainPopoverPos = useTerrainPopoverPosition({
    mapRef,
    anchor: terrainClick ? { lat: terrainClick.lat, lng: terrainClick.lng } : null,
  });

  /** Centre map on ranked area centroid and select it (outline + edit panel). */
  const focusRankedAreaOnMap = useCallback((r: RankedPracticeArea) => {
    const map = mapRef.current?.getMap();
    if (map) {
      map.stop();
      const { lng, lat } = r.centroid;
      map.flyTo({
        center: [lng, lat],
        zoom: Math.max(map.getZoom(), 12),
        duration: 1000,
        essential: true,
      });
    }
    setSelectedPracticeAreaId(r.areaId);
    clearTerrain();
  }, [clearTerrain]);

  useFitMapToPracticeAreas({
    mapRef,
    practiceAreas: bundle?.practiceAreas ?? null,
    activeSport,
    mapEpoch,
  });

  const areasColored = useMemo(
    () => buildAreasColored(bundle?.practiceAreas, ranked, selectedPracticeAreaId),
    [bundle, ranked, selectedPracticeAreaId],
  );

  const areaNameLabels = useMemo(
    () => buildAreaNameLabels(bundle?.practiceAreas),
    [bundle],
  );

  /** Wind field: GeoJSON points under area fill; SVG icon + map rotation in MapLibre symbol layer. */
  const windFieldArrowsGeoJson = useMemo(
    () => buildWindFieldArrows(bundle?.practiceAreas, ranked),
    [ranked, bundle],
  );

  const windFieldFeatureCount = windFieldArrowsGeoJson.features.length;
  useEffect(() => {
    if (windFieldFeatureCount === 0) return;
    const map = mapRef.current?.getMap();
    if (!map?.isStyleLoaded()) return;
    ensureWindFieldArrowImage(map);
  }, [mapEpoch, windFieldFeatureCount, mapStyle]);

  const windLabels = useMemo(() => buildWindLabels(ranked), [ranked]);

  /** Centroid markers: click opens Yr.no hourly (point) forecast for that coordinate. */
  const yrForecastPoints = useMemo(() => buildYrForecastPoints(ranked), [ranked]);

  /** Downwind preview at selected area centroid when that area has a saved optimal (CSS marker). */
  const selectedOptimalWindMarker = useMemo(
    () => selectedAreaOptimalWindMarker(bundle?.practiceAreas, selectedPracticeAreaId),
    [bundle, selectedPracticeAreaId],
  );

  useEffect(() => {
    if (mapMode === "draw") {
      setSidebarTab("you");
      openToolSection("draw");
    }
  }, [mapMode, setSidebarTab, openToolSection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mapMode === "pickWind") {
        setWindPickStart(null);
        setWindPickHover(null);
        setWindPickAreaId(null);
        setMapMode("browse");
        return;
      }
      if (mapMode === "draw") {
        setDrawRing([]);
        setMapMode("browse");
        setEditingAreaId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mapMode]);

  const beginPickWindForArea = useCallback(
    (id: string) => {
      if (mapMode === "draw") {
        setMsg("Finish or cancel area drawing first.");
        setSidebarTab("you");
        openToolSection("draw");
        return;
      }
      setWindPickAreaId(id);
      setWindPickStart(null);
      setWindPickHover(null);
      clearTerrain();
      setMapMode("pickWind");
      setSidebarTab("plan");
      openToolSection("windRank");
      setMsg("Area optimal: click arrow tail, then head (downwind). Esc = cancel.");
    },
    [mapMode, setSidebarTab, openToolSection, clearTerrain],
  );

  const cancelPickWind = useCallback(() => {
    setWindPickAreaId(null);
    setWindPickStart(null);
    setWindPickHover(null);
    setMapMode("browse");
  }, []);

  const windPickPreview = useMemo(
    () => buildWindPickPreview({ mapMode, windPickStart, windPickHover }),
    [mapMode, windPickStart, windPickHover],
  );

  const optimalWindLenPx = useMemo(
    () => optimalWindMarkerLengthPx(selectedOptimalWindMarker, mapZoom),
    [selectedOptimalWindMarker, mapZoom],
  );

  const windPickArrowLenPx = useMemo(
    () => windPickArrowLengthPx(windPickPreview, mapZoom),
    [windPickPreview, mapZoom],
  );

  const drawPreview = useMemo(() => buildDrawPreview(drawRing), [drawRing]);

  async function savePracticeArea(
    poly: GeoJSON.Polygon,
    windSectors?: [number, number][],
    nameOverride?: string,
  ) {
    setLoading(true);
    setMsg(null);
    try {
      const nameRaw = (nameOverride ?? drawAreaName).trim() || "Untitled area";
      await createPracticeArea({
        geojson: poly,
        sports: [activeSport],
        labelPreset: "other",
        name: nameRaw.slice(0, 120),
        ...(windSectors?.length ? { windSectors } : {}),
      });
      await loadBundle();
      await loadRank();
      setDrawAreaName("");
      setMsg("Area saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  function finishDrawing() {
    const poly = closePolygonCoordinates(drawRing);
    if (!poly) {
      setMsg("Need at least 3 points. Click the map to add corners, then Finish.");
      return;
    }
    const editTarget = editingAreaId;
    setDrawRing([]);
    setMapMode("browse");
    setEditingAreaId(null);
    if (editTarget) {
      void (async () => {
        setLoading(true);
        setMsg(null);
        try {
          await patchPracticeArea(editTarget, { geojson: poly });
          await loadBundle();
          await loadRank();
          setMsg("Boundary updated.");
        } catch (e) {
          setMsg(e instanceof Error ? e.message : "Update failed");
        } finally {
          setLoading(false);
        }
      })();
      return;
    }
    void savePracticeArea(poly, undefined);
  }

  const windRankSummary = useMemo(() => {
    if (mapMode === "pickWind") {
      return "Drawing optimal wind for practice area…";
    }
    const pctHalf = Math.round((optimalWindHalfWidthDeg / 180) * 100);
    let band = "";
    if (isAuthed && rankingForm) {
      const w = rankingForm[activeSport];
      band = ` · ${w.minWindMs}–${w.maxWindMs} m/s`;
    }
    return `Per-area optimal · match width ±${optimalWindHalfWidthDeg}° (${pctHalf}% half-circle)${band}`;
  }, [mapMode, optimalWindHalfWidthDeg, isAuthed, rankingForm, activeSport]);

  const forecastSummary = useMemo(() => {
    const rel =
      hoursAhead === 0
        ? "anchored to this hour"
        : `+${hoursAhead}h from the anchor hour`;
    const scoringHint =
      sessionPending
        ? ""
        : isAuthed && rankingForm
          ? " · scoring below"
          : !isAuthed
            ? " · sign in for custom scoring"
            : "";
    return `${ranked.length} area(s) · ${rel}${scoringHint}`;
  }, [hoursAhead, ranked.length, sessionPending, isAuthed, rankingForm]);

  const scoringSummaryCollapsed = useMemo(() => {
    if (!rankingForm || !multiPointForm) return "Customize wind bands, sampling & weights";
    const w = rankingForm[activeSport];
    const modeLabel =
      multiPointForm.mode === "off"
        ? "centre only"
        : multiPointForm.mode === "auto"
          ? "auto multi-spot"
          : "multi-spot on";
    return `${w.minWindMs}–${w.maxWindMs} m/s · ${modeLabel}`;
  }, [rankingForm, multiPointForm, activeSport]);

  const startDrawing = useCallback(() => {
    setWindPickStart(null);
    setWindPickHover(null);
    setWindPickAreaId(null);
    setDrawRing([]);
    setEditingAreaId(null);
    setMapMode("draw");
    clearTerrain();
  }, [clearTerrain]);

  const undoDrawPoint = useCallback(() => {
    setDrawRing((r) => r.slice(0, -1));
  }, []);

  const cancelDrawing = useCallback(() => {
    setDrawRing([]);
    setMapMode("browse");
    setEditingAreaId(null);
  }, []);

  const submitExperience = useCallback(
    async (input: {
      practiceAreaId: string;
      occurredAt: string;
      sessionSuitability: string;
    }) => {
      setLoading(true);
      setMsg(null);
      try {
        await createExperience({
          practiceAreaId: input.practiceAreaId,
          sport: activeSport,
          occurredAt: input.occurredAt,
          sessionSuitability: input.sessionSuitability,
        });
        await loadExperiences();
        await loadRank();
        setMsg("Experience saved.");
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Save failed");
      } finally {
        setLoading(false);
      }
    },
    [activeSport, loadExperiences, loadRank],
  );

  const removeExperience = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        await deleteExperience(id);
        await loadExperiences();
        await loadRank();
        setMsg("Experience removed.");
      } catch {
        setMsg("Could not delete experience.");
      } finally {
        setLoading(false);
      }
    },
    [loadExperiences, loadRank],
  );

  const handleMapLoad = useCallback<
    React.ComponentProps<typeof MapCanvas>["onMapLoad"]
  >((e) => {
    const map = e.target;
    setMapEpoch((n) => n + 1);
    const z = map.getZoom();
    if (typeof z === "number" && Number.isFinite(z)) setMapZoom(z);
    const syncWindFieldArrow = () => ensureWindFieldArrowImage(map);
    syncWindFieldArrow();
    map.on("style.load", syncWindFieldArrow);
  }, []);

  const handleMapStyleData = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map?.isStyleLoaded()) ensureWindFieldArrowImage(map);
  }, []);

  const handleMapMouseMove = useCallback<
    React.ComponentProps<typeof MapCanvas>["onMouseMove"]
  >(
    (e) => {
      if (mapMode !== "pickWind" || windPickStart == null) return;
      const { lng, lat } = e.lngLat;
      setWindPickHover([lng, lat]);
    },
    [mapMode, windPickStart],
  );

  const handleMapContextMenu = useCallback<
    React.ComponentProps<typeof MapCanvas>["onContextMenu"]
  >(
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
    [mapMode],
  );

  const handleMapClick = useCallback<
    React.ComponentProps<typeof MapCanvas>["onClick"]
  >(
    (e) => {
      if (mapMode === "pickWind") {
        const { lng, lat } = e.lngLat;
        if (windPickStart == null) {
          setWindPickStart([lng, lat]);
          setWindPickHover([lng, lat]);
          setMsg("Click where the wind blows (arrow head). Right-click = reset tail.");
          return;
        }
        const [sx, sy] = windPickStart;
        const distKm = haversineKm(sx, sy, lng, lat);
        if (distKm < 0.003) {
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
        return;
      }
      if (mapMode === "draw") {
        const { lng, lat } = e.lngLat;
        setDrawRing((r) => [...r, [lng, lat]]);
        return;
      }
      const hits = e.features ?? [];
      const yrHit = hits.find(
        (h) =>
          h.layer?.id === "yr-forecast-point" ||
          h.layer?.id === "yr-forecast-point-halo",
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
    },
    [mapMode, windPickStart, windPickAreaId, loadBundle, loadRank, clearTerrain, probeTerrain],
  );

  return (
    <div className="relative h-screen w-full">
      <Sidebar
        busy={bundleLoading || rankLoading}
        sidebarTab={sidebarTab}
        setSidebarTab={setSidebarTab}
        expandCurrentTabSections={expandCurrentTabSections}
        collapseCurrentTabSections={collapseCurrentTabSections}
        expandAllToolSections={expandAllToolSections}
      >
            {sidebarTab === "plan" && (
              <PlanTab
                activeSport={activeSport}
                setActiveSport={setActiveSport}
                toolSectionsOpen={{
                  sport: toolSectionsOpen.sport,
                  forecast: toolSectionsOpen.forecast,
                  windRank: toolSectionsOpen.windRank,
                }}
                toggleToolSection={toggleToolSection}
                hoursAhead={hoursAhead}
                setHoursAhead={setHoursAhead}
                forecastAtIso={forecastAtIso}
                setForecastAnchorMs={setForecastAnchorMs}
                forecastSummary={forecastSummary}
                rankLoadError={rankLoadError}
                rankLoading={rankLoading}
                ranked={ranked}
                isAuthed={isAuthed}
                focusRankedAreaOnMap={focusRankedAreaOnMap}
                rankingPrefsLoading={rankingPrefsLoading}
                rankingForm={rankingForm}
                multiPointForm={multiPointForm}
                scoringSummaryCollapsed={scoringSummaryCollapsed}
                patchActiveSportRanking={patchActiveSportRanking}
                patchMultiPoint={patchMultiPoint}
                saveRankingPrefsForActiveSport={saveRankingPrefsForActiveSport}
                resetRankingPrefsForActiveSport={resetRankingPrefsForActiveSport}
                windRankSummary={windRankSummary}
                mapMode={mapMode}
                windPickStart={windPickStart}
                cancelPickWind={cancelPickWind}
                optimalWindHalfWidthDeg={optimalWindHalfWidthDeg}
                setOptimalWindHalfWidthDeg={setOptimalWindHalfWidthDeg}
                sectorHalfWidthDeg={sectorHalfWidthDeg}
                setSectorHalfWidthDeg={setSectorHalfWidthDeg}
              />
            )}
            {sidebarTab === "map" && (
              <MapTab
                basemap={basemap}
                setBasemap={setBasemap}
                basemapSummary={basemapSummary}
                hasMaptilerKey={hasMaptilerKey}
                reliefOpacity={reliefOpacity}
                setReliefOpacity={setReliefOpacity}
                mapLayerToggles={mapLayerToggles}
                onPatchMapLayerToggles={patchMapLayerToggles}
                toolSectionsOpen={{
                  basemap: toolSectionsOpen.basemap,
                  overlays: toolSectionsOpen.overlays,
                }}
                toggleToolSection={toggleToolSection}
              />
            )}
            {sidebarTab === "you" && (
              <YouTab
                isAuthed={isAuthed}
                sessionPending={sessionPending}
                activeSport={activeSport}
                msg={msg}
                loading={loading}
                clientReady={clientReady}
                bundle={bundle}
                mapMode={mapMode}
                editingAreaId={editingAreaId}
                drawAreaName={drawAreaName}
                setDrawAreaName={setDrawAreaName}
                drawRing={drawRing}
                onStartDrawing={startDrawing}
                onFinishDrawing={() => void finishDrawing()}
                onUndoDrawPoint={undoDrawPoint}
                onCancelDrawing={cancelDrawing}
                experiences={experiences}
                onSubmitExperience={submitExperience}
                onRemoveExperience={removeExperience}
                onMessage={setMsg}
                onSignOut={() => void signOut({ callbackUrl: "/login" })}
                toolSectionsOpen={{
                  draw: toolSectionsOpen.draw,
                  experiences: toolSectionsOpen.experiences,
                  account: toolSectionsOpen.account,
                }}
                toggleToolSection={toggleToolSection}
              />
            )}
      </Sidebar>

      {terrainClick && terrainPopoverPos ? (
        <TerrainClickPanel
          terrain={terrainClick}
          onClose={clearTerrain}
          style={{
            left: terrainPopoverPos.left,
            top: terrainPopoverPos.top,
          }}
        />
      ) : null}

      <MapCanvas
        mapRef={mapRef}
        mapStyle={mapStyle}
        mapMode={mapMode}
        browseInteractiveLayerIds={browseInteractiveLayerIds}
        layerToggles={mapLayerToggles}
        areasColored={areasColored}
        areaNameLabels={areaNameLabels}
        windFieldArrowsGeoJson={windFieldArrowsGeoJson}
        windLabels={windLabels}
        yrForecastPoints={yrForecastPoints}
        areaForecastSampleFc={areaForecastSampleFc}
        drawPreview={drawPreview}
        selectedOptimalWindMarker={selectedOptimalWindMarker}
        optimalWindLenPx={optimalWindLenPx}
        windPickPreview={windPickPreview}
        windPickArrowLenPx={windPickArrowLenPx}
        onMapLoad={handleMapLoad}
        onMapStyleData={handleMapStyleData}
        onMapZoomChange={setMapZoom}
        onMouseMove={handleMapMouseMove}
        onContextMenu={handleMapContextMenu}
        onClick={handleMapClick}
      />

      <MapHubLegend
        onBeforeOpenHelp={() => setSidebarTab("plan")}
        avoidEditPanelOverlap={Boolean(selectedPracticeAreaId && bundle)}
      />

      {selectedPracticeAreaId && bundle ? (
        <PracticeAreaEditPanel
          areaId={selectedPracticeAreaId}
          bundle={bundle}
          sectorHalfWidthDeg={sectorHalfWidthDeg}
          forecastAtIso={forecastAtIso}
          activeSport={activeSport}
          optimalWindHalfWidthDeg={optimalWindHalfWidthDeg}
          onForecastSamplesMapChange={setAreaForecastSampleFc}
          areaWindPickActive={
            mapMode === "pickWind" && windPickAreaId === selectedPracticeAreaId
          }
          onDrawAreaOptimalWind={() => beginPickWindForArea(selectedPracticeAreaId)}
          onCancelWindPick={() => cancelPickWind()}
          onClose={() => {
            if (mapMode === "pickWind" && windPickAreaId === selectedPracticeAreaId) {
              cancelPickWind();
            }
            setSelectedPracticeAreaId(null);
          }}
          onSaved={async () => {
            await loadBundle();
            await loadExperiences();
            await loadRank();
          }}
          onStartBoundaryEdit={(poly) => {
            setEditingAreaId(selectedPracticeAreaId);
            setDrawRing(outerRingOpenCoords(poly));
            setMapMode("draw");
            setSelectedPracticeAreaId(null);
            clearTerrain();
            setMsg("Adjust corners, then Finish & save.");
          }}
        />
      ) : null}
    </div>
  );
}

