"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapGL, {
  Layer,
  MapRef,
  Marker,
  NavigationControl,
  Source,
} from "react-map-gl/maplibre";
import bbox from "@turf/bbox";
import centroid from "@turf/centroid";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import {
  ALL_TOOL_SECTIONS_OPEN,
  DEFAULT_TOOL_SECTIONS,
  type SidebarTab,
  SIDEBAR_TAB_STORAGE,
  type ToolSectionKey,
  toolKeysForTab,
} from "@/components/map-hub/constants";
import { CollapsibleSection } from "@/components/map-hub/CollapsibleSection";
import { HelpDisclosure, PersistedCollapsible } from "@/components/map-hub/MapHubDisclosures";
import { ForecastTimeControl } from "@/components/map-hub/ForecastTimeControl";
import { MapLayerOverlaysSection } from "@/components/map-hub/MapLayerOverlaysSection";
import { MapHubLegend } from "@/components/map-hub/MapHubLegend";
import { TerrainClickPanel } from "@/components/map-hub/TerrainClickPanel";
import { RankedAreaRow } from "@/components/map-hub/RankedAreaRow";
import { RankedListSkeleton, ScoringPrefsSkeleton } from "@/components/map-hub/hubSkeleton";
import { hubOverlayZ } from "@/components/map-hub/mapHubOverlayZ";
import { PracticeAreaEditPanel } from "@/components/map-hub/PracticeAreaEditPanel";
import {
  hubBtnPrimary,
  hubBtnSecondary,
  hubBtnSecondaryToolbar,
  hubInputNative,
  hubKbd,
  hubListRow,
} from "@/components/map-hub/hubUi";
import {
  type BasemapId,
  buildRasterBasemapStyle,
  maptilerOutdoorStyleUrl,
} from "@/lib/map/styles";
import type { RankedPracticeArea } from "@/lib/heuristics/rankAreaTypes";
import {
  defaultMapLayerToggles,
  readMapLayerTogglesFromStorage,
  writeMapLayerTogglesToStorage,
  type MapLayerTogglesState,
} from "@/lib/map/mapLayerToggles";
import { formatVisibilityM } from "@/lib/weather/formatVisibility";
import { yrNoHourlyTableUrlEn } from "@/lib/yrNoUrls";
import {
  cssRotateEastBaseToWindTo,
  windToDegFromDirFrom,
} from "@/lib/map/windArrowDisplay";
import {
  ensureWindFieldArrowImage,
  WIND_FIELD_ARROW_IMAGE_ID,
} from "@/lib/map/windFieldArrowIcon";
import { clampArrowLengthInsidePolygon } from "@/lib/map/windArrowLength";
import {
  floorToHourMs,
  rankColor,
  toDatetimeLocalInput,
  terrainPopoverScreenPosition,
} from "@/lib/map/mapHubHelpers";
import {
  cardinalFromDeg,
  windCompactSummary,
  windFromFromDownwindArrow,
  windMultiPointSubtitle,
  windToFromWindFrom,
} from "@/lib/map/windFormat";
import {
  areaFeatureId,
  bearingDeg,
  closePolygonCoordinates,
  haversineKm,
  kmToScreenPx,
  MAX_TOTAL_WIND_FIELD_MARKERS,
  outerRingOpenCoords,
  WIND_FIELD_MAX_ARROWS,
} from "@/lib/map/polygons";
import {
  windFieldSpatialProbePoints,
  WIND_MAP_ARROW_MAX_SAMPLES_SETTING,
} from "@/lib/heuristics/windSamplePoints";

type Bundle = {
  activeSport: string;
  practiceAreas: FeatureCollection;
};

type ExperienceRow = {
  id: string;
  practiceAreaId: string;
  practiceAreaName: string;
  sport: string;
  occurredAt: string;
  sessionSuitability: string;
  windDirDeg: number | null;
  windSpeedMs: number | null;
  weatherProviderId: string | null;
  weatherObservedAt: string | null;
};

type SportRankingFormState = {
  minWindMs: number;
  maxWindMs: number;
  idealMinMs: number;
  idealMaxMs: number;
  windFitScale: number;
  gustPenaltyScale: number;
  directionEmphasis: number;
};

type MultiPointForecastFormState = {
  mode: "off" | "auto" | "on";
  maxSamples: number;
  scoringPolicy: "representative" | "conservative";
};

type RankingPrefsApiResponse = {
  doc: {
    kiteski?: Partial<SportRankingFormState>;
    kitesurf?: Partial<SportRankingFormState>;
    multiPointForecast?: Partial<MultiPointForecastFormState>;
  } | null;
  defaults: Record<
    "kiteski" | "kitesurf",
    SportRankingFormState & {
      bands: { minMs: number; maxMs: number; idealMin: number; idealMax: number };
    }
  >;
  multiPointForecast: MultiPointForecastFormState;
};

function sportFormFromDefaults(
  sport: "kiteski" | "kitesurf",
  doc: RankingPrefsApiResponse["doc"],
  defaults: RankingPrefsApiResponse["defaults"],
): SportRankingFormState {
  const d = defaults[sport];
  const p = doc?.[sport];
  return {
    minWindMs: p?.minWindMs ?? d.minWindMs,
    maxWindMs: p?.maxWindMs ?? d.maxWindMs,
    idealMinMs: p?.idealMinMs ?? d.idealMinMs,
    idealMaxMs: p?.idealMaxMs ?? d.idealMaxMs,
    windFitScale: p?.windFitScale ?? d.windFitScale,
    gustPenaltyScale: p?.gustPenaltyScale ?? d.gustPenaltyScale,
    directionEmphasis: p?.directionEmphasis ?? d.directionEmphasis,
  };
}

