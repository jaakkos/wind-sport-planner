# Code review baseline — April 2026

This file is the regression anchor for the ongoing code-review work. Every commit during the cleanup must keep the headline numbers at or better than the values recorded here. Re-run with:

```bash
npm run audit:dead    # knip
npm run audit:cycles  # madge --circular --extensions ts,tsx --exclude '^generated/' src
npm run test:coverage # vitest with v8 coverage
```

Scope: `src/**` excluding `src/generated/**` (Prisma client output).

## Size

| Metric | Value |
|---|---|
| Source files (`.ts`/`.tsx`, excl. generated) | **77** |
| Total source LOC | **9,680** |
| Tests passing | **89 / 89** |
| Files > 400 LOC | **6** (target: 0) |

### Top files by LOC

| LOC | File |
|---:|---|
| 2,628 | [`src/components/MapHub.tsx`](../src/components/MapHub.tsx) — god component, 87 hook calls |
| 493 | [`src/components/map-hub/PracticeAreaEditPanel.tsx`](../src/components/map-hub/PracticeAreaEditPanel.tsx) |
| 426 | [`src/components/map-hub/MapHubPlanTab.tsx`](../src/components/map-hub/MapHubPlanTab.tsx) — currently dead (see below) |
| 386 | [`src/components/map-hub/MapHubYouTab.tsx`](../src/components/map-hub/MapHubYouTab.tsx) — currently dead (see below) |
| 342 | [`src/lib/heuristics/rankAreas.ts`](../src/lib/heuristics/rankAreas.ts) |
| 326 | [`src/lib/map/mapHubHelpers.ts`](../src/lib/map/mapHubHelpers.ts) — 24 exports, kitchen sink |
| 237 | [`src/app/privacy/page.tsx`](../src/app/privacy/page.tsx) — legal copy, expected |
| 217 | [`src/lib/heuristics/multiPointForecast.ts`](../src/lib/heuristics/multiPointForecast.ts) |
| 214 | [`src/components/map-hub/AreaForecastSamples.tsx`](../src/components/map-hub/AreaForecastSamples.tsx) |
| 186 | [`src/lib/weather/providers/openMeteo.ts`](../src/lib/weather/providers/openMeteo.ts) |

## Test coverage

Reported by `vitest run --coverage` (v8 provider).

| Metric | % |
|---|---:|
| Statements | **48.18** |
| Branches | **45.06** |
| Functions | **51.11** |
| Lines | **50.69** |

Notable gaps:

- [`src/lib/heuristics/rankAreas.ts`](../src/lib/heuristics/rankAreas.ts) — **0%** (the orchestrator we plan to decompose in Phase 2c needs tests before/after).
- [`src/lib/heuristics/practiceAreaForecastSamples.ts`](../src/lib/heuristics/practiceAreaForecastSamples.ts) — 0%.
- [`src/lib/heuristics/practiceAreaWindLocations.ts`](../src/lib/heuristics/practiceAreaWindLocations.ts) — 0%.
- [`src/lib/weather/enrichActivity.ts`](../src/lib/weather/enrichActivity.ts) — 0% (verified dead, dies in Phase 1c).
- [`src/lib/map/mapLayerToggles.ts`](../src/lib/map/mapLayerToggles.ts) — 0%.
- [`src/lib/map/styles.ts`](../src/lib/map/styles.ts) — 0%.

## Cycles

`npx madge --circular --extensions ts,tsx --exclude '^generated/' src` → **zero circular dependencies** in app code. (The 14 cycles in `src/generated/prisma/**` are the Prisma client and are intentionally excluded.)

## Dead code (knip)

Run with [`knip.json`](../knip.json) configured for Next.js + Vitest + Playwright + Prisma + Tailwind. Headline counts below; full snapshot in `/tmp/knip-baseline.json` (regenerate locally — not checked in).

| Category | Count |
|---|---:|
| Unused files | **5** |
| Unused dependencies | **2** |
| Unused devDependencies | **2** (excluding `prettier` and `eslint-config-prettier` which were just added) |
| Unused exports | **23** |
| Unused exported types | **17** |
| Duplicate exports | **1** |

### Unused files

- [`src/lib/weather/enrichActivity.ts`](../src/lib/weather/enrichActivity.ts) — defined, never called. **Dies in Commit 1c.**
- [`src/components/map-hub/MapHubSidebar.tsx`](../src/components/map-hub/MapHubSidebar.tsx) — orphan; no consumer.
- [`src/components/map-hub/MapHubPlanTab.tsx`](../src/components/map-hub/MapHubPlanTab.tsx) — only consumer is the orphan `MapHubSidebar`.
- [`src/components/map-hub/MapHubMapTab.tsx`](../src/components/map-hub/MapHubMapTab.tsx) — same.
- [`src/components/map-hub/MapHubYouTab.tsx`](../src/components/map-hub/MapHubYouTab.tsx) — same.

The four `MapHub*Tab*` files form a closed island never imported by [`src/components/MapHub.tsx`](../src/components/MapHub.tsx). Phase 3 must decide: (a) adopt them as the starting point for the decomposition, or (b) delete them as drift and re-extract from the live god component. Open question at Phase 3a kickoff.

### Unused dependencies

- `@mapbox/polyline` (+ `@types/mapbox__polyline`) — Strava polyline decoding; dies in Commit 1e.
- `bcryptjs` — auth uses magic links only; dies in Commit 1e if a final search confirms zero usage.

### Unused exports (sampled)

Concentrated in [`src/lib/map/mapHubHelpers.ts`](../src/lib/map/mapHubHelpers.ts) (10 dead exports out of 24) and [`src/lib/windlog/schema.ts`](../src/lib/windlog/schema.ts) (3 — whole module dies in Commit 1a). Full list will shrink naturally as Phases 1–2 land.

## Targets

| Target | Today | Goal |
|---|---:|---:|
| Files > 400 LOC | 6 | **0** |
| `MapHub.tsx` LOC | 2,628 | **≤ 300** |
| Knip unused files | 5 | **0** |
| Knip unused exports | 23 | **0** |
| Knip unused deps | 2 | **0** |
| Cycles in `src/` (excl. generated) | 0 | 0 (keep) |
| Statements coverage | 48.18 % | **≥ 48.18 %** (do not regress) |
| Tests passing | 89 / 89 | 100 % |

## Visual regression reference

Screenshots captured in [`docs/screenshots/baseline/`](screenshots/baseline/) (Commit 0.3). Compare visually after every UI-touching commit (Phases 3–4).

---

*Generated 2026-04-25.*
