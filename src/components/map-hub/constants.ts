export type ToolSectionKey =
  | "sport"
  | "draw"
  | "windRank"
  | "basemap"
  | "overlays"
  | "experiences"
  | "forecast"
  | "account";

export const ALL_TOOL_SECTIONS_OPEN: Record<ToolSectionKey, boolean> = {
  sport: true,
  draw: true,
  windRank: true,
  basemap: true,
  overlays: true,
  experiences: true,
  forecast: true,
  account: true,
};

/** First visit: show sport + forecast (core planning path). */
export const DEFAULT_TOOL_SECTIONS: Record<ToolSectionKey, boolean> = {
  sport: true,
  draw: false,
  windRank: false,
  basemap: false,
  overlays: false,
  experiences: false,
  forecast: true,
  account: false,
};

export type SidebarTab = "plan" | "map" | "you";

export const SIDEBAR_TAB_STORAGE = "fjelllift-sidebar-tab";

export function toolKeysForTab(tab: SidebarTab): ToolSectionKey[] {
  switch (tab) {
    case "plan":
      return ["sport", "forecast", "windRank"];
    case "map":
      return ["basemap", "overlays"];
    case "you":
      return ["draw", "experiences", "account"];
    default:
      return [];
  }
}

export const FORECAST_SLIDER_MAX_H = 120;
