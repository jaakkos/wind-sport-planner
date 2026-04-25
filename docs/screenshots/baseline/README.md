# Visual regression baseline — `/map`

This folder is the visual reference for the code-review cleanup. Every commit in Phases 3 and 4 (component decomposition and UX work) should produce screens that visually match these baselines unless the commit message explicitly says otherwise.

## What to capture

Capture each shot at **1440 × 900** (default desktop) on the **default basemap** (hybrid OSM + OpenTopoMap) with one practice area drawn around a recognisable location, signed in as a normal user.

| File | Page state |
|---|---|
| `01-plan-tab-default.png` | `/map` on first load, **Plan** tab open, no area selected. |
| `02-plan-tab-help-expanded.png` | Same as above with the "How ranking works" disclosure expanded. |
| `03-map-tab.png` | **Map** tab open, layer toggles visible. |
| `04-you-tab.png` | **You** tab open with at least one logged session experience. |
| `05-edit-panel-basics.png` | Edit panel open on a practice area, scrolled to the Basics section. |
| `06-edit-panel-wind.png` | Edit panel scrolled to the Wind section (with optimal direction set). |
| `07-edit-panel-samples.png` | Edit panel scrolled to the Forecast samples section, expanded. |
| `08-terrain-popover.png` | Empty-map click open, terrain popover showing elevation. |

## Capture procedure (manual)

1. `docker compose up -d` (PostGIS + Mailpit).
2. `npx prisma migrate deploy`.
3. `cp .env.example .env` and set `AUTH_SECRET=$(openssl rand -base64 32)` if not already.
4. `npm run dev`.
5. Sign in at `http://localhost:3000/login` and click the link from `http://localhost:8025`.
6. Draw one practice area and log one session experience (so the You tab has data).
7. For each shot in the table above, set the page state and use the browser's developer tools "Capture screenshot" (Cmd+Shift+P → "Capture full size screenshot" in Chrome, or the cursor-ide-browser MCP).
8. Save into this folder with the exact filename given.

## When to update

- Update a single baseline file in the **same commit** as the visible UI change that justified it. The commit message must say "**baseline updated**" so the change is searchable in the log.
- Never bulk-overwrite the whole folder.

## Why screenshots aren't auto-generated yet

A Playwright fixture that signs the user in and seeds a practice area is on the backlog (would land alongside Phase 5 — "tests catch up to the new shape"). Until then, manual capture is the realistic path because of the magic-link auth flow.
