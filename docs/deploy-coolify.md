# Production deploy — Coolify + GHCR (Phase 8 hybrid)

Production runs on **Coolify** against Coolify-managed **PostGIS**. Public site: **https://fjelllift.com**.

Infra/ops details (host, WireGuard, DNSimple, 1Password, cutover/rollback) live in **vamelivo-infra** (`docs/runbooks/deployment.md`, `docs/runbooks/coolify.md`). This file is the app-side contract.

## Image contract

| | |
|--|--|
| Image | `ghcr.io/jaakkos/wind-sport-planner` |
| Immutable tag | full git SHA (`${{ github.sha }}`) |
| Moving tag | `main` (convenience only — **not** for rollback) |
| Dockerfile | repo root; Next.js `output: "standalone"` |
| Entrypoint | `prisma migrate deploy` then `node server.js` |

CI on green `main` **publishes** the SHA tag (self-hosted + BuildKit). It does **not** call Coolify.

## Coolify app settings (Docker Image)

| Setting | Value |
|---------|--------|
| Source | Docker Image (not Nixpacks / not Git build) |
| Image | `ghcr.io/jaakkos/wind-sport-planner:<git-sha>` |
| Registry | GHCR (classic PAT / Coolify GHCR creds — see vamelivo-infra) |
| Health | `GET /` |
| Ports | `3000` |
| Pre-deploy | optional (entrypoint already migrates); if set, `prisma migrate deploy` |

## Required env (Coolify)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma / Postgres (`postgresql://…`) |
| `AUTH_SECRET` | Auth.js |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_URL` | `https://fjelllift.com` (no trailing slash) |
| `EMAIL_SERVER_HOST` | Platform SMTP (`172.16.1.6` on Coolify net — postfix is IPv4-only; Docker DNS AAAA-first) |
| `EMAIL_SERVER_PORT` | `587` |
| `EMAIL_SERVER_USER` | `noreply@fjelllift.com` |
| `EMAIL_SERVER_PASSWORD` | SMTP password (1Password `vamelivo-infra fjelllift SMTP`) |
| `EMAIL_FROM` | `Fjell Lift <noreply@fjelllift.com>` |

Do **not** set `RESEND_API_KEY` in production: Auth.js uses Resend whenever that key is present. Soak rollback: restore `RESEND_*` and redeploy (see vamelivo-infra `docs/runbooks/transactional-email.md`).

Optional: `NEXT_PUBLIC_MAPTILER_API_KEY`, legal `NEXT_PUBLIC_*` vars (see `.env.example`).

## Deploy flow (hybrid)

1. Push (or merge) to **`main`**.
2. CI must be green; **Publish GHCR image** job pushes `:sha` and `:main`.
3. **Gated cutover** (trusted admin / WireGuard): set Coolify image tag to that SHA → redeploy. See vamelivo-infra `docs/runbooks/deployment.md`.

Do not auto-trigger Coolify on every push until a rollback drill is recorded and policy is changed deliberately.

## Migrations / rollback

- Migrations run **forward** at container start (`prisma migrate deploy`).
- Prefer **expand/contract** migrations so an older SHA can still boot after a newer migrate.
- Rollback = redeploy previous **SHA** tag in Coolify — not `main`, and not migrate down.

## Local vs production

| | Local | Production |
|--|--------|------------|
| DB | `docker compose` PostGIS | Coolify PostGIS |
| Email | Mailpit (`EMAIL_SERVER_*`) | Platform SMTP (`EMAIL_SERVER_*` / `EMAIL_FROM`) |
| URL | `AUTH_URL=http://localhost:3000` | `AUTH_URL=https://fjelllift.com` |
| App | `npm run dev` | GHCR image via Coolify |
