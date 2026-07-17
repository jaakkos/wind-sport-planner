#!/bin/sh
set -eu
# Expand/contract migrations only — no automatic migrate down on SHA rollback.
if [ -n "${DATABASE_URL:-}" ]; then
  prisma migrate deploy
fi
exec node server.js
