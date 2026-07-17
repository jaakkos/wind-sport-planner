# Multi-stage production image for Coolify (GHCR SHA tags).
# Build: docker buildx build --builder vamelivo -t ghcr.io/jaakkos/wind-sport-planner:<sha> .
# Runtime: DATABASE_URL + Auth/Resend env; entrypoint runs prisma migrate then Next standalone.

FROM node:22.14.0-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM node:22.14.0-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# prisma generate during build does not need a live DB (see prisma.config.ts fallback).
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
RUN npm run build

FROM node:22.14.0-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && npm install -g prisma@7.8.0 dotenv@16

# Standalone server + static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migrations + Prisma config for migrate deploy at start
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
