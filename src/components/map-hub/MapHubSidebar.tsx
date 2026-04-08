import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { ALL_TOOL_SECTIONS_OPEN, type SidebarTab, type ToolSectionKey } from "./constants";
import { MapHubMapTab } from "./MapHubMapTab";
import { MapHubPlanTab } from "./MapHubPlanTab";
import { MapHubYouTab } from "./MapHubYouTab";

export function MapHubSidebar({
  sidebarTab,
  setSidebarTab,
  expandCurrentTabSections,
  collapseCurrentTabSections,
  setToolSectionsOpen,
  planTabProps,
  mapTabProps,
  youTabProps,
}: {
  sidebarTab: SidebarTab;
  setSidebarTab: (t: SidebarTab) => void;
  expandCurrentTabSections: () => void;
  collapseCurrentTabSections: () => void;
  setToolSectionsOpen: Dispatch<SetStateAction<Record<ToolSectionKey, boolean>>>;
  planTabProps: ComponentProps<typeof MapHubPlanTab>;
  mapTabProps: ComponentProps<typeof MapHubMapTab>;
  youTabProps: ComponentProps<typeof MapHubYouTab>;
}) {
  return (
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
          {sidebarTab === "plan" && <MapHubPlanTab {...planTabProps} />}
          {sidebarTab === "map" && <MapHubMapTab {...mapTabProps} />}
          {sidebarTab === "you" && <MapHubYouTab {...youTabProps} />}
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
  );
}
