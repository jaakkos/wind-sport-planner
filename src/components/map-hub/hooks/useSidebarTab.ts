"use client";

import { useEffect, useState } from "react";
import {
  type SidebarTab,
  SIDEBAR_TAB_STORAGE,
} from "@/components/map-hub/constants";

/**
 * Tracks the active hub sidebar tab and mirrors it to localStorage so the
 * choice survives reloads. The initial render uses the SSR-safe default
 * ("plan"); the stored value is hydrated in an effect.
 */
export function useSidebarTab(): {
  tab: SidebarTab;
  setTab: (tab: SidebarTab) => void;
} {
  const [tab, setTab] = useState<SidebarTab>("plan");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_TAB_STORAGE);
      if (raw === "plan" || raw === "map" || raw === "you") setTab(raw);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_TAB_STORAGE, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  return { tab, setTab };
}
