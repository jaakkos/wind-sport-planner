"use client";

import { useCallback, useState } from "react";
import {
  ALL_TOOL_SECTIONS_OPEN,
  DEFAULT_TOOL_SECTIONS,
  type SidebarTab,
  type ToolSectionKey,
  toolKeysForTab,
} from "@/components/map-hub/constants";

export function useToolSections(sidebarTab: SidebarTab): {
  open: Record<ToolSectionKey, boolean>;
  toggle: (key: ToolSectionKey) => void;
  openSection: (key: ToolSectionKey) => void;
  expandCurrentTab: () => void;
  collapseCurrentTab: () => void;
  expandAll: () => void;
} {
  const [open, setOpen] =
    useState<Record<ToolSectionKey, boolean>>(DEFAULT_TOOL_SECTIONS);

  const toggle = useCallback((key: ToolSectionKey) => {
    setOpen((s) => ({ ...s, [key]: !s[key] }));
  }, []);

  const openSection = useCallback((key: ToolSectionKey) => {
    setOpen((s) => (s[key] ? s : { ...s, [key]: true }));
  }, []);

  const expandCurrentTab = useCallback(() => {
    setOpen((s) => {
      const next = { ...s };
      for (const k of toolKeysForTab(sidebarTab)) next[k] = true;
      return next;
    });
  }, [sidebarTab]);

  const collapseCurrentTab = useCallback(() => {
    setOpen((s) => {
      const next = { ...s };
      for (const k of toolKeysForTab(sidebarTab)) next[k] = false;
      return next;
    });
  }, [sidebarTab]);

  const expandAll = useCallback(() => {
    setOpen({ ...ALL_TOOL_SECTIONS_OPEN });
  }, []);

  return { open, toggle, openSection, expandCurrentTab, collapseCurrentTab, expandAll };
}
