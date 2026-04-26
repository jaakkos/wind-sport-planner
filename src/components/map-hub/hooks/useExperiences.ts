"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createExperience,
  deleteExperience,
} from "@/lib/experiences/client";

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

type ActionInput = {
  practiceAreaId: string;
  occurredAt: string;
  sessionSuitability: string;
};

type Args = {
  activeSport: "kiteski" | "kitesurf";
  /** Re-rank after a session is added or removed. */
  onChanged?: () => void | Promise<void>;
  setMessage?: (msg: string | null) => void;
  setLoading?: (busy: boolean) => void;
};

/**
 * Loads session experiences for the active sport and exposes submit /
 * remove helpers. The hook owns the user-visible message and busy
 * flags it sets so MapHub can stay focused on composition.
 */
export function useExperiences({
  activeSport,
  onChanged,
  setMessage,
  setLoading,
}: Args): {
  experiences: ExperienceRow[];
  reload: () => Promise<void>;
  submit: (input: ActionInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
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

  const submit = useCallback(
    async (input: ActionInput) => {
      setLoading?.(true);
      setMessage?.(null);
      try {
        await createExperience({ ...input, sport: activeSport });
        await reload();
        await onChanged?.();
        setMessage?.("Experience saved.");
      } catch (err) {
        setMessage?.(err instanceof Error ? err.message : "Save failed");
      } finally {
        setLoading?.(false);
      }
    },
    [activeSport, reload, onChanged, setMessage, setLoading],
  );

  const remove = useCallback(
    async (id: string) => {
      setLoading?.(true);
      try {
        await deleteExperience(id);
        await reload();
        await onChanged?.();
        setMessage?.("Experience removed.");
      } catch {
        setMessage?.("Could not delete experience.");
      } finally {
        setLoading?.(false);
      }
    },
    [reload, onChanged, setMessage, setLoading],
  );

  return { experiences, reload, submit, remove };
}
