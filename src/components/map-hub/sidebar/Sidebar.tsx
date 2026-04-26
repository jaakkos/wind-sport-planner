"use client";

import Image from "next/image";
import Link from "next/link";

import { hubOverlayZ } from "@/components/map-hub/mapHubOverlayZ";
import type { SidebarTab } from "@/components/map-hub/constants";

type Props = {
  busy: boolean;
  sidebarTab: SidebarTab;
  setSidebarTab: (tab: SidebarTab) => void;
  expandCurrentTabSections: () => void;
  collapseCurrentTabSections: () => void;
  expandAllToolSections: () => void;
  children: React.ReactNode;
};

const TAB_ITEMS = [
  { id: "plan", label: "Plan", hint: "Sport, forecast & ranking" },
  { id: "map", label: "Map", hint: "Basemap & terrain look" },
  { id: "you", label: "You", hint: "Draw, sessions & account" },
] as const satisfies ReadonlyArray<{
  id: SidebarTab;
  label: string;
  hint: string;
}>;

/**
 * Glassy left-edge overlay panel that hosts the logo, tab bar, expand /
 * collapse controls, the active tab's content (passed as children), and
 * the legal footer. The component is purely presentational; MapHub owns
 * tab state and section state.
 */
export function Sidebar({
  busy,
  sidebarTab,
  setSidebarTab,
  expandCurrentTabSections,
  collapseCurrentTabSections,
  expandAllToolSections,
  children,
}: Props) {
  return (
    <div
      className={`absolute left-2 top-2 flex max-w-[min(24rem,calc(100vw-1rem))] max-h-[92vh] min-h-0 flex-col text-sm ${hubOverlayZ.sidebar}`}
      aria-busy={busy}
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
            {TAB_ITEMS.map(({ id, label, hint }) => (
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
                onClick={() => setSidebarTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mx-2.5 mb-2.5 flex flex-wrap items-center justify-end gap-1">
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-[10px] font-medium text-app-accent-hover transition-colors hover:bg-app-surface/90"
              onClick={expandCurrentTabSections}
            >
              Expand tab
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-[10px] font-medium text-app-fg-muted transition-colors hover:bg-app-surface/90"
              onClick={collapseCurrentTabSections}
            >
              Collapse tab
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-[10px] font-medium text-app-fg-subtle transition-colors hover:bg-app-surface/90"
              onClick={expandAllToolSections}
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
          {children}
        </div>
        <LegalFooter />
      </div>
    </div>
  );
}

function LegalFooter() {
  return (
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
  );
}
