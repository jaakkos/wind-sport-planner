# Fjell Lift

**Fjell** (Scandinavian for **mountain / fell**, the terrain you ride in the north) + **lift** (what a kite does with good wind). Kite ski & surf planning with Nordic mountain energy — same app logic works anywhere.

*(Do your own trademark search before a major launch — we only checked for obvious collisions.)*

Next.js app for kite skiing and kite surfing: **magic-link email auth** (Auth.js), **PostgreSQL + PostGIS** (via Docker locally), **pluggable weather** (FMI stub + **Open-Meteo** fallback), **practice areas** you draw on a **MapLibre** map, **session experiences** you log (date, time, area, how it felt), **forecast timeline ranking** with a small boost when past “good” sessions match similar wind, and heuristic **session scoring**.

## Prerequisites

- Node.js 20+
- Docker Desktop (for local Postgres + Mailpit)

## Local setup

1. Copy environment file:

   ```bash
   cp .env.example .env
   ```

2. Set `AUTH_SECRET` (e.g. `openssl rand -base64 32`) and `DATABASE_URL` as in `.env.example`.

3. Start database and Mailpit:

   ```bash
   docker compose up -d
   ```

4. Apply migrations:

   ```bash
   npx prisma migrate deploy
   ```

   For iterative schema work use `npm run db:dev` instead.

5. Install and run:

   ```bash
   npm install
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000), sign in with email, then open **Mailpit** at [http://localhost:8025](http://localhost:8025) and click the magic link.

7. Go to `/map`, use **Draw area** to add spots, then under **Session experiences** log when you were at a spot. Rankings use Open-Meteo archive wind at the area centre for each logged time.

## Map basemaps

The map defaults to a **hybrid** raster stack: **OpenStreetMap** (detail to zoom 19) plus **OpenTopoMap** (contours, hill shading, vegetation tint; max zoom 17). Use the sidebar to switch to plain OSM, topo-only, or **Esri World Imagery** to read tree cover and clearings visually. **Click empty map** to query **elevation** (Open-Meteo) in a small panel.

Optional: set `NEXT_PUBLIC_MAPTILER_API_KEY` for **MapTiler Outdoor** (vector outdoor style). There is no numeric “forest density” grid in the app yet; topo shading and satellite imagery are the practical cues.

On `/map`, use **Draw area** to sketch kite spots; **Finish & save** stores them as practice areas. Per-area **optimal wind** and **wind sectors** are set in **Edit area** (draw direction on the map or type degrees). **Session experiences** (sidebar) record date/time, area, and how suitable conditions felt; the ranker can boost an area when the forecast wind bucket matches past sessions you rated **suitable** or **ideal** (needs at least two matching experiences for that area).

The **Forecast time** slider (hourly, up to five days ahead from a fixed “anchor” hour) refetches ranks from Open-Meteo; each area shows a **wind arrow** (shaft + head toward downwind) and a **text label** (speed, gust, direction from) at its centroid. Use **Now** to re-anchor the slider to the current hour.

**Edit areas:** click a coloured polygon or use **Edit** in the forecast list. You can change sports, label preset, wind sectors (match sidebar optimal bearing or clear), **redraw boundary**, or delete the area.

## Weather providers

- **`fmi_wfs`**: Finland bbox, stub (returns no data) — router falls through.
- **`open_meteo`**: Global historical (archive API) and forecast (forecast API).

## Cron / background sync

`POST /api/cron/sync` with header `Authorization: Bearer $CRON_SECRET` is a reserved authenticated endpoint (currently a no-op). You can still point a Render **Cron Job** at it for future scheduled tasks.

## Deploy on Render

- Create a **PostgreSQL** instance and enable extensions **postgis** and **citext** (run SQL in the Render SQL shell if needed):

  ```sql
  CREATE EXTENSION IF NOT EXISTS postgis;
  CREATE EXTENSION IF NOT EXISTS citext;
  ```

- Create a **Web Service** from this repo; see [render.yaml](./render.yaml) for a starter blueprint.
- Set env vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST=true`, email (SMTP or compatible), optional `CRON_SECRET`.
- Build: `npm ci && npm run build` (postinstall runs `prisma generate`).
- Release / shell: `npx prisma migrate deploy` before or as part of first deploy.

