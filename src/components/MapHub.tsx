"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapGL, {
  Layer,
  MapRef,
  Marker,
  NavigationControl,
  Source,
} from "react-map-gl/maplibre";
import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import centroid from "@turf/centroid";
import { point as turfPoint } from "@turf/helpers";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { PracticeAreaEditPanel } from "@/components/map-hub/PracticeAreaEditPanel";
import {
  type BasemapId,
  buildRasterBasemapStyle,
  maptilerOutdoorStyleUrl,
} from "@/lib/map/styles";
import type { RankedPracticeArea } from "@/lib/heuristics/rankAreaTypes";
import { formatVisibilityM } from "@/lib/weather/formatVisibility";
import { yrNoDailyTableUrlEn, yrNoHourlyTableUrlEn } from "@/lib/yrNoUrls";
import {
  cssRotateEastBaseToWindTo,
  windToDegFromDirFrom,
} from "@/lib/map/windArrowDisplay";
import {
  ensureWindFieldArrowImage,
  WIND_FIELD_ARROW_IMAGE_ID,
} from "@/lib/map/windFieldArrowIcon";
import { clampArrowLengthInsidePolygon } from "@/lib/map/windArrowLength";
/** Inline glyph: opens in new tab (paired with Yr favicon on external forecast links). */
function ExternalTabIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={12}
      height={12}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

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

function rankColor(score: number) {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#eab308";
  if (score > 0) return "#f97316";
  return "#94a3b8";
}

/** Meteorological: direction wind comes from (same as forecast APIs). */
const WIND_FROM_OPTIONS: { label: string; deg: number }[] = [
  { label: "N", deg: 0 },
  { label: "NNE", deg: 22.5 },
  { label: "NE", deg: 45 },
  { label: "ENE", deg: 67.5 },
  { label: "E", deg: 90 },
  { label: "ESE", deg: 112.5 },
  { label: "SE", deg: 135 },
  { label: "SSE", deg: 157.5 },
  { label: "S", deg: 180 },
  { label: "SSW", deg: 202.5 },
  { label: "SW", deg: 225 },
  { label: "WSW", deg: 247.5 },
  { label: "W", deg: 270 },
  { label: "WNW", deg: 292.5 },
  { label: "NW", deg: 315 },
  { label: "NNW", deg: 337.5 },
];

function closePolygonCoordinates(ring: [number, number][]): GeoJSON.Polygon | null {
  if (ring.length < 3) return null;
  const closed: [number, number][] = ring.map((p) => [...p] as [number, number]);
  const f = closed[0]!;
  const l = closed[closed.length - 1]!;
  if (l[0] !== f[0] || l[1] !== f[1]) closed.push([f[0], f[1]]);
  return { type: "Polygon", coordinates: [closed] };
}

/** Outer ring without repeated closing coordinate (for editing vertices). */
function outerRingOpenCoords(poly: GeoJSON.Polygon): [number, number][] {
  const ring = poly.coordinates[0];
  if (!ring?.length) return [];
  const out = ring.map(([lng, lat]) => [lng, lat] as [number, number]);
  const f = out[0]!;
  const l = out[out.length - 1]!;
  if (f[0] === l[0] && f[1] === l[1]) return out.slice(0, -1);
  return out;
}

function areaFeatureId(f: Feature): string {
  const props = (f.properties ?? {}) as { id?: string };
  return String(f.id ?? props.id ?? "");
}

function floorToHourMs(d = new Date()): number {
  const a = new Date(d);
  a.setMinutes(0, 0, 0);
  return a.getTime();
}

/** Value for `<input type="datetime-local" />` in local timezone. */
function toDatetimeLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function cardinalFromDeg(deg: number | null): string {
  if (deg == null || Number.isNaN(deg)) return "—";
  const d = ((deg % 360) + 360) % 360;
  const idx = Math.round(d / 22.5) % 16;
  return WIND_FROM_OPTIONS[idx]!.label;
}

