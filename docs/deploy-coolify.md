# Production deploy — Coolify

Production runs on **Coolify** (Nixpacks) against Coolify-managed **PostGIS**. Public site: **https://fjelllift.com**.

Infra/ops details (host, WireGuard, DNSimple, 1Password refs) live in the **vamelivo-infra** repo. This file is the app-side contract.

## Resources (Coolify)

| Resource | Notes |
|----------|--------|
| App | `fjelllift` — Git `git@github.com:jaakkos/wind-sport-planner.git`, branch `main` |
| Database | PostGIS (`postgis/postgis:16-3.4`), db `wind_sport`, user `wind` |
| Domains | `https://fjelllift.com`, `https://www.fjelllift.com` (+ optional sslip for debugging) |

## Build / runtime commands

Coolify (Nixpacks) should use:

| Step | Command |
|------|---------|
| Install | `npm ci` |
| Build | `npm run build` |
| Pre-deploy | `npx prisma migrate deploy` |
| Start | `npm start` |
| Health | `GET /` |
| Node | `22.14.0` (`NODE_VERSION` / Nixpacks node) |

## Required env (Coolify)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma / Postgres (`postgresql://…`) |
| `AUTH_SECRET` | Auth.js |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_URL` | `https://fjelllift.com` (no trailing slash) |
| `RESEND_API_KEY` | Magic-link email |
| `RESEND_FROM` | e.g. `Fjell Lift <noreply@fjelllift.com>` |
| `NODE_VERSION` | `22.14.0` |

Optional: `NEXT_PUBLIC_MAPTILER_API_KEY`, legal `NEXT_PUBLIC_*` vars (see `.env.example`).

## Deploy flow

1. Push (or merge) to **`main`**.
2. CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) must be green before you treat a commit as shippable.
3. Coolify pulls `main` and builds (UI **Deploy**, or API `POST …/applications/<uuid>/start`).

Wire a Coolify **deploy webhook** to GitHub if you want auto-deploy after push; prefer gating on green CI (Coolify UI / GitHub status) so a red `CI` does not ship.

## Local vs production

| | Local | Production |
|--|--------|------------|
| DB | `docker compose` PostGIS | Coolify PostGIS |
| Email | Mailpit (`EMAIL_SERVER_*`) | Resend |
| URL | `AUTH_URL=http://localhost:3000` | `AUTH_URL=https://fjelllift.com` |
