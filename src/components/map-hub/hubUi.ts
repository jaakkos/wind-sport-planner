/**
 * Shared Tailwind class strings for map hub panels (Plan tab, edit panel, disclosures).
 * Colors reference CSS variables from src/app/globals.css (`app-*` theme).
 */

/** Floating panel shell (edit area, sidebar chrome uses its own outer wrapper). */
export const hubPanelShell =
  "rounded-2xl border border-app-border bg-app-surface/95 shadow-[var(--app-shadow-hub)] backdrop-blur-md";

/** Primary actions: save scoring, draw wind, save meta. */
export const hubBtnPrimary =
  "rounded-xl border border-app-accent/40 bg-app-accent px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-app-accent-hover disabled:opacity-50";

/** Secondary: outline on surface. */
export const hubBtnSecondary =
  "rounded-xl border border-app-border bg-app-surface px-3 py-2 text-[11px] font-medium text-app-fg transition-colors hover:bg-app-surface-muted";

/** Compact secondary (toolbar, inline). */
export const hubBtnSecondarySm =
  "rounded-lg border border-app-border bg-app-surface px-2 py-1 text-[10px] font-medium text-app-fg transition-colors hover:bg-app-surface-muted";

/** Secondary actions in toolbars (draw undo/cancel, same height as compact rows). */
export const hubBtnSecondaryToolbar =
  "rounded-xl border border-app-border bg-app-surface px-2 py-2 text-xs font-medium text-app-fg transition-colors hover:bg-app-surface-muted disabled:opacity-50";

/** Keyboard hint styling. */
export const hubKbd =
  "rounded-md bg-app-accent-muted px-1 py-0.5 font-mono text-[10px] text-app-fg-muted";

/** Danger / destructive. */
export const hubBtnDanger =
  "rounded-xl border border-app-danger-border bg-app-danger-bg px-3 py-2 text-[11px] font-medium text-app-danger transition-colors hover:opacity-90 disabled:opacity-50";

/** Text inputs and selects inside hub panels. */
export const hubInput =
  "mt-0.5 w-full rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg placeholder:text-app-fg-subtle focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/20";

export const hubSelect =
  "w-full rounded-xl border border-app-border bg-app-surface px-3 py-2 text-sm text-app-fg shadow-inner shadow-app-fg/5 focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/20";

/** Native datetime-local and small selects in forms (You tab experiences). */
export const hubInputNative =
  "mt-0.5 w-full rounded-lg border border-app-border bg-app-surface px-2 py-1 text-xs text-app-fg focus:border-app-accent focus:outline-none focus:ring-2 focus:ring-app-accent/20";

/** List row card (session experiences). */
export const hubListRow =
  "flex items-start justify-between gap-1 rounded border border-app-border bg-app-surface/80 px-1.5 py-1";

/** Section title (Basics, Wind, etc.). */
export const hubSectionTitle = "text-xs font-semibold text-app-fg";

/** Muted helper / meta line. */
export const hubMeta = "text-[10px] leading-snug text-app-fg-muted";
