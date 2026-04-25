"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RankedPracticeArea } from "@/lib/heuristics/rankAreas";

const DEBOUNCE_MS = 300;

export function useForecastRanking(args: {
  sport: "kiteski" | "kitesurf";
  atIso: string;
  optimalWindHalfWidthDeg: number;
  onError?: (toast: string) => void;
}): {
  ranked: RankedPracticeArea[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
} {
  const { sport, atIso, optimalWindHalfWidthDeg, onError } = args;
  const [ranked, setRanked] = useState<RankedPracticeArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Keep the latest onError without re-creating reload on every render. */
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const reload = useCallback(async () => {
    setError(null);
    setLoading(true);
    const q = new URLSearchParams({ sport, at: atIso });
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
        setError(`Forecast ranking failed (HTTP ${r.status}).${detail}`);
        onErrorRef.current?.(
          `Forecast ranking failed (${r.status}). Wind overlays may be missing.`,
        );
        setRanked([]);
        return;
      }
      const j = (await r.json()) as { ranked: RankedPracticeArea[] };
      setRanked(j.ranked ?? []);
      setError(null);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setError(`Forecast ranking could not load: ${m}`);
      onErrorRef.current?.(`Forecast ranking failed. ${m}`);
      setRanked([]);
    } finally {
      setLoading(false);
    }
  }, [sport, atIso, optimalWindHalfWidthDeg]);

  useEffect(() => {
    const t = setTimeout(() => void reload(), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [reload]);

  return { ranked, loading, error, reload };
}
