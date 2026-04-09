"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import { formatVisibilityM } from "@/lib/weather/formatVisibility";
import { windCompactSummary } from "@/lib/map/mapHubHelpers";
import { yrNoHourlyTableUrlEn } from "@/lib/yrNoUrls";
import { ExternalTabIcon } from "./ExternalTabIcon";

type SampleSpot = {
  lat: number;
  lng: number;
  elevationM: number | null;
  wind: {
    speedMs: number | null;
    gustMs: number | null;
    dirFromDeg: number | null;
    visibilityM: number | null;
    observedAt: string;
  } | null;
};

type ApiOk = {
  spots: SampleSpot[];
  multiPointMode: string;
  bboxDiagonalKm: number;
  elevRangeM: number;
  providerId: string | null;
};

function mapLabelForSpot(s: SampleSpot): string {
  const elev =
    s.elevationM != null && Number.isFinite(s.elevationM)
      ? `${Math.round(s.elevationM)} m AMSL`
      : "elev —";
  const windLine = s.wind
    ? windCompactSummary({
        speedMs: s.wind.speedMs,
        gustMs: s.wind.gustMs,
        dirFromDeg: s.wind.dirFromDeg,
      })
    : "No forecast";
  return `${elev}\n${windLine}`;
}

function spotsToFeatureCollection(spots: SampleSpot[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: spots.map((s, i) => ({
      type: "Feature" as const,
      properties: { index: i + 1, mapLabel: mapLabelForSpot(s) },
      geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
    })),
  };
}

export function AreaForecastSamples({
  areaId,
  forecastAtIso,
  sport,
  optimalWindHalfWidthDeg,
  onMapPointsChange,
  embedded = false,
}: {
  areaId: string;
  forecastAtIso: string;
  sport: "kiteski" | "kitesurf";
  optimalWindHalfWidthDeg: number;
  onMapPointsChange: (fc: FeatureCollection | null) => void;
  /** Hide section chrome when nested under another heading (e.g. edit panel disclosure). */
  embedded?: boolean;
}) {
  const [data, setData] = useState<ApiOk | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const mapCbRef = useRef(onMapPointsChange);
  useEffect(() => {
    mapCbRef.current = onMapPointsChange;
  }, [onMapPointsChange]);

  useEffect(() => {
    mapCbRef.current(null);
    const ac = new AbortController();
    const q = new URLSearchParams({
      areaId,
      sport,
      at: forecastAtIso,
      optimalWindHalfWidthDeg: String(optimalWindHalfWidthDeg),
    });
    void fetch(`/api/forecast/practice-area-samples?${q}`, { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || r.statusText);
        }
        return r.json() as Promise<ApiOk>;
      })
      .then((j) => {
        setData(j);
        mapCbRef.current(spotsToFeatureCollection(j.spots));
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setErr(e instanceof Error ? e.message : "Failed to load samples");
        mapCbRef.current(null);
      })
      .finally(() => setLoading(false));
    return () => {
      ac.abort();
      mapCbRef.current(null);
    };
  }, [areaId, forecastAtIso, sport, optimalWindHalfWidthDeg]);

  const rows = useMemo(() => {
    if (!data?.spots.length) return [];
    return [...data.spots].sort((a, b) => {
      const ea = a.elevationM ?? -Infinity;
      const eb = b.elevationM ?? -Infinity;
      return eb - ea;
    });
  }, [data]);

  return (
    <div className={embedded ? "space-y-2" : "mt-3 border-t border-app-border pt-2"}>
      {!embedded ? (
        <>
          <p className="text-xs font-semibold text-app-fg">Forecast sample spots</p>
          <p className="mt-1 text-[10px] leading-snug text-app-fg-muted">
            Same locations as ranking uses for this hour (sidebar forecast time). Multiple{" "}
            <strong>amber dots</strong> on the map when the polygon is wide or elevation varies inside
            the area — compare wind at higher vs lower points.
          </p>
        </>
      ) : null}
      {loading ? (
        <p className="mt-2 text-[10px] text-app-fg-subtle">Loading samples…</p>
      ) : err ? (
        <p className="mt-2 text-[10px] text-app-danger">{err}</p>
      ) : data ? (
        <>
          <p className="mt-1 text-[10px] text-app-fg-subtle">
            Mode: <span className="font-medium text-app-fg-muted">{data.multiPointMode}</span>
            {data.spots.length > 1 ? (
              <>
                {" "}
                · {data.spots.length} points · bbox ~{data.bboxDiagonalKm.toFixed(1)} km
                {data.elevRangeM > 0 ? (
                  <>
                    {" "}
                    · relief ~{Math.round(data.elevRangeM)} m
                  </>
                ) : null}
              </>
            ) : (
              " · centroid only"
            )}
            {data.providerId ? (
              <>
                {" "}
                · {data.providerId}
              </>
            ) : null}
          </p>
          <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-[10px]">
            {rows.map((s, i) => {
              const vis =
                s.wind?.visibilityM != null ? formatVisibilityM(s.wind.visibilityM) : null;
              return (
                <li
                  key={`${s.lat.toFixed(5)},${s.lng.toFixed(5)},${i}`}
                  className="rounded border border-app-warning-border bg-app-warning-bg px-2 py-1.5 text-app-warning-fg"
                >
                  <div className="flex flex-wrap items-start justify-between gap-1">
                    <span className="font-mono text-[9px] text-app-fg-subtle">
                      {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                    </span>
                    <span className="shrink-0 text-[9px] text-app-fg-muted">
                      {s.elevationM != null && Number.isFinite(s.elevationM)
                        ? `${Math.round(s.elevationM)} m AMSL`
                        : "elev —"}
                    </span>
                  </div>
                  <p className="mt-0.5 leading-snug">
                    {s.wind ? (
                      <>
                        {windCompactSummary({
                          speedMs: s.wind.speedMs,
                          gustMs: s.wind.gustMs,
                          dirFromDeg: s.wind.dirFromDeg,
                        })}
                        {vis && vis !== "—" ? ` · vis ${vis}` : ""}
                      </>
                    ) : (
                      <span className="text-app-fg-subtle">No forecast for this point</span>
                    )}
                  </p>
                  <a
                    href={yrNoHourlyTableUrlEn(s.lat, s.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[9px] font-medium text-sky-800 hover:underline"
                  >
                    Yr hourly (this point)
                    <ExternalTabIcon className="h-2.5 w-2.5 text-sky-700" />
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
