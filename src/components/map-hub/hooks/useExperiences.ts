"use client";

import { useCallback, useEffect, useState } from "react";

export type ExperienceRow = {
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

export function useExperiences(activeSport: "kiteski" | "kitesurf"): {
  experiences: ExperienceRow[];
  reload: () => Promise<void>;
} {
  const [experiences, setExperiences] = useState<ExperienceRow[]>([]);

  const reload = useCallback(async () => {
    const r = await fetch(`/api/experiences?sport=${activeSport}`);
    if (!r.ok) return;
    const j = (await r.json()) as { experiences: ExperienceRow[] };
    setExperiences(j.experiences ?? []);
  }, [activeSport]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { experiences, reload };
}