/** Map / list: `4 (7) m/s ENE (66°)` — whole m/s, gust in parentheses (less “too exact” than decimals). */
function windCompactSummary(w: {
  speedMs: number | null;
  gustMs: number | null;
  dirFromDeg: number | null;
}): string {
  const sp = w.speedMs != null ? Math.round(w.speedMs) : null;
  const gu = w.gustMs != null ? Math.round(w.gustMs) : null;
  const fromC = cardinalFromDeg(w.dirFromDeg);
  const deg = w.dirFromDeg != null ? Math.round(w.dirFromDeg) : null;
  const windPart =
    sp != null ? (gu != null ? `${sp} (${gu}) m/s` : `${sp} m/s`) : "— m/s";
  return deg != null ? `${windPart} ${fromC} (${deg}°)` : `${windPart} ${fromC}`;
}

/** Second line when multi-spot forecast was used inside the polygon. */
function windMultiPointSubtitle(w: RankedPracticeArea["wind"]): string | null {
  const mp = w?.multiPoint;
  if (!mp || mp.samples < 2) return null;
  const bits: string[] = [];
  if (
    mp.speedMinMs != null &&
    mp.speedMaxMs != null &&
    Math.round(mp.speedMinMs) !== Math.round(mp.speedMaxMs)
  ) {
    bits.push(`${Math.round(mp.speedMinMs)}–${Math.round(mp.speedMaxMs)} m/s in area`);
  }
  bits.push(`${mp.samples} spots`);
  if (mp.dirSpreadDeg != null && mp.dirSpreadDeg >= 12) {
    bits.push(`dir ±${Math.round(mp.dirSpreadDeg)}°`);
  }
  return bits.join(" · ");
}

