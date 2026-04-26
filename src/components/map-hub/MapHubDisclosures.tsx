"use client";

import { type ReactNode, useEffect, useState } from "react";

/** Default storage key for Plan “How ranking & map work” disclosure. */
const MAP_HUB_HELP_STORAGE_KEY = "mapHub.helpRankingExpanded";

/** Same-tab signal to open the help disclosure (e.g. from map legend). */
const MAP_HUB_EXPAND_HELP_EVENT = "fjelllift:expandMapHelp";

export function requestExpandMapHelp(): void {
  try {
    localStorage.setItem(MAP_HUB_HELP_STORAGE_KEY, "true");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MAP_HUB_EXPAND_HELP_EVENT));
  }
}

function initialOpenFromStorage(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function HelpDisclosure({
  title,
  storageKey = MAP_HUB_HELP_STORAGE_KEY,
  children,
}: {
  title: string;
  storageKey?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => initialOpenFromStorage(storageKey));

  useEffect(() => {
    const expand = () => {
      setOpen(true);
      try {
        localStorage.setItem(storageKey, "true");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener(MAP_HUB_EXPAND_HELP_EVENT, expand);
    return () => window.removeEventListener(MAP_HUB_EXPAND_HELP_EVENT, expand);
  }, [storageKey]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "true" : "false");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div
      id="map-hub-help-disclosure"
      className="mt-2 rounded-xl border border-app-border-subtle bg-app-accent-soft/50 ring-1 ring-app-border-subtle"
    >
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-app-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
        aria-expanded={open}
      >
        <span
          className={`mt-0.5 inline-block shrink-0 text-[10px] text-app-accent transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
        <span className="min-w-0 text-[11px] font-medium text-app-fg">{title}</span>
      </button>
      {open ? (
        <div className="border-t border-app-border-subtle px-2.5 pb-2.5 pt-1.5 text-[10px] leading-snug text-app-fg-muted">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function PersistedCollapsible({
  title,
  summaryCollapsed,
  storageKey,
  onOpenChange,
  children,
}: {
  title: string;
  summaryCollapsed: string;
  storageKey: string;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => initialOpenFromStorage(storageKey));

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "true" : "false");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-app-border bg-app-surface-muted ring-1 ring-app-border-subtle">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-app-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
        aria-expanded={open}
      >
        <span
          className={`mt-0.5 inline-block shrink-0 text-xs text-app-accent transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-[11px] font-semibold text-app-fg">{title}</span>
          {!open ? (
            <span className="mt-0.5 block text-[10px] leading-snug text-app-fg-muted">
              {summaryCollapsed}
            </span>
          ) : null}
        </span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-app-border px-3 pb-3.5 pt-2">{children}</div>
      ) : null}
    </div>
  );
}
