"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
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
import { useMapLayers } from "@/components/map-hub/hooks/useMapLayers";
import { useMapEventHandlers } from "@/components/map-hub/hooks/useMapEventHandlers";
import { useSidebarSummaries } from "@/components/map-hub/hooks/useSidebarSummaries";
import { useMapInteractionMode } from "@/components/map-hub/hooks/useMapInteractionMode";
import {
  useMapInstance,
  useEnsureWindFieldArrowImage,
} from "@/components/map-hub/hooks/useMapInstance";
import { MapHubLegend } from "@/components/map-hub/MapHubLegend";
import { TerrainClickPanel } from "@/components/map-hub/TerrainClickPanel";
import { PracticeAreaEditPanel } from "@/components/map-hub/PracticeAreaEditPanel";
import { MapCanvas } from "@/components/map-hub/map/MapCanvas";
import { MapTab } from "@/components/map-hub/sidebar/MapTab";
import { PlanTab } from "@/components/map-hub/sidebar/PlanTab";
import { Sidebar } from "@/components/map-hub/sidebar/Sidebar";
import { YouTab } from "@/components/map-hub/sidebar/YouTab";
import { useBasemap } from "@/components/map-hub/hooks/useBasemap";

export function MapHub() {
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const sessionPending = status === "loading";

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
  const {
    setAnchorMs: setForecastAnchorMs,
    hoursAhead,
    setHoursAhead,
    atIso: forecastAtIso,
  } = useForecastTime();
  const [selectedPracticeAreaId, setSelectedPracticeAreaId] = useState<string | null>(null);
  const [areaForecastSampleFc, setAreaForecastSampleFc] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const {
    terrain: terrainClick,
    probe: probeTerrain,
    clear: clearTerrain,
  } = useTerrainProbe();
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
  const {
    experiences,
    reload: loadExperiences,
    submit: submitExperience,
    remove: removeExperience,
  } = useExperiences({
    activeSport,
    onChanged: loadRank,
    setMessage: setMsg,
    setLoading,
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

  const {
    mapMode,
    drawRing,
    setDrawRing,
    drawAreaName,
    setDrawAreaName,
    editingAreaId,
    windPickStart,
    setWindPickStart,
    windPickHover,
    setWindPickHover,
    windPickAreaId,
    setWindPickAreaId,
    setMapMode,
    startDrawing,
    undoDrawPoint,
    cancelDrawing,
    finishDrawing,
    beginPickWindForArea,
    cancelPickWind,
    startBoundaryEdit,
  } = useMapInteractionMode({
    isAuthed,
    sessionPending,
    activeSport,
    setMessage: setMsg,
    setLoading,
    loadBundle,
    loadRank,
    clearTerrain,
    setSidebarTab,
    openToolSection,
    setSelectedPracticeAreaId,
  });

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

  const {
    mapRef,
    mapEpoch,
    setMapEpoch,
    mapZoom,
    setMapZoom,
    focusRankedAreaOnMap,
  } = useMapInstance({ setSelectedPracticeAreaId, clearTerrain });

  const terrainPopoverPos = useTerrainPopoverPosition({
    mapRef,
    anchor: terrainClick ? { lat: terrainClick.lat, lng: terrainClick.lng } : null,
  });

  useFitMapToPracticeAreas({
    mapRef,
    practiceAreas: bundle?.practiceAreas ?? null,
    activeSport,
    mapEpoch,
  });

  const {
    areasColored,
    areaNameLabels,
    windFieldArrowsGeoJson,
    windLabels,
    yrForecastPoints,
    selectedOptimalWindMarker,
    windPickPreview,
    optimalWindLenPx,
    windPickArrowLenPx,
    drawPreview,
  } = useMapLayers({
    bundle,
    ranked,
    selectedPracticeAreaId,
    mapMode,
    drawRing,
    windPickStart,
    windPickHover,
    mapZoom,
  });

  useEnsureWindFieldArrowImage({
    mapRef,
    mapEpoch,
    mapStyle,
    windFieldFeatureCount: windFieldArrowsGeoJson.features.length,
  });

  const { windRankSummary, forecastSummary, scoringSummaryCollapsed } =
    useSidebarSummaries({
      isAuthed,
      sessionPending,
      activeSport,
      mapMode,
      optimalWindHalfWidthDeg,
      rankingForm,
      multiPointForm,
      hoursAhead,
      rankedCount: ranked.length,
    });

  const {
    onMapLoad: handleMapLoad,
    onMapStyleData: handleMapStyleData,
    onMouseMove: handleMapMouseMove,
    onContextMenu: handleMapContextMenu,
    onClick: handleMapClick,
  } = useMapEventHandlers({
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
  });

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
                onFinishDrawing={finishDrawing}
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
          onStartBoundaryEdit={(poly) =>
            startBoundaryEdit(poly, selectedPracticeAreaId)
          }
        />
      ) : null}
    </div>
  );
}

