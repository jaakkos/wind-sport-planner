"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SportRankingFormState = {
  minWindMs: number;
  maxWindMs: number;
  idealMinMs: number;
  idealMaxMs: number;
  windFitScale: number;
  gustPenaltyScale: number;
  directionEmphasis: number;
};

export type MultiPointForecastFormState = {
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

type RankingForm = {
  kiteski: SportRankingFormState;
  kitesurf: SportRankingFormState;
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

function formsFromResponse(j: RankingPrefsApiResponse): {
  rankingForm: RankingForm;
  multiPointForm: MultiPointForecastFormState;
} {
  const dmp = j.doc?.multiPointForecast;
  const defMp = j.multiPointForecast;
  return {
    rankingForm: {
      kiteski: sportFormFromDefaults("kiteski", j.doc, j.defaults),
      kitesurf: sportFormFromDefaults("kitesurf", j.doc, j.defaults),
    },
    multiPointForm: {
      mode: dmp?.mode ?? defMp.mode,
      maxSamples: dmp?.maxSamples ?? defMp.maxSamples,
      scoringPolicy: dmp?.scoringPolicy ?? defMp.scoringPolicy,
    },
  };
}

export function useRankingPreferences(args: {
  activeSport: "kiteski" | "kitesurf";
  enabled: boolean;
  pending: boolean;
  onSaved?: () => void | Promise<void>;
  onError?: (toast: string) => void;
  onClearError?: () => void;
}): {
  rankingForm: RankingForm | null;
  multiPointForm: MultiPointForecastFormState | null;
  loading: boolean;
  patchActiveSport: (patch: Partial<SportRankingFormState>) => void;
  patchMultiPoint: (patch: Partial<MultiPointForecastFormState>) => void;
  save: () => Promise<void>;
  reset: () => Promise<void>;
} {
  const { activeSport, enabled, pending, onSaved, onError, onClearError } = args;
  const [rankingForm, setRankingForm] = useState<RankingForm | null>(null);
  const [multiPointForm, setMultiPointForm] =
    useState<MultiPointForecastFormState | null>(null);
  const [loading, setLoading] = useState(false);

  const onSavedRef = useRef(onSaved);
  const onErrorRef = useRef(onError);
  const onClearErrorRef = useRef(onClearError);
  useEffect(() => {
    onSavedRef.current = onSaved;
    onErrorRef.current = onError;
    onClearErrorRef.current = onClearError;
  }, [onSaved, onError, onClearError]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/user/ranking-preferences");
      if (!r.ok) {
        setRankingForm(null);
        setMultiPointForm(null);
        return;
      }
      const j = (await r.json()) as RankingPrefsApiResponse;
      const next = formsFromResponse(j);
      setRankingForm(next.rankingForm);
      setMultiPointForm(next.multiPointForm);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pending) return;
    if (!enabled) {
      setRankingForm(null);
      setMultiPointForm(null);
      return;
    }
    void load();
  }, [pending, enabled, load]);

  const patchActiveSport = useCallback(
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

  const patchMultiPoint = useCallback(
    (patch: Partial<MultiPointForecastFormState>) => {
      setMultiPointForm((p) => (p ? { ...p, ...patch } : p));
    },
    [],
  );

  const save = useCallback(async () => {
    if (!rankingForm || !multiPointForm) return;
    const f = rankingForm[activeSport];
    const r = await fetch("/api/user/ranking-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [activeSport]: {
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
      onErrorRef.current?.("Could not save scoring preferences.");
      return;
    }
    onClearErrorRef.current?.();
    const j = (await r.json()) as RankingPrefsApiResponse;
    const next = formsFromResponse(j);
    setRankingForm(next.rankingForm);
    setMultiPointForm(next.multiPointForm);
    await onSavedRef.current?.();
  }, [rankingForm, multiPointForm, activeSport]);

  const reset = useCallback(async () => {
    const r = await fetch("/api/user/ranking-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [activeSport]: null }),
    });
    if (!r.ok) {
      onErrorRef.current?.("Could not reset scoring preferences.");
      return;
    }
    onClearErrorRef.current?.();
    const j = (await r.json()) as RankingPrefsApiResponse;
    const next = formsFromResponse(j);
    setRankingForm(next.rankingForm);
    setMultiPointForm(next.multiPointForm);
    await onSavedRef.current?.();
  }, [activeSport]);

  return {
    rankingForm,
    multiPointForm,
    loading,
    patchActiveSport,
    patchMultiPoint,
    save,
    reset,
  };
}