/** Great-circle distance in km (for wind-arrow preview length). */
function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing from A to B, degrees clockwise from north (0–360). */
function bearingDeg(lngA: number, latA: number, lngB: number, latB: number): number {
  const φ1 = (latA * Math.PI) / 180;
  const φ2 = (latB * Math.PI) / 180;
  const Δλ = ((lngB - lngA) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Arrow tail → head points **downwind**; returns meteorological wind-from (°). */
function windFromFromDownwindArrow(
  tailLng: number,
  tailLat: number,
  headLng: number,
  headLat: number,
): number {
  const windTo = bearingDeg(tailLng, tailLat, headLng, headLat);
  return (windTo + 180) % 360;
}

/** Arrow on map points where wind blows; ranking uses wind-from. */
function windToFromWindFrom(windFromDeg: number): number {
  return (windFromDeg + 180) % 360;
}

/** Web Mercator meters per pixel at latitude (MapLibre 512 px world width). */
function metersPerPixelAtLatitude(latDeg: number, zoom: number): number {
  const cosLat = Math.cos((latDeg * Math.PI) / 180);
  return (40075016.686 * Math.max(cosLat, 0.02)) / (512 * Math.pow(2, zoom));
}

function kmToScreenPx(km: number, latDeg: number, zoom: number): number {
  return (km * 1000) / metersPerPixelAtLatitude(latDeg, zoom);
}

const FORECAST_SLIDER_MAX_H = 120;

type ToolSectionKey =
  | "sport"
  | "draw"
  | "windRank"
  | "basemap"
  | "experiences"
  | "forecast"
  | "account";

const ALL_TOOL_SECTIONS_OPEN: Record<ToolSectionKey, boolean> = {
  sport: true,
  draw: true,
  windRank: true,
  basemap: true,
  experiences: true,
  forecast: true,
  account: true,
};

/** First visit: show sport + forecast (core planning path). */
const DEFAULT_TOOL_SECTIONS: Record<ToolSectionKey, boolean> = {
  sport: true,
  draw: false,
  windRank: false,
  basemap: false,
  experiences: false,
  forecast: true,
  account: false,
};

type SidebarTab = "plan" | "map" | "you";

const SIDEBAR_TAB_STORAGE = "fjelllift-sidebar-tab";

function toolKeysForTab(tab: SidebarTab): ToolSectionKey[] {
  switch (tab) {
    case "plan":
      return ["sport", "forecast", "windRank"];
    case "map":
      return ["basemap"];
    case "you":
      return ["draw", "experiences", "account"];
    default:
      return [];
  }
}

function CollapsibleSection({
  title,
  summary,
  open,
  onToggle,
  variant = "default",
  className = "",
  children,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  variant?: "default" | "accent";
  className?: string;
  children: ReactNode;
}) {
  const shell =
    variant === "accent"
      ? "rounded-2xl bg-teal-50/55 ring-1 ring-teal-200/45 shadow-sm shadow-teal-900/[0.04]"
      : "rounded-2xl bg-white/75 ring-1 ring-teal-900/[0.07] shadow-sm shadow-teal-900/[0.04]";
  return (
    <section className={`mb-2 overflow-hidden ${shell} ${className}`.trim()}>
      <button
        type="button"
        className="sticky top-0 z-[2] flex w-full items-start gap-2.5 rounded-t-2xl bg-white/88 px-3 py-2.5 text-left backdrop-blur-md transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span
          className={`mt-0.5 inline-block shrink-0 text-xs text-teal-700 transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
        <span className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900">{title}</h2>
          {!open && summary ? (
            <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">{summary}</span>
          ) : null}
        </span>
      </button>
      {open ? <div className="space-y-2.5 px-3 pb-3.5 pt-0 text-sm">{children}</div> : null}
    </section>
  );
}

/** ~Max sample points per practice polygon (CSS markers; cap total for DOM cost). */
const WIND_FIELD_MAX_ARROWS = 72;
const MAX_TOTAL_WIND_FIELD_MARKERS = 560;

function sampleWindFieldOrigins(
  poly: GeoJSON.Polygon,
  centroidLng: number,
  centroidLat: number,
  maxPoints: number,
): [number, number][] {
  const [minLng, minLat, maxLng, maxLat] = bbox({
    type: "Feature",
    geometry: poly,
    properties: {},
  } as Feature<Polygon>);
  const w = Math.max(maxLng - minLng, 1e-6);
  const h = Math.max(maxLat - minLat, 1e-6);
  // Finer grid, then subsample so arrows spread across the polygon instead of filling from one corner.
  const gridN = Math.min(32, Math.max(10, Math.ceil(Math.sqrt(maxPoints * 3.2))));
  const stepLng = w / gridN;
  const stepLat = h / gridN;
  const candidates: [number, number][] = [];
  for (let i = 0; i <= gridN; i++) {
    const la = minLat + i * stepLat;
    for (let j = 0; j <= gridN; j++) {
      const lo = minLng + j * stepLng;
      if (booleanPointInPolygon(turfPoint([lo, la]), poly)) {
        candidates.push([lo, la]);
      }
    }
  }
  if (candidates.length === 0) return [[centroidLng, centroidLat]];
  if (candidates.length <= maxPoints) return candidates;
  const out: [number, number][] = [];
  const denom = Math.max(1, maxPoints - 1);
  for (let k = 0; k < maxPoints; k++) {
    const idx = Math.round((k / denom) * (candidates.length - 1));
    out.push(candidates[idx]!);
  }
  return out;
}

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
  const [basemap, setBasemap] = useState<BasemapId>("hybrid");
  const [reliefOpacity, setReliefOpacity] = useState(0.42);
  const [activeSport, setActiveSport] = useState<"kiteski" | "kitesurf">("kiteski");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [ranked, setRanked] = useState<RankedPracticeArea[]>([]);
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
  const [terrainClick, setTerrainClick] = useState<ClickTerrain | null>(null);
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
    const r = await fetch(`/api/map/bundle?activeSport=${activeSport}`);
    if (!r.ok) return;
    const j = (await r.json()) as Bundle;
    setBundle(j);
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
    const q = new URLSearchParams({
      sport: activeSport,
      at: forecastAtIso,
    });
    q.set("optimalWindHalfWidthDeg", String(optimalWindHalfWidthDeg));
    const r = await fetch(`/api/forecast/rank?${q.toString()}`);
    if (!r.ok) {
      setMsg(`Forecast ranking failed (${r.status}). Wind overlays may be missing.`);
      return;
    }
    const j = (await r.json()) as { ranked: RankedPracticeArea[] };
    setRanked(j.ranked ?? []);
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

  const areasColored = useMemo(() => {
    if (!bundle?.practiceAreas) return null;
    const rankMap = new Map(ranked.map((r) => [r.areaId, r.score]));
    const features: Feature[] = bundle.practiceAreas.features.map((f) => {
      const props = (f.properties ?? {}) as Record<string, unknown>;
      const id = String(f.id ?? props.id ?? "");
      const score = rankMap.get(id) ?? 0;
      const sel = id === selectedPracticeAreaId ? 1 : 0;
      const isCommunity = props.isCommunity === 1 || props.isCommunity === true ? 1 : 0;
      return {
        ...f,
        properties: {
          ...props,
          rankScore: score,
          rankColor: rankColor(score),
          selectedPractice: sel,
          isCommunity,
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
        ? sampleWindFieldOrigins(poly, lng, lat, WIND_FIELD_MAX_ARROWS)
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

  return (
    <div className="relative h-screen w-full">
      <div className="absolute left-2 top-2 z-10 flex max-w-[min(24rem,calc(100vw-1rem))] max-h-[92vh] min-h-0 flex-col text-sm">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-teal-900/10 bg-white/90 shadow-xl shadow-teal-900/[0.07] backdrop-blur-md">
          <div className="shrink-0 border-b border-teal-900/10 bg-gradient-to-br from-teal-50/90 via-white to-sky-50/35">
            <Link
              href="/"
              className="flex w-full items-center justify-center px-4 py-4 outline-none transition hover:bg-white/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600"
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
              className="mx-2.5 mb-2 flex gap-0.5 rounded-xl bg-teal-900/[0.075] p-1"
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
                  className={`min-h-[40px] flex-1 rounded-lg px-1.5 py-2 text-center text-xs font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${
                    sidebarTab === id
                      ? "bg-white text-teal-900 shadow-sm ring-1 ring-teal-900/10"
                      : "text-zinc-600 hover:bg-white/60 hover:text-teal-800"
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
                className="rounded-lg px-2 py-1 text-[10px] font-medium text-teal-800/90 transition-colors hover:bg-white/90"
                onClick={() => expandCurrentTabSections()}
              >
                Expand tab
              </button>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-[10px] font-medium text-zinc-500 transition-colors hover:bg-white/90"
                onClick={() => collapseCurrentTabSections()}
              >
                Collapse tab
              </button>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-white/90"
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
              value={activeSport}
              onChange={(e) => setActiveSport(e.target.value as "kiteski" | "kitesurf")}
              className="w-full rounded-xl border border-teal-900/10 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner shadow-teal-900/[0.03] focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
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
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-800">Forecast time</span>
            <input
              type="range"
              min={0}
              max={FORECAST_SLIDER_MAX_H}
              step={1}
              value={hoursAhead}
              onChange={(e) => setHoursAhead(Number(e.target.value))}
              className="w-full accent-teal-600"
            />
            <p
              className="text-xs font-medium text-zinc-800"
              suppressHydrationWarning
              title="Shown in your device timezone after load"
            >
              {new Date(forecastAtIso).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-zinc-600">
              <span>
                Anchor +{hoursAhead}h (max {FORECAST_SLIDER_MAX_H}h)
              </span>
              <button
                type="button"
                className="rounded-lg border border-teal-200/80 bg-white px-2 py-1 text-[10px] font-medium text-teal-900 hover:bg-teal-50/80"
                onClick={() => {
                  setForecastAnchorMs(floorToHourMs());
                  setHoursAhead(0);
                }}
              >
                Now
              </button>
            </div>
            <p className="text-[10px] leading-snug text-zinc-500">
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
          </label>
          {ranked.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-zinc-600">
                Areas (best score first) — tap to fly the map here
              </p>
              <ul className="max-h-52 space-y-0 overflow-auto rounded-xl bg-teal-50/20 text-[11px] leading-snug text-zinc-700 ring-1 ring-teal-900/5">
                {ranked.map((r, idx) => {
                  const visLabel = r.wind ? formatVisibilityM(r.wind.visibilityM) : "—";
                  const mpSub = windMultiPointSubtitle(r.wind);
                  return (
                  <li key={r.areaId} className="border-b border-teal-900/[0.06] last:border-0">
                    <button
                      type="button"
                      className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-teal-100/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-600"
                      onClick={() => focusRankedAreaOnMap(r)}
                    >
                      <span className="flex items-start gap-2">
                        <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-[10px] text-zinc-400 tabular-nums">
                          {idx + 1}.
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-zinc-900">
                            {r.name.trim() ? r.name.trim() : `Area ${r.areaId.slice(0, 6)}`}
                          </span>
                          <span className="text-zinc-600">
                            {" · score "}
                            <strong className="text-zinc-900">{r.score}</strong>
                            {r.wind ? (
                              <>
                                {" · "}
                                {windCompactSummary(r.wind)}
                                {visLabel !== "—" ? (
                                  <>
                                    {" · vis "}
                                    {visLabel}
                                  </>
                                ) : null}
                                {mpSub ? (
                                  <span className="mt-0.5 block text-[10px] text-zinc-500">{mpSub}</span>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-zinc-400"> · no forecast</span>
                            )}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-[10px] text-zinc-500">
              {isAuthed
                ? "No ranked areas yet — add a practice polygon or mark an area public."
                : "No public areas for this sport yet — check the other sport or sign in to explore private spots you have saved."}
            </p>
          )}
          {isAuthed ? (
            rankingPrefsLoading || !rankingForm || !multiPointForm ? (
              <p className="mt-3 text-[10px] text-zinc-500">Loading your scoring settings…</p>
            ) : (
              <div className="mt-3 space-y-3 rounded-2xl border border-teal-200/80 bg-teal-50/30 p-3 ring-1 ring-teal-900/[0.06]">
                <p className="text-[11px] font-semibold text-zinc-800">
                  Your forecast scoring — {activeSport === "kiteski" ? "kite ski" : "kite surf"}
                </p>
                <p className="text-[10px] leading-snug text-zinc-600">
                  Wind speed window and ideal band set how strongly forecast speed matches your sport.
                  Weights scale wind fit, gust penalty, and how much direction matters before the
                  experience boost.
                </p>
                <div className="rounded-xl border border-sky-200/80 bg-sky-50/40 p-2.5 ring-1 ring-sky-900/[0.04]">
                  <p className="text-[10px] font-semibold text-sky-950">Area forecast sampling</p>
                  <p className="mt-1 text-[10px] leading-snug text-sky-900/90">
                    <strong>Auto</strong> adds extra API calls when the polygon is wide (≈3+ km) or
                    terrain varies a lot inside it. <strong>On</strong> always samples up to your max
                    spots. <strong>Conservative</strong> scoring uses the weakest wind and strictest
                    direction match among spots; <strong>representative</strong> uses medians and mean
                    direction.
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium text-sky-950">Mode</span>
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
                        className="rounded-lg border border-sky-900/15 bg-white px-2 py-1 text-xs text-zinc-900"
                      >
                        <option value="off">Off (centre only)</option>
                        <option value="auto">Auto (large / hilly areas)</option>
                        <option value="on">On (always multi-spot)</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium text-sky-950">Max spots (3–9)</span>
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
                        className="rounded-lg border border-sky-900/15 bg-white px-2 py-1 text-xs text-zinc-900"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium text-sky-950">Collapse policy</span>
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
                        className="rounded-lg border border-sky-900/15 bg-white px-2 py-1 text-xs text-zinc-900"
                      >
                        <option value="conservative">Conservative (min wind / strict dir)</option>
                        <option value="representative">Representative (median / mean dir)</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-zinc-700">Min wind (m/s)</span>
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
                      className="rounded-lg border border-teal-900/15 bg-white px-2 py-1 text-xs text-zinc-900"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-zinc-700">Max wind (m/s)</span>
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
                      className="rounded-lg border border-teal-900/15 bg-white px-2 py-1 text-xs text-zinc-900"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-zinc-700">Ideal min (m/s)</span>
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
                      className="rounded-lg border border-teal-900/15 bg-white px-2 py-1 text-xs text-zinc-900"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium text-zinc-700">Ideal max (m/s)</span>
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
                      className="rounded-lg border border-teal-900/15 bg-white px-2 py-1 text-xs text-zinc-900"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-zinc-700">
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
                    className="w-full accent-teal-600"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-zinc-700">
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
                    className="w-full accent-teal-600"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-zinc-700">
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
                    className="w-full accent-teal-600"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-teal-600/40 bg-teal-600 px-3 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-teal-700"
                    onClick={() => void saveRankingPrefsForActiveSport()}
                  >
                    Save scoring &amp; sampling
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-teal-900/15 bg-white px-3 py-2 text-[11px] font-medium text-zinc-800 hover:bg-teal-50/80"
                    onClick={() => void resetRankingPrefsForActiveSport()}
                  >
                    Use defaults (this sport)
                  </button>
                </div>
              </div>
            )
          ) : (
            <p className="mt-3 text-[10px] leading-snug text-zinc-500">
              <Link href="/login" className="font-medium text-teal-800 underline-offset-2 hover:underline">
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
            <p className="text-[11px] leading-snug text-zinc-600">
              Optimal wind is <strong>per practice area</strong> only. Open an area →{" "}
              <strong>Edit area</strong> to draw direction on the map or type degrees. Areas without
              an optimal get <strong>no direction penalty</strong> (unless you use saved wind sectors).
            </p>
            <p className="text-[11px] leading-snug text-zinc-600">
              <strong>Multi-spot forecast</strong> (when enabled) fetches several grid-aligned points
              inside each polygon with per-spot elevation for Met.no. Scores combine those samples:
              conservative mode penalises using the lowest wind speed and the worst direction match;
              gust penalty uses the strongest gust vs median speed.
            </p>
            {mapMode === "pickWind" ? (
              <div className="space-y-2 rounded-2xl border border-violet-200/80 bg-gradient-to-b from-violet-50/95 to-white/90 p-3 shadow-inner shadow-violet-900/5">
                <p className="text-[10px] font-medium text-violet-950">
                  Saving to the open practice area — see the edit panel for tips.
                </p>
                <p className="text-[11px] leading-snug text-violet-950">
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
                  className="w-full rounded-xl border border-violet-300/80 bg-white px-2 py-2 text-[11px] font-medium text-violet-900 hover:bg-violet-50"
                  onClick={() => cancelPickWind()}
                >
                  Cancel drawing
                </button>
                <p className="text-[10px] text-violet-800/90">
                  <kbd className="rounded-md bg-violet-200/80 px-1 py-0.5">Esc</kbd> cancel · right-click
                  resets tail
                </p>
              </div>
            ) : null}
          </div>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700">
              Match width ±{optimalWindHalfWidthDeg}° (~{Math.round((optimalWindHalfWidthDeg / 180) * 100)}%
              of half-circle)
            </span>
            <input
              type="range"
              min={5}
              max={90}
              value={optimalWindHalfWidthDeg}
              onChange={(e) => setOptimalWindHalfWidthDeg(Number(e.target.value))}
              className="w-full"
            />
            <span className="text-[10px] leading-snug text-zinc-500">
              Full direction score when forecast is within this window of each area’s saved optimal.
              Wider = more forgiving; also scales the bonus inside saved wind sectors.
            </span>
          </label>
          <p className="mt-2 text-[10px] leading-snug text-zinc-500">
            When a practice area is selected and has an optimal, a short <strong>downwind</strong> arrow
            is shown from that area’s centre (inside the polygon).
          </p>
          <label className="mt-1 flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700">
              Saved-area sector half-width: {sectorHalfWidthDeg}°
            </span>
            <input
              type="range"
              min={15}
              max={90}
              value={sectorHalfWidthDeg}
              onChange={(e) => setSectorHalfWidthDeg(Number(e.target.value))}
              className="w-full"
            />
            <span className="text-[10px] text-zinc-500">
              Used in <strong>Edit area</strong> when saving a wind sector arc around the area’s optimal
              bearing.
            </span>
          </label>
          <p className="mt-2 text-[10px] leading-snug text-zinc-500">
            Min/max wind, ideal band, and score weights are in <strong>Forecast &amp; ranked areas</strong>{" "}
            above. This section is for direction match width and drawing optimal wind on the map.
          </p>
          <div className="flex flex-wrap gap-2 text-[10px] text-zinc-600">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-4 rounded-sm" style={{ background: "#22c55e" }} />
              strong
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-4 rounded-sm" style={{ background: "#eab308" }} />
              ok
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-4 rounded-sm" style={{ background: "#f97316" }} />
              weak
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-4 rounded-sm" style={{ background: "#94a3b8" }} />
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
            <p className="text-[11px] text-zinc-500">Checking session…</p>
          ) : !isAuthed ? (
            <p className="text-[11px] leading-snug text-zinc-600">
              Anyone can browse <strong>public</strong> areas.{" "}
              <Link href="/login" className="font-medium text-teal-700 underline hover:text-teal-900">
                Sign in
              </Link>{" "}
              to add your own spots.
            </p>
          ) : (
            <>
              <p className="text-[11px] leading-snug text-zinc-600">
                Uses forecast at polygon centre and each area’s wind settings (set under{" "}
                <strong>Edit area</strong>).
              </p>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-zinc-700">Name for new drawings</span>
                <input
                  type="text"
                  value={drawAreaName}
                  onChange={(e) => setDrawAreaName(e.target.value.slice(0, 120))}
                  placeholder="e.g. West beach"
                  className="rounded-xl border border-teal-900/10 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                  maxLength={120}
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {mapMode === "browse" ? (
                  <button
                    type="button"
                    className="rounded-xl bg-teal-700 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-teal-900/15 hover:bg-teal-800"
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
                      className="rounded-xl bg-zinc-800 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-900"
                      disabled={loading}
                      onClick={() => void finishDrawing()}
                    >
                      Finish &amp; save
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-zinc-300 bg-white px-2 py-2 text-xs hover:bg-zinc-50"
                      onClick={() => setDrawRing((r) => r.slice(0, -1))}
                      disabled={drawRing.length === 0}
                    >
                      Undo point
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-zinc-300 bg-white px-2 py-2 text-xs hover:bg-zinc-50"
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
                <p className="text-[11px] text-zinc-600">
                  {editingAreaId ? (
                    <span className="font-medium text-amber-800">Editing boundary · </span>
                  ) : null}
                  {drawRing.length} point{drawRing.length === 1 ? "" : "s"} · click map for corners ·{" "}
                  <kbd className="rounded-md bg-zinc-200/90 px-1 py-0.5 text-[10px]">Esc</kbd> cancels
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
            <p className="text-[11px] text-zinc-500">Checking session…</p>
          ) : !isAuthed ? (
            <p className="text-[11px] leading-snug text-zinc-700">
              <Link href="/login" className="font-medium text-teal-800 underline hover:text-teal-950">
                Sign in
              </Link>{" "}
              to log sessions and get personalized ranking boosts on your areas.
            </p>
          ) : (
            <>
          <p className="text-[10px] leading-snug text-zinc-700">
            Add when and where you went (active sport:{" "}
            <strong>{activeSport === "kiteski" ? "Kite ski" : "Kite surf"}</strong>). We pull archive
            wind at the area centre; when forecast matches those buckets, areas with good sessions get a
            small score boost (needs at least two matching experiences per area).
          </p>
          <form
            className="flex flex-col gap-2 border-t border-teal-200/80 pt-2"
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
            <label className="text-[11px] font-medium text-zinc-800">
              When
              <input
                key={clientReady ? "occurredAt" : "occurredAt-pending"}
                type="datetime-local"
                name="occurredAt"
                required
                defaultValue={clientReady ? toDatetimeLocalInput(new Date()) : ""}
                className="mt-0.5 w-full rounded border px-2 py-1 text-xs"
              />
            </label>
            <label className="text-[11px] font-medium text-zinc-800">
              Area
              <select
                name="practiceAreaId"
                required
                className="mt-0.5 w-full rounded border px-2 py-1 text-xs"
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
            <label className="text-[11px] font-medium text-zinc-800">
              How were conditions?
              <select
                name="sessionSuitability"
                className="mt-0.5 w-full rounded border px-2 py-1 text-xs"
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
              className="rounded bg-teal-700 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Save experience
            </button>
          </form>
          {experiences.length > 0 ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto border-t border-teal-200/80 pt-2 text-[10px] text-zinc-700">
              {experiences.map((ex) => (
                <li
                  key={ex.id}
                  className="flex items-start justify-between gap-1 rounded border border-zinc-200/80 bg-white/80 px-1.5 py-1"
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
                    className="shrink-0 text-[10px] text-red-600 hover:underline"
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
            <p className="text-[10px] text-zinc-500">No experiences for this sport yet.</p>
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
            <p className="text-xs text-zinc-500">Checking session…</p>
          ) : isAuthed ? (
            <>
              {msg && <p className="text-xs text-zinc-600">{msg}</p>}
              <button
                type="button"
                className="text-left text-xs font-medium text-teal-700 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-900"
                onClick={() => void signOut({ callbackUrl: "/login" })}
              >
                Sign out
              </button>
            </>
          ) : (
            <p className="text-xs leading-snug text-zinc-600">
              <Link
                href="/login"
                className="font-medium text-teal-700 underline decoration-teal-700/50 underline-offset-2 hover:text-teal-900"
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
            className="shrink-0 border-t border-teal-900/10 bg-white/60 px-2 py-2 text-center text-[10px] text-zinc-500 backdrop-blur-sm"
            aria-label="Legal"
          >
            <Link
              href="/terms"
              className="font-medium text-teal-700/95 hover:text-teal-900 hover:underline"
            >
              Terms of use
            </Link>
            <span className="text-zinc-400" aria-hidden>
              {" · "}
            </span>
            <Link
              href="/privacy"
              className="font-medium text-teal-700/95 hover:text-teal-900 hover:underline"
            >
              Privacy &amp; GDPR
            </Link>
          </nav>
        </div>
      </div>

      {terrainClick && (
        <div className="absolute bottom-2 left-2 z-10 max-w-xs rounded-2xl border border-teal-900/10 bg-white/95 p-3 text-xs shadow-lg shadow-teal-900/10 backdrop-blur-sm">
          <div className="flex justify-between gap-2">
            <span className="font-medium">Terrain</span>
            <button
              type="button"
              className="text-zinc-500"
              onClick={() => setTerrainClick(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 font-mono text-[11px] text-zinc-600">
            {terrainClick.lat.toFixed(5)}, {terrainClick.lng.toFixed(5)}
          </p>
          {terrainClick.loading ? (
            <p className="text-zinc-500">Elevation…</p>
          ) : terrainClick.error ? (
            <p className="text-red-600">{terrainClick.error}</p>
          ) : (
            <p className="text-zinc-800">
              <strong>{terrainClick.elevationM != null ? `${Math.round(terrainClick.elevationM)} m` : "—"}</strong>{" "}
              AMSL
            </p>
          )}
          <div className="mt-2 flex flex-col gap-1.5">
            <a
              href={yrNoHourlyTableUrlEn(terrainClick.lat, terrainClick.lng)}
              target="_blank"
              rel="noopener noreferrer"
              title="Opens yr.no in a new tab"
              aria-label="Open Yr.no hourly forecast in a new tab"
              className="flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-2.5 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-700"
            >
              <img
                src="/yr-external.ico"
                alt=""
                width={18}
                height={18}
                decoding="async"
                className="h-[18px] w-[18px] shrink-0 rounded-[4px] bg-white/10 ring-1 ring-white/25"
              />
              <span className="min-w-0 text-center leading-tight">Hourly forecast (point)</span>
              <ExternalTabIcon className="h-3 w-3 shrink-0 opacity-90" />
            </a>
            <a
              href={yrNoDailyTableUrlEn(terrainClick.lat, terrainClick.lng)}
              target="_blank"
              rel="noopener noreferrer"
              title="Opens yr.no in a new tab"
              aria-label="Open Yr.no long-term table in a new tab"
              className="flex items-center justify-center gap-2 text-center text-[10px] font-medium text-sky-800 underline-offset-2 hover:underline"
            >
              <img
                src="/yr-external.ico"
                alt=""
                width={16}
                height={16}
                decoding="async"
                className="h-4 w-4 shrink-0 rounded-[3px] ring-1 ring-sky-900/15"
              />
              <span>Long-term table</span>
              <ExternalTabIcon className="h-3 w-3 shrink-0 text-sky-700 opacity-90" />
            </a>
          </div>
        </div>
      )}

      <MapGL
        ref={mapRef}
        initialViewState={{
          longitude: 25,
          latitude: 65,
          zoom: 5,
        }}
        mapStyle={mapStyle}
        style={{
          width: "100%",
          height: "100%",
          cursor: mapMode === "draw" || mapMode === "pickWind" ? "crosshair" : undefined,
        }}
        maxZoom={19}
        minZoom={1}
        interactiveLayerIds={
          mapMode === "browse"
            ? ["yr-forecast-point", "yr-forecast-point-halo", "areas-fill"]
            : []
        }
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
                  ["==", ["get", "isCommunity"], 1],
                  0.22,
                  0.35,
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