## API summary

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/map/bundle` | GeoJSON practice areas for active sport |
| GET/POST | `/api/practice-areas` | List / create area (`name` optional, ≤120 chars; shown on map) |
| PATCH | `/api/practice-areas/[id]` | Update `name`, `geojson`, `sports`, `labelPreset`, `windSectors`, `optimalWindFromDeg`, etc. |
| DELETE | `/api/practice-areas/[id]` | Remove area |
| GET | `/api/experiences?sport=` | List session experiences (optional sport filter) |
| POST | `/api/experiences` | Log experience: `practiceAreaId`, `sport`, `occurredAt`, `sessionSuitability` — fills archive wind at area centroid |
| DELETE | `/api/experiences/[id]` | Remove an experience |
| POST | `/api/windlog` | Structured wind log (legacy; tied to `Activity` rows) |
| GET | `/api/forecast/rank` | Rank areas for `sport` + `at`; optional `optimalWindHalfWidthDeg` (5–90) scales direction match vs each area’s saved optimal / sectors |
| GET | `/api/elevation?lat=&lng=` | Point elevation (m AMSL) via Open-Meteo |
| POST | `/api/cron/sync` | Bearer `CRON_SECRET` — reserved ping (noop) |

## Testing

The repo includes **three layers** so you can refactor dependencies and ship with confidence:

| Layer | Tool | What it covers |
|--------|------|----------------|
| **Unit** | [Vitest](https://vitest.dev/) | Pure logic: heuristics, Zod wind-log schema, FMI stub, weather router (with `fetch` mocked). |
| **Functional** | Vitest + `vi.mock` | Next **Route Handlers** (`POST /api/windlog`, `POST /api/cron/sync`) with mocked `auth` and Prisma — no running DB required for these files. |
| **End-to-end** | [Playwright](https://playwright.dev/) | Real browser against `next dev`: home page, login UI, `/map` redirect when logged out (needs `DATABASE_URL` + migrated DB for the map gate). |

### Commands

```bash
# Fast feedback (default for day-to-day / CI unit+functional)
npm run test

# Watch mode while coding
npm run test:watch

# Coverage report (HTML in ./coverage)
npm run test:coverage

# E2E — first time install browsers:
npm run playwright:install

# E2E — ensure Postgres is up and migrations applied; .env loaded via playwright.config (dotenv)
npm run test:e2e

# Everything (Vitest + Playwright)
npm run test:all
```

Config: [`vitest.config.mts`](vitest.config.mts), [`playwright.config.ts`](playwright.config.ts), specs under [`tests/`](tests/) and [`e2e/`](e2e/).

### CI & deploy

Workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on **push** / **pull_request** to `main` or `master`, and **workflow_dispatch**:

1. **PostGIS** service container  
2. `npx prisma migrate deploy`  
3. **ESLint** → **Vitest with coverage** → **production `npm run build`**  
4. **Playwright** (Chromium + system deps) against `next dev`  

Artifacts: **coverage** (HTML under `coverage/`), and **playwright-report** on E2E failure.

**Deploy (after green CI on the default branch):** add repository secret **`RENDER_DEPLOY_HOOK_URL`** with a [Render Deploy Hook](https://render.com/docs/deploy-hooks) URL (Dashboard → your Web Service → **Settings** → **Deploy Hook**). The workflow POSTs that URL so a deploy runs only if tests pass.

To avoid **two deploys** per push, either connect GitHub to Render *or* use the hook from Actions—e.g. turn off Render’s automatic deploys on commit and rely on the hook, or leave the secret unset and let Render deploy from its Git integration alone.

## Licence

MIT (add your own if you prefer). Respect [FMI open data](https://www.fmi.fi/en/open-data-manual) and [Open-Meteo](https://open-meteo.com/) terms.
