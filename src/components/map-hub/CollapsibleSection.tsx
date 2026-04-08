import type { ReactNode } from "react";

export function CollapsibleSection({
  title,
  summary,
  open,
  onToggle,
  variant = "default",
  className = "",
  children,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  variant?: "default" | "accent";
  className?: string;
  children: ReactNode;
}) {
  const shell =
    variant === "accent"
      ? "rounded-2xl bg-teal-50/55 ring-1 ring-teal-200/45 shadow-sm shadow-teal-900/[0.04]"
      : "rounded-2xl bg-white/75 ring-1 ring-teal-900/[0.07] shadow-sm shadow-teal-900/[0.04]";
  return (
    <section className={`mb-2 overflow-hidden ${shell} ${className}`.trim()}>
      <button
        type="button"
        className="sticky top-0 z-[2] flex w-full items-start gap-2.5 rounded-t-2xl bg-white/88 px-3 py-2.5 text-left backdrop-blur-md transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span
          className={`mt-0.5 inline-block shrink-0 text-xs text-teal-700 transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▼
        </span>
        <span className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900">{title}</h2>
          {!open && summary ? (
            <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">{summary}</span>
          ) : null}
        </span>
      </button>
      {open ? <div className="space-y-2.5 px-3 pb-3.5 pt-0 text-sm">{children}</div> : null}
    </section>
  );
}
