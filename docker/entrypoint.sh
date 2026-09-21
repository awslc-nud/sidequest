#!/bin/sh
# SideQuest application entrypoint.
#
# Applies pending Prisma migrations against the SQLite DB on the volume, then
# execs the Astro Node server (which becomes PID 1 and receives SIGTERM from
# `docker stop`). The Cloudflare Tunnel runs as a separate compose service.
set -u

echo "[entrypoint] applying database migrations…"
if ! npx --no-install prisma migrate deploy; then
  echo "[entrypoint] migration failed — refusing to start" >&2
  exit 1
fi

echo "[entrypoint] starting Astro server on ${HOST}:${PORT}…"
exec node dist/server/entry.mjs
