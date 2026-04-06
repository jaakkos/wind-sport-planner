# Agent instructions — Fjell Lift (wind-sport-planner)

## Git commits — non-negotiable

**Do not mention AI, assistants, or AI-based dev tools anywhere in Git commit metadata.** This applies no matter who or what produced the diff. Treat it as a hard repo rule: violating it is incorrect work, not a stylistic choice.

**In scope (must stay clean):**

- Commit **subject** and **body**
- **Merge** or **squash** messages you write
- **Tags** or release notes only if they are generated from commit messages (keep source commits clean)

**Forbidden (examples, not exhaustive):** names or logos of tools (e.g. Cursor, Copilot, ChatGPT, Claude, “AI”, “LLM”), trailers such as `Made-with: …`, `Generated-by: …`, “assisted by …”, or `Co-authored-by:` lines that identify an automated assistant. If you use Git trailers, they must not attribute the change to AI.

**Do instead:** normal, factual messages — what changed and why — in the same tone as hand-written project history. No attribution of the implementation to any product or model.

## What this repo is

Next.js app: magic-link auth (Auth.js), PostgreSQL + PostGIS (Prisma), MapLibre map, Open-Meteo weather, practice areas and session logging. Production is described in [`README.md`](README.md) and [`render.yaml`](render.yaml) (web service name **`fjelllift`**, Postgres **`fjelllift-frankfurt`**).

## Next.js

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Code changes

- Match existing patterns in the file you touch (imports, types, component style). Prefer small, focused diffs; no drive-by refactors or unrelated files.
- Before finishing work that touches app or library code, run what CI runs: **`npm run lint`**, **`npm run test`**, **`npm run build`**. If you changed flows covered by E2E, run **`npm run test:e2e`** (needs local Postgres migrated and env configured; Playwright can start `next dev` itself).

## Environment & configuration

- Copy **`.env.example`** → **`.env`** (and optionally **`.env.local`**). Never commit real secrets; keep them in env files or the host’s secret store.
- **`AUTH_SECRET`**: long random string (see `.env.example`). **`AUTH_URL`**: canonical public URL with no trailing slash; wrong values break magic links and `new URL(...)` usage (see comments in `.env.example` and `src/auth.ts`).
- **Email**: local dev uses **Mailpit** (Docker) via `EMAIL_SERVER_*` when **`RESEND_API_KEY`** is unset; production/Render uses **Resend** (`RESEND_API_KEY`, `RESEND_FROM`).
- Optional: **`CRON_SECRET`** for `POST /api/cron/sync`, **`NEXT_PUBLIC_MAPTILER_API_KEY`** for MapTiler basemap, **`NEXT_PUBLIC_*`** legal contact vars on `/privacy`.

## Local services (Docker)

