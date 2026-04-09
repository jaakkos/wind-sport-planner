import type { ReactNode } from "react";

/** Card shell shared by sidebar sections (see docs/ui-roadmap §5.2). */
export function sidebarSectionShellClass(variant: "default" | "accent" = "default"): string {
  return variant === "accent"
    ? "rounded-2xl bg-app-surface-muted ring-1 ring-app-border shadow-[var(--app-shadow-hub)]"
    : "rounded-2xl bg-app-surface-raised/85 ring-1 ring-app-border shadow-[var(--app-shadow-hub)]";
}

type SidebarSectionCollapsible = {
  title: string;
  summary?: string;
  variant?: "default" | "accent";
  className?: string;
  children: ReactNode;
  collapsible: true;
  open: boolean;
  onToggle: () => void;
};

type SidebarSectionStatic = {
  title: string;
  summary?: string;
  variant?: "default" | "accent";
  className?: string;
  children: ReactNode;
  collapsible?: false;
};

export type SidebarSectionProps = SidebarSectionCollapsible | SidebarSectionStatic;

/**
 * Roadmap §5.2 — title + optional chevron (when collapsible) + body.
 * Use `collapsible` for accordion rows; omit or `false` for a fixed header + content block.
 */
export function SidebarSection(props: SidebarSectionProps) {
  const { title, summary, variant = "default", className = "", children } = props;
  const shell = sidebarSectionShellClass(variant);
  const collapsible = props.collapsible === true;

  return (
    <section className={`mb-2 overflow-hidden ${shell} ${className}`.trim()}>
      {collapsible ? (
        <button
          type="button"
          className="sticky top-0 z-[2] flex w-full items-start gap-2.5 rounded-t-2xl bg-app-surface-raised/95 px-3 py-2.5 text-left backdrop-blur-md transition-colors hover:bg-app-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
          onClick={props.onToggle}
          aria-expanded={props.open}
        >
          <span
            className={`mt-0.5 inline-block shrink-0 text-xs text-app-accent transition-transform duration-200 ease-out ${props.open ? "rotate-180" : ""}`}
            aria-hidden
          >
            ▼
          </span>
          <span className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold tracking-tight text-app-fg">{title}</h2>
            {!props.open && summary ? (
              <span className="mt-0.5 block text-[11px] leading-snug text-app-fg-muted">{summary}</span>
            ) : null}
          </span>
        </button>
      ) : (
        <div className="rounded-t-2xl bg-app-surface-raised/95 px-3 py-2.5 backdrop-blur-md">
          <h2 className="text-sm font-semibold tracking-tight text-app-fg">{title}</h2>
          {summary ? (
            <span className="mt-0.5 block text-[11px] leading-snug text-app-fg-muted">{summary}</span>
          ) : null}
        </div>
      )}
      {collapsible ? (
        props.open ? (
          <div className="space-y-2.5 px-3 pb-3.5 pt-0 text-sm">{children}</div>
        ) : null
      ) : (
        <div className="space-y-2.5 px-3 pb-3.5 pt-0 text-sm">{children}</div>
      )}
    </section>
  );
}
