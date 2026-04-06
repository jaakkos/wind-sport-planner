# Agent instructions — Fjell Lift (wind-sport-planner)

Never mention any AI tools in the commit messages!

## What this repo is

Next.js app: magic-link auth (Auth.js), PostgreSQL + PostGIS (Prisma), MapLibre map, Open-Meteo weather, practice areas and session logging. Production is described in [`README.md`](README.md) and [`render.yaml`](render.yaml) (web service name **`fjelllift`**, Postgres **`fjelllift-frankfurt`**).

## Next.js

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Code changes

- Match existing patterns in the file you touch (imports, types, component style). Prefer small, focused diffs; no drive-by refactors or unrelated files.
- Run checks the project already uses (e.g. `npm run lint`, `npm run build`) before considering work done when you changed application code.

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

## Local development

Follow [`README.md`](README.md): `.env` from `.env.example`, Docker for Postgres + Mailpit, `npx prisma migrate deploy` (or `npm run db:dev` while iterating), `npm run dev`.

## Database

Schema and migrations live in `prisma/`. Prefer Prisma migrations for schema changes; align with how [`render.yaml`](render.yaml) runs `npx prisma migrate deploy` in `preDeployCommand`.