type ClickTerrain = {
  lat: number;
  lng: number;
  elevationM: number | null;
  loading: boolean;
  error?: string;
};

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
  /** Avoid re-fitting the same practice-area set when rank/bundle updates. */
  const lastPracticeAreaFitSigRef = useRef<string>("");
  /** Bumps on map `load` so effects can re-sync icons after the map instance exists. */
  const [mapEpoch, setMapEpoch] = useState(0);
  const [mapZoom, setMapZoom] = useState(5);
  const [basemap, setBasemap] = useState<BasemapId>("hybrid");
  const [reliefOpacity, setReliefOpacity] = useState(0.42);
  const [activeSport, setActiveSport] = useState<"kiteski" | "kitesurf">("kiteski");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [bundleLoading, setBundleLoading] = useState(true);
  const [ranked, setRanked] = useState<RankedPracticeArea[]>([]);
  const [rankLoading, setRankLoading] = useState(true);
  const [forecastAnchorMs, setForecastAnchorMs] = useState(() => floorToHourMs());
  const [hoursAhead, setHoursAhead] = useState(0);
  const forecastAtIso = useMemo(
    () => new Date(forecastAnchorMs + hoursAhead * 3600000).toISOString(),
    [forecastAnchorMs, hoursAhead],
  );
  const [selectedPracticeAreaId, setSelectedPracticeAreaId] = useState<string | null>(null);
  const [areaForecastSampleFc, setAreaForecastSampleFc] = useState<FeatureCollection | null>(null);
  const [experiences, setExperiences] = useState<ExperienceRow[]>([]);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /** Shown in Plan when ranking fails so users are not stuck with an empty list and no explanation. */
  const [rankLoadError, setRankLoadError] = useState<string | null>(null);
  const [terrainClick, setTerrainClick] = useState<ClickTerrain | null>(null);
  /** Screen position for terrain card (anchored to map click, updates on pan/zoom). */
  const [terrainPopoverPos, setTerrainPopoverPos] = useState<{
    left: number;
    top: number;
  } | null>(null);
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
  /** Logged-in: editable wind bands & weights for forecast ranking (per sport). */
  const [rankingForm, setRankingForm] = useState<{
    kiteski: SportRankingFormState;
    kitesurf: SportRankingFormState;
  } | null>(null);
  const [multiPointForm, setMultiPointForm] = useState<MultiPointForecastFormState | null>(
    null,
  );
  const [rankingPrefsLoading, setRankingPrefsLoading] = useState(false);
  const [toolSectionsOpen, setToolSectionsOpen] =
    useState<Record<ToolSectionKey, boolean>>(DEFAULT_TOOL_SECTIONS);

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("plan");

  /** Avoid SSR/client mismatch for `datetime-local` default and similar. */
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_TAB_STORAGE);
      if (raw === "plan" || raw === "map" || raw === "you") setSidebarTab(raw);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_TAB_STORAGE, sidebarTab);
    } catch {
      /* ignore */
    }
  }, [sidebarTab]);

  const expandCurrentTabSections = useCallback(() => {
    setToolSectionsOpen((s) => {
      const next = { ...s };
      for (const k of toolKeysForTab(sidebarTab)) next[k] = true;
      return next;
    });
  }, [sidebarTab]);

  const collapseCurrentTabSections = useCallback(() => {
    setToolSectionsOpen((s) => {
      const next = { ...s };
      for (const k of toolKeysForTab(sidebarTab)) next[k] = false;
      return next;
    });
  }, [sidebarTab]);

  const toggleToolSection = useCallback((key: ToolSectionKey) => {
    setToolSectionsOpen((s) => ({ ...s, [key]: !s[key] }));
  }, []);

  const [mapLayerToggles, setMapLayerToggles] = useState<MapLayerTogglesState>(() =>
    defaultMapLayerToggles(),
  );

  useEffect(() => {
    setMapLayerToggles(readMapLayerTogglesFromStorage());
  }, []);

  const patchMapLayerToggles = useCallback((patch: Partial<MapLayerTogglesState>) => {
    setMapLayerToggles((prev) => {
      const next = { ...prev, ...patch };
      writeMapLayerTogglesToStorage(next);
      return next;
    });
  }, []);

  const browseInteractiveLayerIds = useMemo(() => {
    if (mapMode !== "browse") return [];
    const ids: string[] = ["areas-fill"];
    if (mapLayerToggles.forecastSampleDots) {
      ids.push("yr-forecast-point", "yr-forecast-point-halo");
    }
    return ids;
  }, [mapMode, mapLayerToggles.forecastSampleDots]);

  useEffect(() => {
    if (!terrainClick) {
      setTerrainPopoverPos(null);
      return;
    }
    const map = mapRef.current?.getMap();
    if (!map) return;
    const { lng, lat } = terrainClick;
    const sync = () => {
      if (typeof window === "undefined") return;
      const p = map.project([lng, lat]);
      setTerrainPopoverPos(
        terrainPopoverScreenPosition(p.x, p.y, window.innerWidth, window.innerHeight),
      );
    };
    sync();
    map.on("move", sync);
    map.on("zoom", sync);
    map.on("resize", sync);
    window.addEventListener("resize", sync);
    return () => {
      map.off("move", sync);
      map.off("zoom", sync);
      map.off("resize", sync);
      window.removeEventListener("resize", sync);
    };
  }, [terrainClick]);

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
    setTerrainClick(null);
  }, []);

  const mapStyle = useMemo(() => {
    if (basemap === "maptiler_outdoor") {
      const url = maptilerOutdoorStyleUrl();
      if (url) return url;
      return buildRasterBasemapStyle("hybrid", reliefOpacity);
    }
    return buildRasterBasemapStyle(basemap, reliefOpacity);
  }, [basemap, reliefOpacity]);

  const loadBundle = useCallback(async () => {
    setBundleLoading(true);
    try {
      const r = await fetch(`/api/map/bundle?activeSport=${activeSport}`);
      if (!r.ok) return;
      const j = (await r.json()) as Bundle;
      setBundle(j);
    } finally {
      setBundleLoading(false);
    }
  }, [activeSport]);

  useEffect(() => {
    void loadBundle();
  }, [loadBundle]);

  const loadExperiences = useCallback(async () => {
    const r = await fetch(`/api/experiences?sport=${activeSport}`);
    if (!r.ok) return;
    const j = (await r.json()) as { experiences: ExperienceRow[] };
    setExperiences(j.experiences ?? []);
  }, [activeSport]);

  useEffect(() => {
    void loadExperiences();
  }, [loadExperiences]);

  const loadRankingPrefs = useCallback(async () => {
    setRankingPrefsLoading(true);
    try {
      const r = await fetch("/api/user/ranking-preferences");
      if (!r.ok) {
        setRankingForm(null);
        setMultiPointForm(null);
        return;
      }
      const j = (await r.json()) as RankingPrefsApiResponse;
      const dmp = j.doc?.multiPointForecast;
      const defMp = j.multiPointForecast;
      setRankingForm({
        kiteski: sportFormFromDefaults("kiteski", j.doc, j.defaults),
        kitesurf: sportFormFromDefaults("kitesurf", j.doc, j.defaults),
      });
      setMultiPointForm({
        mode: dmp?.mode ?? defMp.mode,
        maxSamples: dmp?.maxSamples ?? defMp.maxSamples,
        scoringPolicy: dmp?.scoringPolicy ?? defMp.scoringPolicy,
      });
    } finally {
      setRankingPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionPending) return;
    if (!isAuthed) {
      setRankingForm(null);
      setMultiPointForm(null);
      return;
    }
    void loadRankingPrefs();
  }, [sessionPending, isAuthed, loadRankingPrefs]);

  const patchActiveSportRanking = useCallback(
    (patch: Partial<SportRankingFormState>) => {
      setRankingForm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [activeSport]: { ...prev[activeSport], ...patch },
        };
      });
    },
    [activeSport],
  );

  const loadRank = useCallback(async () => {
    setRankLoadError(null);
    setRankLoading(true);
    const q = new URLSearchParams({
      sport: activeSport,
      at: forecastAtIso,
    });
    q.set("optimalWindHalfWidthDeg", String(optimalWindHalfWidthDeg));
    try {
      const r = await fetch(`/api/forecast/rank?${q.toString()}`);
      if (!r.ok) {
        let detail = "";
        try {
          const t = await r.text();
          detail = t ? ` ${t.slice(0, 240)}` : "";
        } catch {
          /* ignore */
        }
        const line = `Forecast ranking failed (HTTP ${r.status}).${detail}`;
        setRankLoadError(line);
        setMsg(`Forecast ranking failed (${r.status}). Wind overlays may be missing.`);
        setRanked([]);
        return;
      }
      const j = (await r.json()) as { ranked: RankedPracticeArea[] };
      setRanked(j.ranked ?? []);
      setRankLoadError(null);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setRankLoadError(`Forecast ranking could not load: ${m}`);
      setMsg(`Forecast ranking failed. ${m}`);
      setRanked([]);
    } finally {
      setRankLoading(false);
    }
  }, [activeSport, forecastAtIso, optimalWindHalfWidthDeg]);

  const saveRankingPrefsForActiveSport = useCallback(async () => {
    if (!rankingForm || !multiPointForm) return;
    const s = activeSport;
    const f = rankingForm[s];
    const r = await fetch("/api/user/ranking-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [s]: {
          minWindMs: f.minWindMs,
          maxWindMs: f.maxWindMs,
          idealMinMs: f.idealMinMs,
          idealMaxMs: f.idealMaxMs,
          windFitScale: f.windFitScale,
          gustPenaltyScale: f.gustPenaltyScale,
          directionEmphasis: f.directionEmphasis,
        },
        multiPointForecast: {
          mode: multiPointForm.mode,
          maxSamples: multiPointForm.maxSamples,
          scoringPolicy: multiPointForm.scoringPolicy,
        },
      }),
    });
    if (!r.ok) {
      setMsg("Could not save scoring preferences.");
      return;
    }
    setMsg(null);
    const j = (await r.json()) as RankingPrefsApiResponse;
    const dmp = j.doc?.multiPointForecast;
    const defMp = j.multiPointForecast;
    setRankingForm({
      kiteski: sportFormFromDefaults("kiteski", j.doc, j.defaults),
      kitesurf: sportFormFromDefaults("kitesurf", j.doc, j.defaults),
    });
    setMultiPointForm({
      mode: dmp?.mode ?? defMp.mode,
      maxSamples: dmp?.maxSamples ?? defMp.maxSamples,
      scoringPolicy: dmp?.scoringPolicy ?? defMp.scoringPolicy,
    });
    await loadRank();
  }, [rankingForm, multiPointForm, activeSport, loadRank]);

  const resetRankingPrefsForActiveSport = useCallback(async () => {
    const r = await fetch("/api/user/ranking-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [activeSport]: null }),
    });
    if (!r.ok) {
      setMsg("Could not reset scoring preferences.");
      return;
    }
    setMsg(null);
    const j = (await r.json()) as RankingPrefsApiResponse;
    const dmp = j.doc?.multiPointForecast;
    const defMp = j.multiPointForecast;
    setRankingForm({
      kiteski: sportFormFromDefaults("kiteski", j.doc, j.defaults),
      kitesurf: sportFormFromDefaults("kitesurf", j.doc, j.defaults),
    });
    setMultiPointForm({
      mode: dmp?.mode ?? defMp.mode,
      maxSamples: dmp?.maxSamples ?? defMp.maxSamples,
      scoringPolicy: dmp?.scoringPolicy ?? defMp.scoringPolicy,
    });
    await loadRank();
  }, [activeSport, loadRank]);

  useEffect(() => {
    const t = setTimeout(() => void loadRank(), 300);
    return () => clearTimeout(t);
  }, [loadRank]);

  useEffect(() => {
    const fc = bundle?.practiceAreas;
    if (!fc?.features.length) return;
    const ids = fc.features
      .map((f) => areaFeatureId(f))
      .filter((id) => id.length > 0)
      .sort()
      .join(",");
    const sig = `${activeSport}:${ids}`;
    if (lastPracticeAreaFitSigRef.current === sig) return;

    const map = mapRef.current?.getMap();
    if (!map) return;

    const runFit = () => {
      if (lastPracticeAreaFitSigRef.current === sig) return;
      try {
        const bounds = bbox(fc as FeatureCollection);
        const [minLng, minLat, maxLng, maxLat] = bounds;
        if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return;
        const sidebarPad =
          typeof window !== "undefined"
            ? Math.min(380, Math.round(window.innerWidth * 0.36))
            : 72;
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          {
            padding: { top: 64, bottom: 64, left: sidebarPad, right: 48 },
            maxZoom: 14,
            duration: 500,
          },
        );
        lastPracticeAreaFitSigRef.current = sig;
      } catch {
        /* invalid geometry for bbox */
      }
    };

    if (map.isStyleLoaded()) runFit();
    else map.once("load", runFit);
  }, [bundle?.practiceAreas, activeSport, mapEpoch]);

  const areasColored = useMemo(() => {
    if (!bundle?.practiceAreas) return null;
    const rankMap = new Map(ranked.map((r) => [r.areaId, r.score]));
    const features: Feature[] = bundle.practiceAreas.features.map((f) => {
      const props = (f.properties ?? {}) as Record<string, unknown>;
      const id = String(f.id ?? props.id ?? "");
      const score = rankMap.get(id) ?? 0;
      const sel = id === selectedPracticeAreaId ? 1 : 0;
      const isCommunity = props.isCommunity === 1 || props.isCommunity === true ? 1 : 0;
      const hasMapSelection = selectedPracticeAreaId != null ? 1 : 0;
      return {
        ...f,
        properties: {
          ...props,
          rankScore: score,
          rankColor: rankColor(score),
          selectedPractice: sel,
          isCommunity,
          hasMapSelection,
        },
      };
    });
    return { type: "FeatureCollection" as const, features };
  }, [bundle, ranked, selectedPracticeAreaId]);

  const areaNameLabels = useMemo((): FeatureCollection | null => {
    if (!bundle?.practiceAreas?.features.length) return null;
    const features: Feature[] = [];
    for (const f of bundle.practiceAreas.features) {
      if (f.geometry?.type !== "Polygon") continue;
      const props = (f.properties ?? {}) as {
        id?: string;
        name?: string;
        isCommunity?: number | boolean;
      };
      const idStr = String(props.id ?? f.id ?? "");
      const raw = typeof props.name === "string" ? props.name.trim() : "";
      const shared =
        props.isCommunity === 1 || props.isCommunity === true ? " · shared" : "";
      const label = `${raw || `Area ${idStr.slice(0, 6)}`}${shared}`.slice(0, 120);
      try {
        const c = centroid(f as Feature<Polygon>);
        features.push({
          type: "Feature",
          properties: { areaName: label },
          geometry: c.geometry,
        });
      } catch {
        /* invalid geometry */
      }
    }
    return features.length ? { type: "FeatureCollection", features } : null;
  }, [bundle]);

  /** Wind field: GeoJSON points under area fill; SVG icon + map rotation in MapLibre symbol layer. */
  const windFieldArrowsGeoJson = useMemo((): FeatureCollection => {
    const features: Feature[] = [];
    const polyById = new Map<string, GeoJSON.Polygon>();
    if (bundle?.practiceAreas?.features.length) {
      for (const f of bundle.practiceAreas.features) {
        if (f.geometry?.type !== "Polygon") continue;
        const geom = f.geometry;
        const props = (f.properties ?? {}) as { id?: string };
        const keys = new Set<string>();
        const primary = areaFeatureId(f);
        if (primary) keys.add(primary);
        if (f.id != null && String(f.id) !== "") keys.add(String(f.id));
        if (props.id != null && String(props.id) !== "") keys.add(String(props.id));
        for (const k of keys) polyById.set(k, geom);
      }
    }
    outer: for (const r of ranked) {
      const w = r.wind;
      if (w?.dirFromDeg == null || Number.isNaN(w.dirFromDeg)) continue;
      const { lng, lat } = r.centroid;
      const windTo = windToDegFromDirFrom(w.dirFromDeg);
      const poly = polyById.get(r.areaId);
      const origins = poly
        ? windFieldSpatialProbePoints(
            poly,
            lng,
            lat,
            WIND_MAP_ARROW_MAX_SAMPLES_SETTING,
            WIND_FIELD_MAX_ARROWS,
          )
        : [[lng, lat]];
      let i = 0;
      for (const [sx, sy] of origins) {
        if (features.length >= MAX_TOTAL_WIND_FIELD_MARKERS) break outer;
        features.push({
          type: "Feature",
          id: `wf-${r.areaId}-${i++}`,
          properties: { windTo },
          geometry: { type: "Point", coordinates: [sx, sy] },
        });
      }
    }
    return { type: "FeatureCollection", features };
  }, [ranked, bundle]);

  const windFieldFeatureCount = windFieldArrowsGeoJson.features.length;
  useEffect(() => {
    if (windFieldFeatureCount === 0) return;
    const map = mapRef.current?.getMap();
    if (!map?.isStyleLoaded()) return;
    ensureWindFieldArrowImage(map);
  }, [mapEpoch, windFieldFeatureCount, mapStyle]);

  const windLabels = useMemo((): FeatureCollection => {
    const features: Feature[] = [];
    for (const r of ranked) {
      const w = r.wind;
      const { lng, lat } = r.centroid;
      const line1 = w ? windCompactSummary(w) : "—";
      const mpLine = windMultiPointSubtitle(w);
      const visStr = formatVisibilityM(w?.visibilityM ?? null);
      const lineVis = visStr !== "—" ? `vis ${visStr}` : "";
      features.push({
        type: "Feature",
        properties: {
          windText: [line1, mpLine, lineVis].filter(Boolean).join("\n"),
        },
        geometry: { type: "Point", coordinates: [lng, lat] },
      });
    }
    return { type: "FeatureCollection", features };
  }, [ranked]);

  /** Centroid markers: click opens Yr.no hourly (point) forecast for that coordinate. */
  const yrForecastPoints = useMemo((): FeatureCollection => {
    const features: Feature[] = [];
    for (const r of ranked) {
      const { lng, lat } = r.centroid;
      features.push({
        type: "Feature",
        properties: { areaId: r.areaId },
        geometry: { type: "Point", coordinates: [lng, lat] },
      });
    }
    return { type: "FeatureCollection", features };
  }, [ranked]);

  /** Downwind preview at selected area centroid when that area has a saved optimal (CSS marker). */
  const selectedOptimalWindMarker = useMemo((): {
    lng: number;
    lat: number;
    windToDeg: number;
    lenKm: number;
  } | null => {
    if (!bundle?.practiceAreas?.features.length || !selectedPracticeAreaId) return null;
    const f = bundle.practiceAreas.features.find(
      (x) => areaFeatureId(x) === selectedPracticeAreaId,
    );
    if (!f || f.geometry?.type !== "Polygon") return null;
    const p = f.properties as { optimalWindFromDeg?: number | null };
    const opt = p?.optimalWindFromDeg;
    if (opt == null || typeof opt !== "number" || !Number.isFinite(opt)) return null;
    try {
      const c = centroid(f as Feature<Polygon>);
      const [lng, lat] = c.geometry.coordinates;
      const poly = f.geometry;
      const windTo = windToFromWindFrom(opt);
      const lenKm = clampArrowLengthInsidePolygon(poly, lng, lat, windTo, 14);
      return { lng, lat, windToDeg: windTo, lenKm };
    } catch {
      return null;
    }
  }, [bundle, selectedPracticeAreaId]);

  useEffect(() => {
    if (mapMode === "draw") {
      setSidebarTab("you");
      setToolSectionsOpen((s) => (s.draw ? s : { ...s, draw: true }));
    }
  }, [mapMode]);

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
        setToolSectionsOpen((s) => ({ ...s, draw: true }));
        return;
      }
      setWindPickAreaId(id);
      setWindPickStart(null);
      setWindPickHover(null);
      setTerrainClick(null);
      setMapMode("pickWind");
      setSidebarTab("plan");
      setToolSectionsOpen((s) => ({ ...s, windRank: true }));
      setMsg("Area optimal: click arrow tail, then head (downwind). Esc = cancel.");
    },
    [mapMode],
  );

  const cancelPickWind = useCallback(() => {
    setWindPickAreaId(null);
    setWindPickStart(null);
    setWindPickHover(null);
    setMapMode("browse");
  }, []);

  const windPickPreview = useMemo(():
    | { kind: "dot"; lng: number; lat: number }
    | { kind: "arrow"; tailLng: number; tailLat: number; windToDeg: number; distKm: number }
    | null => {
    if (mapMode !== "pickWind" || windPickStart == null) return null;
    const [sx, sy] = windPickStart;
    const hx = windPickHover?.[0] ?? sx;
    const hy = windPickHover?.[1] ?? sy;
    const distKm = haversineKm(sx, sy, hx, hy);
    if (distKm < 0.004) return { kind: "dot", lng: sx, lat: sy };
    const windTo = bearingDeg(sx, sy, hx, hy);
    return { kind: "arrow", tailLng: sx, tailLat: sy, windToDeg: windTo, distKm };
  }, [mapMode, windPickStart, windPickHover]);

  const optimalWindLenPx = useMemo(() => {
    if (!selectedOptimalWindMarker) return 0;
    const px = kmToScreenPx(
      selectedOptimalWindMarker.lenKm,
      selectedOptimalWindMarker.lat,
      mapZoom,
    );
    return Math.min(160, Math.max(28, px));
  }, [selectedOptimalWindMarker, mapZoom]);

  const windPickArrowLenPx = useMemo(() => {
    if (!windPickPreview || windPickPreview.kind !== "arrow") return 0;
    const px = kmToScreenPx(
      windPickPreview.distKm,
      windPickPreview.tailLat,
      mapZoom,
    );
    return Math.min(420, Math.max(12, px));
  }, [windPickPreview, mapZoom]);

  const drawPreview = useMemo((): FeatureCollection | null => {
    if (drawRing.length === 0) return null;
    const features: Feature[] = [];
    features.push({
      type: "Feature",
      properties: { kind: "vertices" },
      geometry: { type: "MultiPoint", coordinates: drawRing },
    });
    if (drawRing.length >= 2) {
      features.push({
        type: "Feature",
        properties: { kind: "path" },
        geometry: { type: "LineString", coordinates: drawRing },
      });
      features.push({
        type: "Feature",
        properties: { kind: "close" },
        geometry: {
          type: "LineString",
          coordinates: [drawRing[drawRing.length - 1]!, drawRing[0]!],
        },
      });
    }
    return { type: "FeatureCollection", features };
  }, [drawRing]);

  async function savePracticeArea(
    poly: GeoJSON.Polygon,
    windSectors?: [number, number][],
    nameOverride?: string,
  ) {
    setLoading(true);
    setMsg(null);
    try {
      const nameRaw = (nameOverride ?? drawAreaName).trim() || "Untitled area";
      const body: Record<string, unknown> = {
        geojson: poly,
        sports: [activeSport],
        labelPreset: "other",
        name: nameRaw.slice(0, 120),
      };
      if (windSectors?.length) body.windSectors = windSectors;
      const r = await fetch("/api/practice-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
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
          const r = await fetch(`/api/practice-areas/${editTarget}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ geojson: poly }),
          });
          if (!r.ok) throw new Error(await r.text());
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

  const hasMaptilerKey = Boolean(
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_MAPTILER_API_KEY,
  );

  const basemapSummary = useMemo(() => {
    const labels: Record<BasemapId, string> = {
      hybrid: "Hybrid",
      osm: "OSM",
      topo: "Topo",
      satellite: "Satellite",
      maptiler_outdoor: "MapTiler Outdoor",
    };
    return labels[basemap] ?? basemap;
  }, [basemap]);

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

  return (
    <div className="relative h-screen w-full">
      <div
        className={`absolute left-2 top-2 flex max-w-[min(24rem,calc(100vw-1rem))] max-h-[92vh] min-h-0 flex-col text-sm ${hubOverlayZ.sidebar}`}
        aria-busy={bundleLoading || rankLoading}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-app-border bg-app-surface/90 shadow-[var(--app-shadow-hub)] backdrop-blur-md">
          <div className="shrink-0 border-b border-app-border bg-gradient-to-br from-app-accent-soft via-app-surface to-app-surface-muted">
            <Link
              href="/"
              className="flex w-full items-center justify-center px-4 py-4 outline-none transition hover:bg-app-surface/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-app-accent"
              title="Fjell Lift — home"
            >
              <Image
                src="/brand/fjell-lift-logo.png"
                alt="Fjell Lift"
                width={560}
                height={187}
                className="h-[4.25rem] w-auto max-w-full object-contain sm:h-[5.25rem]"
                sizes="(max-width: 640px) 85vw, 360px"
                priority
              />
            </Link>
            <div
              role="tablist"
              aria-label="Tool groups"
              className="mx-2.5 mb-2 flex gap-0.5 rounded-xl bg-app-accent-muted p-1"
            >
              {(
                [
                  ["plan", "Plan", "Sport, forecast & ranking"],
                  ["map", "Map", "Basemap & terrain look"],
                  ["you", "You", "Draw, sessions & account"],
                ] as const
              ).map(([id, label, hint]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={sidebarTab === id}
                  title={hint}
                  className={`min-h-[40px] flex-1 rounded-lg px-1.5 py-2 text-center text-xs font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent ${
                    sidebarTab === id
                      ? "bg-app-surface text-app-accent-hover shadow-sm ring-1 ring-app-border"
                      : "text-app-fg-muted hover:bg-app-surface/80 hover:text-app-accent-hover"
                  }`}
                  onClick={() => setSidebarTab(id as SidebarTab)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mx-2.5 mb-2.5 flex flex-wrap items-center justify-end gap-1">
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-[10px] font-medium text-app-accent-hover transition-colors hover:bg-app-surface/90"
                onClick={() => expandCurrentTabSections()}
              >
                Expand tab
              </button>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-[10px] font-medium text-app-fg-muted transition-colors hover:bg-app-surface/90"
                onClick={() => collapseCurrentTabSections()}
              >
                Collapse tab
              </button>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-[10px] font-medium text-app-fg-subtle transition-colors hover:bg-app-surface/90"
                onClick={() => setToolSectionsOpen({ ...ALL_TOOL_SECTIONS_OPEN })}
                title="Expand every section in every tab"
              >
                All sections
              </button>
            </div>
          </div>
          <div
            className="sidebar-panel min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2.5"
            role="tabpanel"
          >
            {sidebarTab === "plan" && (
              <>
        <CollapsibleSection
          title="Sport"
          summary={`Active: ${activeSport === "kiteski" ? "Kite ski" : "Kite surf"}`}
          open={toolSectionsOpen.sport}
          onToggle={() => toggleToolSection("sport")}
        >
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Active sport"
              value={activeSport}
              onChange={(e) => setActiveSport(e.target.value as "kiteski" | "kitesurf")}
              className="w-full rounded-xl border border-app-border-subtle bg-app-surface px-3 py-2 text-sm text-app-fg shadow-inner shadow-app-fg/5 focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/20"
            >
              <option value="kiteski">Kite ski</option>
              <option value="kitesurf">Kite surf</option>
            </select>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Forecast &amp; ranked areas"
          summary={forecastSummary}
          open={toolSectionsOpen.forecast}
          onToggle={() => toggleToolSection("forecast")}
        >
          <ForecastTimeControl
            hoursAhead={hoursAhead}
            setHoursAhead={setHoursAhead}
            forecastAtIso={forecastAtIso}
            setForecastAnchorMs={setForecastAnchorMs}
            floorToHourMs={floorToHourMs}
          />
          <HelpDisclosure title="How ranking & map work">
            <p>
              Slider moves the forecast hour (Met.no / Yr in Europe with terrain elevation, otherwise
              Open-Meteo). Many small <strong>downwind</strong> SVG arrows sit <strong>under</strong> the tinted
              area fill (map rotation keeps them aligned with true north).{" "}
              Labels: wind <strong>from</strong> (meteorology), whole m/s with gust in parentheses.{" "}
              <strong>Sky dot</strong> at each area centre opens Yr.no <strong>hourly</strong> forecast (new
              tab) for that point; <strong>Shift+click</strong> elsewhere does the same. <strong>Vis</strong> when
              shown
              is modelled visibility — not used in score. Large or hilly areas may show a{" "}
              <strong>speed range</strong> and <strong>spot count</strong> when multi-point forecast runs
              (see scoring settings when signed in; guests use a smaller cap).
            </p>
          </HelpDisclosure>
          {rankLoadError && !rankLoading ? (
            <div className="space-y-2">
              <p className="rounded-xl bg-app-warning-bg p-2.5 text-[10px] leading-snug text-app-warning-fg ring-1 ring-app-warning-border">
                {rankLoadError}
                <span className="mt-1.5 block text-app-fg-muted">
                  Practice polygons may still appear on the map once the view fits your areas. Check the
                  terminal or network tab for <code className="rounded bg-white/60 px-0.5">/api/forecast/rank</code>.
                </span>
              </p>
            </div>
          ) : null}
          {rankLoading && ranked.length === 0 && !rankLoadError ? (
            <RankedListSkeleton />
          ) : null}
          {ranked.length > 0 ? (
            <div className="space-y-1">
              {rankLoading ? (
                <p className="text-[10px] text-app-fg-subtle" aria-live="polite">
                  Updating ranking…
                </p>
              ) : null}
              <p className="text-[10px] text-app-fg-muted" suppressHydrationWarning>
                Ranking for{" "}
                <time dateTime={forecastAtIso}>
                  {new Date(forecastAtIso).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                . Met.no / Yr in Europe (terrain elevation) where available; otherwise Open-Meteo.
              </p>
              <p className="text-[10px] font-medium text-app-fg-muted">
                Areas (best score first) — tap to fly the map here
              </p>
              <ul className="max-h-52 space-y-0 overflow-auto rounded-xl bg-app-surface-muted text-[11px] leading-snug text-app-fg-muted ring-1 ring-app-border-subtle">
                {ranked.map((r, idx) => (
                  <RankedAreaRow
                    key={r.areaId}
                    area={r}
                    index={idx}
                    onSelect={focusRankedAreaOnMap}
                  />
                ))}
              </ul>
            </div>
          ) : !rankLoading && !rankLoadError ? (
            <p className="text-[10px] text-app-fg-subtle">
              {isAuthed
                ? "No ranked areas yet — add a practice polygon or mark an area public."
                : "No public areas for this sport yet — check the other sport or sign in to explore private spots you have saved."}
            </p>
          ) : null}
          {isAuthed ? (
            rankingPrefsLoading || !rankingForm || !multiPointForm ? (
              <ScoringPrefsSkeleton />
            ) : (
              <PersistedCollapsible
                title={`Your forecast scoring — ${activeSport === "kiteski" ? "kite ski" : "kite surf"}`}
                summaryCollapsed={scoringSummaryCollapsed}
                storageKey="mapHub.scoringPrefsExpanded"
              >
                <p className="text-[10px] leading-snug text-app-fg-muted">
                  Wind speed window and ideal band set how strongly forecast speed matches your sport.
                  Weights scale wind fit, gust penalty, and how much direction matters before the
                  experience boost.
                </p>
                <div className="rounded-xl border border-app-info-border bg-app-info-bg p-2.5 ring-1 ring-app-border-subtle">
                  <p className="text-[10px] font-semibold text-app-info-fg-strong">Area forecast sampling</p>
                  <p className="mt-1 text-[10px] leading-snug text-app-info-fg">
                    <strong>Auto</strong> adds extra API calls when the polygon is wide (≈3+ km) or
                    terrain varies a lot inside it. <strong>On</strong> always samples up to your max
                    spots. <strong>Conservative</strong> scoring uses the weakest wind and strictest
                    direction match among spots; <strong>representative</strong> uses medians and mean
                    direction.
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium text-app-info-fg-strong">Mode</span>
                      <select
                        value={multiPointForm.mode}
                        onChange={(e) =>
                          setMultiPointForm((p) =>
                            p
                              ? {
                                  ...p,
                                  mode: e.target.value as MultiPointForecastFormState["mode"],
                                }
                              : p,
                          )
                        }
                        className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
                      >
                        <option value="off">Off (centre only)</option>
                        <option value="auto">Auto (large / hilly areas)</option>
                        <option value="on">On (always multi-spot)</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium text-app-info-fg-strong">Max spots (3–9)</span>
                      <input
                        type="number"
                        min={3}
                        max={9}
                        step={1}
                        value={multiPointForm.maxSamples}
                        onChange={(e) => {
                          const v = Math.round(Number(e.target.value));
                          if (!Number.isFinite(v)) return;
                          setMultiPointForm((p) =>
                            p ? { ...p, maxSamples: Math.min(9, Math.max(3, v)) } : p,
                          );
                        }}
                        className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium text-app-info-fg-strong">Collapse policy</span>
                      <select
                        value={multiPointForm.scoringPolicy}
                        onChange={(e) =>
                          setMultiPointForm((p) =>
                            p
                              ? {
                                  ...p,
                                  scoringPolicy: e.target
                                    .value as MultiPointForecastFormState["scoringPolicy"],
                                }
                              : p,
                          )
                        }
                        className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
                      >
                        <option value="conservative">Conservative (min wind / strict dir)</option>
                        <option value="representative">Representative (median / mean dir)</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-app-fg-muted">Min wind (m/s)</span>
                    <input
                      type="number"
                      min={0.5}
                      max={60}
                      step={0.5}
                      value={rankingForm[activeSport].minWindMs}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) patchActiveSportRanking({ minWindMs: v });
                      }}
                      className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-app-fg-muted">Max wind (m/s)</span>
                    <input
                      type="number"
                      min={0.5}
                      max={60}
                      step={0.5}
                      value={rankingForm[activeSport].maxWindMs}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) patchActiveSportRanking({ maxWindMs: v });
                      }}
                      className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-app-fg-muted">Ideal min (m/s)</span>
                    <input
                      type="number"
                      min={0.5}
                      max={60}
                      step={0.5}
                      value={rankingForm[activeSport].idealMinMs}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) patchActiveSportRanking({ idealMinMs: v });
                      }}
                      className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-app-fg-muted">Ideal max (m/s)</span>
                    <input
                      type="number"
                      min={0.5}
                      max={60}
                      step={0.5}
                      value={rankingForm[activeSport].idealMaxMs}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) patchActiveSportRanking({ idealMaxMs: v });
                      }}
                      className="rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-app-fg-muted">
                    Wind speed fit weight ×{rankingForm[activeSport].windFitScale.toFixed(2)}
                  </span>
                  <input
                    type="range"
                    min={0.25}
                    max={2}
                    step={0.05}
                    value={rankingForm[activeSport].windFitScale}
                    onChange={(e) =>
                      patchActiveSportRanking({ windFitScale: Number(e.target.value) })
                    }
                    className="w-full accent-app-accent"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-app-fg-muted">
                    Gust penalty ×{rankingForm[activeSport].gustPenaltyScale.toFixed(2)} (0 = ignore gusts)
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={rankingForm[activeSport].gustPenaltyScale}
                    onChange={(e) =>
                      patchActiveSportRanking({ gustPenaltyScale: Number(e.target.value) })
                    }
                    className="w-full accent-app-accent"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-app-fg-muted">
                    Direction emphasis {(rankingForm[activeSport].directionEmphasis * 100).toFixed(0)}%
                    (0 = ignore direction match)
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={rankingForm[activeSport].directionEmphasis}
                    onChange={(e) =>
                      patchActiveSportRanking({ directionEmphasis: Number(e.target.value) })
                    }
                    className="w-full accent-app-accent"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={hubBtnPrimary}
                    onClick={() => void saveRankingPrefsForActiveSport()}
                  >
                    Save scoring &amp; sampling
                  </button>
                  <button
                    type="button"
                    className={hubBtnSecondary}
                    onClick={() => void resetRankingPrefsForActiveSport()}
                  >
                    Use defaults (this sport)
                  </button>
                </div>
              </PersistedCollapsible>
            )
          ) : (
            <p className="mt-3 text-[10px] leading-snug text-app-fg-subtle">
              <Link href="/login" className="font-medium text-app-accent-hover underline-offset-2 hover:underline">
                Sign in
              </Link>{" "}
              to set your own wind bands and scoring weights for the ranked list.
            </p>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="How spots are ranked"
          summary={windRankSummary}
          open={toolSectionsOpen.windRank}
          onToggle={() => toggleToolSection("windRank")}
        >
          <div className="flex flex-col gap-2">
            <p className="text-[11px] leading-snug text-app-fg-muted">
              Optimal wind is <strong>per practice area</strong> only. Open an area →{" "}
              <strong>Edit area</strong> to draw direction on the map or type degrees. Areas without
              an optimal get <strong>no direction penalty</strong> (unless you use saved wind sectors).
            </p>
            <p className="text-[11px] leading-snug text-app-fg-muted">
              <strong>Multi-spot forecast</strong> (when enabled) fetches several grid-aligned points
              inside each polygon with per-spot elevation for Met.no. Scores combine those samples:
              conservative mode penalises using the lowest wind speed and the worst direction match;
              gust penalty uses the strongest gust vs median speed.
            </p>
            {mapMode === "pickWind" ? (
              <div className="space-y-2 rounded-2xl border border-app-border bg-gradient-to-b from-app-accent-soft to-app-surface p-3 shadow-inner shadow-app-fg/5">
                <p className="text-[10px] font-medium text-app-accent-hover">
                  Saving to the open practice area — see the edit panel for tips.
                </p>
                <p className="text-[11px] leading-snug text-app-fg">
                  {windPickStart == null ? (
                    <>
                      <strong>1.</strong> Click the <strong>tail</strong> of the arrow (upwind / where
                      wind comes toward you).
                    </>
                  ) : (
                    <>
                      <strong>2.</strong> Click the <strong>head</strong> — arrow points where the wind{" "}
                      <strong>blows</strong> (downwind).
                    </>
                  )}
                </p>
                <button
                  type="button"
                  className={`w-full ${hubBtnSecondary}`}
                  onClick={() => cancelPickWind()}
                >
                  Cancel drawing
                </button>
                <p className="text-[10px] text-app-fg-muted">
                  <kbd className="rounded-md bg-app-accent-muted px-1 py-0.5">Esc</kbd> cancel · right-click
                  resets tail
                </p>
              </div>
            ) : null}
          </div>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-app-fg-muted">
              Match width ±{optimalWindHalfWidthDeg}° (~{Math.round((optimalWindHalfWidthDeg / 180) * 100)}%
              of half-circle)
            </span>
            <input
              type="range"
              min={5}
              max={90}
              value={optimalWindHalfWidthDeg}
              onChange={(e) => setOptimalWindHalfWidthDeg(Number(e.target.value))}
              className="w-full accent-app-accent"
            />
            <span className="text-[10px] leading-snug text-app-fg-subtle">
              Full direction score when forecast is within this window of each area’s saved optimal.
              Wider = more forgiving; also scales the bonus inside saved wind sectors.
            </span>
          </label>
          <p className="mt-2 text-[10px] leading-snug text-app-fg-subtle">
            When a practice area is selected and has an optimal, a short <strong>downwind</strong> arrow
            is shown from that area’s centre (inside the polygon).
          </p>
          <label className="mt-1 flex flex-col gap-1">
            <span className="text-xs font-medium text-app-fg-muted">
              Saved-area sector half-width: {sectorHalfWidthDeg}°
            </span>
            <input
              type="range"
              min={15}
              max={90}
              value={sectorHalfWidthDeg}
              onChange={(e) => setSectorHalfWidthDeg(Number(e.target.value))}
              className="w-full accent-app-accent"
            />
            <span className="text-[10px] text-app-fg-subtle">
              Used in <strong>Edit area</strong> when saving a wind sector arc around the area’s optimal
              bearing.
            </span>
          </label>
          <p className="mt-2 text-[10px] leading-snug text-app-fg-subtle">
            Min/max wind, ideal band, and score weights are in <strong>Forecast &amp; ranked areas</strong>{" "}
            above. This section is for direction match width and drawing optimal wind on the map.
          </p>
          <div className="flex flex-wrap gap-2 text-[10px] text-app-fg-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-4 rounded-sm bg-[var(--app-rank-strong)]" />
              strong
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-4 rounded-sm bg-[var(--app-rank-ok)]" />
              ok
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-4 rounded-sm bg-[var(--app-rank-weak)]" />
              weak
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-4 rounded-sm bg-[var(--app-rank-poor)]" />
              poor
            </span>
          </div>
        </CollapsibleSection>
              </>
            )}
            {sidebarTab === "map" && (
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
          {(basemap === "hybrid" || (basemap === "maptiler_outdoor" && !maptilerOutdoorStyleUrl())) && (
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
          onPatchMapLayerToggles={patchMapLayerToggles}
        />
              </>
            )}
            {sidebarTab === "you" && (
              <>
        <CollapsibleSection
          title="Practice areas"
          summary={
            !isAuthed
              ? "Sign in to draw your own polygons"
              : mapMode === "draw"
                ? editingAreaId
                  ? "Editing boundary…"
                  : "Drawing polygon…"
                : "Draw & save polygons on the map"
          }
          open={toolSectionsOpen.draw}
          onToggle={() => toggleToolSection("draw")}
        >
          {sessionPending ? (
            <p className="text-[11px] text-app-fg-subtle">Checking session…</p>
          ) : !isAuthed ? (
            <p className="text-[11px] leading-snug text-app-fg-muted">
              Anyone can browse <strong>public</strong> areas.{" "}
              <Link href="/login" className="font-medium text-app-accent-hover underline hover:text-app-fg">
                Sign in
              </Link>{" "}
              to add your own spots.
            </p>
          ) : (
            <>
              <p className="text-[11px] leading-snug text-app-fg-muted">
                Uses forecast at polygon centre and each area’s wind settings (set under{" "}
                <strong>Edit area</strong>).
              </p>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-app-fg-muted">Name for new drawings</span>
                <input
                  type="text"
                  value={drawAreaName}
                  onChange={(e) => setDrawAreaName(e.target.value.slice(0, 120))}
                  placeholder="e.g. West beach"
                  className="rounded-xl border border-app-border-subtle bg-app-surface px-3 py-2 text-xs text-app-fg focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/20"
                  maxLength={120}
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {mapMode === "browse" ? (
                  <button
                    type="button"
                    className={hubBtnPrimary}
                    onClick={() => {
                      setWindPickStart(null);
                      setWindPickHover(null);
                      setWindPickAreaId(null);
                      setDrawRing([]);
                      setEditingAreaId(null);
                      setMapMode("draw");
                      setTerrainClick(null);
                    }}
                  >
                    Start drawing
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={hubBtnPrimary}
                      disabled={loading}
                      onClick={() => void finishDrawing()}
                    >
                      Finish &amp; save
                    </button>
                    <button
                      type="button"
                      className={hubBtnSecondaryToolbar}
                      onClick={() => setDrawRing((r) => r.slice(0, -1))}
                      disabled={drawRing.length === 0}
                    >
                      Undo point
                    </button>
                    <button
                      type="button"
                      className={hubBtnSecondaryToolbar}
                      onClick={() => {
                        setDrawRing([]);
                        setMapMode("browse");
                        setEditingAreaId(null);
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
              {mapMode === "draw" && (
                <p className="text-[11px] text-app-fg-muted">
                  {editingAreaId ? (
                    <span className="font-medium text-app-warning-fg">Editing boundary · </span>
                  ) : null}
                  {drawRing.length} point{drawRing.length === 1 ? "" : "s"} · click map for corners ·{" "}
                  <kbd className={hubKbd}>Esc</kbd> cancels
                </p>
              )}
            </>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Session experiences"
          summary={
            !isAuthed
              ? "Sign in to log sessions"
              : experiences.length
                ? `${experiences.length} logged · used to boost rank when weather matches`
                : "Log past sessions → smarter rankings"
          }
          open={toolSectionsOpen.experiences}
          onToggle={() => toggleToolSection("experiences")}
          variant="accent"
        >
          {sessionPending ? (
            <p className="text-[11px] text-app-fg-subtle">Checking session…</p>
          ) : !isAuthed ? (
            <p className="text-[11px] leading-snug text-app-fg-muted">
              <Link href="/login" className="font-medium text-app-accent-hover underline hover:text-app-fg">
                Sign in
              </Link>{" "}
              to log sessions and get personalized ranking boosts on your areas.
            </p>
          ) : (
            <>
          <p className="text-[10px] leading-snug text-app-fg-muted">
            Add when and where you went (active sport:{" "}
            <strong>{activeSport === "kiteski" ? "Kite ski" : "Kite surf"}</strong>). We pull archive
            wind at the area centre; when forecast matches those buckets, areas with good sessions get a
            small score boost (needs at least two matching experiences per area).
          </p>
          <form
            className="flex flex-col gap-2 border-t border-app-border pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const practiceAreaId = String(fd.get("practiceAreaId") ?? "");
              const occurredAtRaw = String(fd.get("occurredAt") ?? "");
              const sessionSuitability = String(fd.get("sessionSuitability") ?? "suitable");
              if (!practiceAreaId) {
                setMsg("Choose a practice area.");
                return;
              }
              const at = new Date(occurredAtRaw);
              if (Number.isNaN(at.getTime())) {
                setMsg("Invalid date/time.");
                return;
              }
              setLoading(true);
              setMsg(null);
              void (async () => {
                try {
                  const r = await fetch("/api/experiences", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      practiceAreaId,
                      sport: activeSport,
                      occurredAt: at.toISOString(),
                      sessionSuitability,
                    }),
                  });
                  const j = (await r.json()) as { error?: string };
                  if (!r.ok) throw new Error(j.error ?? "Save failed");
                  await loadExperiences();
                  await loadRank();
                  setMsg("Experience saved.");
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Save failed");
                } finally {
                  setLoading(false);
                }
              })();
            }}
          >
            <label className="text-[11px] font-medium text-app-fg">
              When
              <input
                key={clientReady ? "occurredAt" : "occurredAt-pending"}
                type="datetime-local"
                name="occurredAt"
                required
                defaultValue={clientReady ? toDatetimeLocalInput(new Date()) : ""}
                className={hubInputNative}
              />
            </label>
            <label className="text-[11px] font-medium text-app-fg">
              Area
              <select
                name="practiceAreaId"
                required
                className={hubInputNative}
                disabled={!bundle?.practiceAreas?.features.length}
              >
                <option value="">Select area…</option>
                {(bundle?.practiceAreas.features ?? []).map((f) => {
                  const id = areaFeatureId(f);
                  const props = (f.properties ?? {}) as { name?: string };
                  const label = (props.name?.trim() || `Area ${id.slice(0, 6)}`).slice(0, 80);
                  return (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="text-[11px] font-medium text-app-fg">
              How were conditions?
              <select
                name="sessionSuitability"
                className={hubInputNative}
                defaultValue="suitable"
              >
                <option value="ideal">Ideal</option>
                <option value="suitable">Suitable</option>
                <option value="marginal">Marginal</option>
                <option value="unsuitable">Unsuitable</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={loading || !bundle?.practiceAreas?.features.length}
              className={hubBtnPrimary}
            >
              Save experience
            </button>
          </form>
          {experiences.length > 0 ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto border-t border-app-border pt-2 text-[10px] text-app-fg-muted">
              {experiences.map((ex) => (
                <li
                  key={ex.id}
                  className={hubListRow}
                >
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="font-medium">{ex.practiceAreaName}</span>
                    <br />
                    <span suppressHydrationWarning>
                      {new Date(ex.occurredAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>{" "}
                    · {ex.sessionSuitability}
                    {ex.windDirDeg != null ? (
                      <>
                        {" "}
                        · wind {cardinalFromDeg(ex.windDirDeg)} (
                        {Math.round(ex.windDirDeg)}°)
                      </>
                    ) : (
                      " · no archive wind"
                    )}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-[10px] text-app-danger hover:underline"
                    onClick={() => {
                      setLoading(true);
                      void (async () => {
                        try {
                          const r = await fetch(`/api/experiences/${ex.id}`, { method: "DELETE" });
                          if (!r.ok) throw new Error("Delete failed");
                          await loadExperiences();
                          await loadRank();
                          setMsg("Experience removed.");
                        } catch {
                          setMsg("Could not delete experience.");
                        } finally {
                          setLoading(false);
                        }
                      })();
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[10px] text-app-fg-subtle">No experiences for this sport yet.</p>
          )}
            </>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          title="Account"
          summary={
            sessionPending
              ? "Loading…"
              : isAuthed
                ? msg
                  ? "Has a status message · open for sign out"
                  : "Open to sign out"
                : "Sign in for your areas & drawing"
          }
          open={toolSectionsOpen.account}
          onToggle={() => toggleToolSection("account")}
        >
          {sessionPending ? (
            <p className="text-xs text-app-fg-subtle">Checking session…</p>
          ) : isAuthed ? (
            <>
              {msg && <p className="text-xs text-app-fg-muted">{msg}</p>}
              <button
                type="button"
                className="text-left text-xs font-medium text-app-accent-hover underline decoration-app-accent/50 underline-offset-2 hover:text-app-fg"
                onClick={() => void signOut({ callbackUrl: "/login" })}
              >
                Sign out
              </button>
            </>
          ) : (
            <p className="text-xs leading-snug text-app-fg-muted">
              <Link
                href="/login"
                className="font-medium text-app-accent-hover underline decoration-app-accent/50 underline-offset-2 hover:text-app-fg"
              >
                Sign in
              </Link>{" "}
              to save practice areas, draw polygons, and log sessions.
            </p>
          )}
        </CollapsibleSection>
              </>
            )}
          </div>
          <nav
            className="shrink-0 border-t border-app-border bg-app-surface/60 px-2 py-2 text-center text-[10px] text-app-fg-subtle backdrop-blur-sm"
            aria-label="Legal"
          >
            <Link
              href="/terms"
              className="font-medium text-app-accent-hover hover:text-app-fg hover:underline"
            >
              Terms of use
            </Link>
            <span className="text-app-fg-subtle" aria-hidden>
              {" · "}
            </span>
            <Link
              href="/privacy"
              className="font-medium text-app-accent-hover hover:text-app-fg hover:underline"
            >
              Privacy &amp; GDPR
            </Link>
            <span className="text-app-fg-subtle" aria-hidden>
              {" · "}
            </span>
            <Link
              href="/help"
              className="font-medium text-app-accent-hover hover:text-app-fg hover:underline"
            >
              Help
            </Link>
          </nav>
        </div>
      </div>

      {terrainClick && terrainPopoverPos ? (
        <TerrainClickPanel
          terrain={terrainClick}
          onClose={() => setTerrainClick(null)}
          style={{
            left: terrainPopoverPos.left,
            top: terrainPopoverPos.top,
          }}
        />
      ) : null}

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
        onLoad={(e) => {
          const map = e.target;
          setMapEpoch((n) => n + 1);
          const z = map.getZoom();
          if (typeof z === "number" && Number.isFinite(z)) setMapZoom(z);
          const syncWindFieldArrow = () => ensureWindFieldArrowImage(map);
          syncWindFieldArrow();
          map.on("style.load", syncWindFieldArrow);
        }}
        onStyleData={() => {
          const map = mapRef.current?.getMap();
          if (map?.isStyleLoaded()) ensureWindFieldArrowImage(map);
        }}
        onMove={(e) => {
          setMapZoom(e.viewState.zoom);
        }}
        onMouseMove={(e) => {
          if (mapMode !== "pickWind" || windPickStart == null) return;
          const { lng, lat } = e.lngLat;
          setWindPickHover([lng, lat]);
        }}
        onContextMenu={(e) => {
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
        }}
        onClick={(e) => {
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
                const r = await fetch(`/api/practice-areas/${aid}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ optimalWindFromDeg: from }),
                });
                if (!r.ok) throw new Error(await r.text());
                await loadBundle();
                await loadRank();
                setMsg(
                  `Saved area optimal: ${cardinalFromDeg(from)} (${Math.round(from)}°) wind from.`,
                );
              } catch (e) {
                setMsg(e instanceof Error ? e.message : "Could not save area optimal.");
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
            setTerrainClick(null);
            return;
          }
          if (e.originalEvent.shiftKey) {
            const { lng, lat } = e.lngLat;
            window.open(yrNoHourlyTableUrlEn(lat, lng), "_blank", "noopener,noreferrer");
            return;
          }
          const { lng, lat } = e.lngLat;
          const pt = e.point;
          if (typeof window !== "undefined") {
            setTerrainPopoverPos(
              terrainPopoverScreenPosition(pt.x, pt.y, window.innerWidth, window.innerHeight),
            );
          }
          setTerrainClick({ lat, lng, elevationM: null, loading: true });
          void fetch(`/api/elevation?lat=${lat}&lng=${lng}`)
            .then(async (r) => {
              const j = (await r.json()) as { elevationM?: number; error?: string };
              if (!r.ok) {
                setTerrainClick({
                  lat,
                  lng,
                  elevationM: null,
                  loading: false,
                  error: j.error ?? r.statusText,
                });
                return;
              }
              setTerrainClick({
                lat,
                lng,
                elevationM: j.elevationM ?? null,
                loading: false,
              });
            })
            .catch(() => {
              setTerrainClick({
                lat,
                lng,
                elevationM: null,
                loading: false,
                error: "Network error",
              });
            });
        }}
      >
        <NavigationControl position="bottom-right" showCompass visualizePitch />
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
                visibility: mapLayerToggles.windArrows ? "visible" : "none",
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
                visibility: mapLayerToggles.forecastSampleDots ? "visible" : "none",
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
                visibility: mapLayerToggles.forecastSampleDots ? "visible" : "none",
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
        {selectedOptimalWindMarker && optimalWindLenPx > 0 ? (
          <Marker
            longitude={selectedOptimalWindMarker.lng}
            latitude={selectedOptimalWindMarker.lat}
            anchor="left"
            rotationAlignment="map"
            pitchAlignment="map"
            style={{ pointerEvents: "none" }}
          >
            {(() => {
              const w = optimalWindLenPx;
              const shaftW = Math.max(6, w - 14);
              const rot = cssRotateEastBaseToWindTo(selectedOptimalWindMarker.windToDeg);
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
            })()}
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
            {(() => {
              const w = windPickArrowLenPx;
              const shaftW = Math.max(4, w - 12);
              const rot = cssRotateEastBaseToWindTo(windPickPreview.windToDeg);
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
            })()}
          </Marker>
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
                visibility: mapLayerToggles.areaLabels ? "visible" : "none",
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
                visibility: mapLayerToggles.windArrows ? "visible" : "none",
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
                visibility: mapLayerToggles.forecastSampleDots ? "visible" : "none",
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
                visibility: mapLayerToggles.forecastSampleDots ? "visible" : "none",
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
      </MapGL>

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
            setTerrainClick(null);
            setMsg("Adjust corners, then Finish & save.");
          }}
        />
      ) : null}
    </div>
  );
}

