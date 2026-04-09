/**
 * Loading placeholders for map hub (Phase D — docs/ui-roadmap).
 * Uses `animate-pulse`; respect reduced motion via Tailwind `motion-reduce:`.
 */

const rowBar = "animate-pulse rounded bg-app-border-subtle motion-reduce:animate-none";

export function RankedListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1" aria-busy="true" aria-label="Loading ranked areas">
      <div className={`h-3 max-w-[14rem] w-[80%] ${rowBar}`} />
      <ul
        className="max-h-52 space-y-0 overflow-auto rounded-xl bg-app-surface-muted ring-1 ring-app-border-subtle"
        role="presentation"
      >
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="border-b border-app-border-subtle px-2 py-2 last:border-0">
            <div className="flex items-start gap-2">
              <div className={`mt-0.5 h-4 w-5 shrink-0 ${rowBar}`} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className={`h-3 w-2/3 ${rowBar}`} />
                <div className={`h-2.5 w-full ${rowBar} opacity-80`} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScoringPrefsSkeleton() {
  return (
    <div className="mt-3 space-y-2" aria-busy="true" aria-label="Loading scoring settings">
      <div className={`h-3 w-48 ${rowBar}`} />
      <div className={`h-24 rounded-xl bg-app-surface-muted ring-1 ring-app-border-subtle ${rowBar}`} />
    </div>
  );
}