- **`docker compose up -d`**: **PostGIS** `postgis/postgis:16-3.4` (user/db/password align with `.env.example`: `wind` / `wind_sport`) and **Mailpit** (SMTP `1025`, UI `http://localhost:8025`).
- After schema changes: **`npm run db:dev`** (iterate) or **`npx prisma migrate deploy`** (apply existing migrations). Then **`npm run dev`** → [http://localhost:3000](http://localhost:3000).

## Repository layout

| Area | Location |
|------|----------|
| App Router pages & layouts | `src/app/` |
| Route handlers (API) | `src/app/api/**/route.ts` |
| React components | `src/components/` |
| Shared logic (weather, heuristics, map helpers, etc.) | `src/lib/` |
| Auth.js config | `src/auth.ts` |
| Prisma schema & migrations | `prisma/schema.prisma`, `prisma/migrations/` |
| Generated Prisma client | `src/generated/prisma/` (do not edit by hand) |
| Vitest tests | `tests/**/*.test.ts`, setup `tests/setup.ts` |
| Playwright E2E | `e2e/` |

Imports use the **`@/*`** alias → `src/*` (see `tsconfig.json`).

## TypeScript, ESLint, styling

- **TypeScript**: `strict` mode; prefer explicit types at boundaries (API payloads, Prisma results you reshape).
- **ESLint**: flat config in **`eslint.config.mjs`** (`eslint-config-next` core-web-vitals + TypeScript). **`npm run lint`**. Generated client under `src/generated/prisma/**` is ignored — fix issues in `prisma/schema` or app code, not generated files.
- **Tailwind CSS v4** with PostCSS; global styles in **`src/app/globals.css`**. Follow existing utility and layout patterns on nearby pages.

## npm scripts (common)

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next dev server |
| `npm run build` | `prisma generate` + `next build --webpack` (keep `--webpack` unless you intentionally migrate the build) |
| `npm run start` | Production server after build |
| `npm run lint` | ESLint |
| `npm run db:migrate` / `npm run db:dev` | Prisma migrate deploy / dev migrate |
| `npm run test` / `npm run test:watch` / `npm run test:coverage` | Vitest |
| `npm run test:e2e` | Playwright (Chromium); `playwright:install` for browsers |

## Testing

- **Vitest** (`vitest.config.mts`): Node environment, tests in **`tests/**/*.test.ts`**, **`tests/setup.ts`** resets mocks after each test. Coverage is configured for **`src/lib/**/*.ts`** — add unit tests next to new pure logic in `src/lib/` when behavior is non-trivial.
- **Playwright** (`playwright.config.ts`): specs in **`e2e/`**, loads **`.env.local`** then **`.env`**, **`E2E_PORT`** overrides port (default `3000`). CI uses **`npx next dev`** as web server; locally it can reuse an already running dev server.

## Database (Prisma)

- Edit **`prisma/schema.prisma`**; create migrations with **`npm run db:dev`** (or equivalent `prisma migrate dev`). Commit migration SQL under **`prisma/migrations/`**.
- Client output is **`src/generated/prisma`** (`generator output` in schema). **`postinstall`** runs **`prisma generate`**; **`npm run build`** also generates. Do not commit hand-edits inside `src/generated/prisma`.
- Production applies migrations in Render **`preDeployCommand`** (`npx prisma migrate deploy` in `render.yaml`) — avoid workflows that only migrate locally.

## CI and deploy gate

- **[`.github/workflows/ci.yml`](.github/workflows/ci.yml)** on push/PR to `main`/`master`: `npm ci` → Prisma migrate against service Postgres → lint → Vitest with coverage → production build → Playwright.
- Render **`autoDeployTrigger: checksPass`** waits for this workflow before deploying — a red CI blocks production deploys.

## API, auth, and server boundaries

- Prefer **Route Handlers** in `src/app/api/` for JSON APIs; validate input (e.g. **Zod**) consistently with existing routes.
- Session/auth through **Auth.js** (`src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`). Respect existing patterns for protected data (Prisma queries scoped by user where applicable).

## Maps and weather

- Map UI: **MapLibre** / **react-map-gl**, heavy UI in **`src/components/`** (e.g. map hub). Styles/helpers in **`src/lib/map/`**.
- Weather: **`src/lib/weather/`** (router, Open-Meteo, FMI stub). Keep provider boundaries clear when adding sources or debug flags.

## Debugging production / Render deployments (use MCP)

When a deploy fails, the app errors in prod, or you need build/runtime logs, **use the Render MCP** instead of guessing. Inspect tool schemas under the Render MCP server before calling tools (required parameters differ per tool).

**Typical flow**

1. **Workspace** — If needed, `list_workspaces` then `select_workspace` so subsequent calls target the right account.
2. **Service** — `list_services` (or `get_service` if you already have the service id). The blueprint web service is named **`fjelllift`**.
3. **Deploys** — `list_deploys` with `serviceId` to see recent deploys; `get_deploy` with `serviceId` + `deployId` for status, commit, and error detail.
4. **Logs** — `list_logs` requires `resource` (the **service id** string). Use `type` filters such as **`build`** (failed builds), **`app`** (runtime), or **`request`** (HTTP). Narrow with `text`, `path`, `statusCode`, or time range (`startTime` / `endTime`, RFC3339). If `hasMore` is true, paginate with the returned `nextStartTime` / `nextEndTime`.

**Also on Render**

- **Metrics** — `get_metrics` for CPU/memory/time series when the issue looks like load or limits.
- **Postgres** — `list_postgres_instances`, `get_postgres`, `query_render_postgres` when debugging DB connectivity or data in the managed instance (read carefully; avoid destructive SQL unless explicitly requested).

**Environment**

- `update_environment_variables` only when the user explicitly wants env changes on Render and the new values are agreed (document in PR/commit body, not in code comments).

Do not paste Render API keys or tokens into source files, `AGENTS.md`, or commit messages. Local MCP config stays out of git (see `.gitignore`).
