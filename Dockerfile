# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# SideQuest — application image (Astro Node standalone server + SQLite).
#
# This image is just the web app. Publishing it from behind CGNAT is done by
# the separate `cloudflared` service in docker-compose.yml, which forwards a
# Cloudflare Tunnel to `http://app:4321` over the compose network.
#
# Build:  docker build -t sidequest .
# Run:    docker run --env-file .env -v sidequest-data:/data -p 4321:4321 sidequest
# Or:     docker compose up --build
# ─────────────────────────────────────────────────────────────

# ── Stage 1: build ───────────────────────────────────────────
# Node 24 ships npm 11, which is what generated package-lock.json (and what
# understands the `allowScripts` field). npm 10's stricter `ci` rejects the
# npm-11 lock's optional-peer resolution, so keep the majors aligned.
FROM node:24-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 ships prebuilds, but keep a toolchain so the build never fails
# if it has to compile from source. `openssl` lets Prisma detect libssl.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Generates the Prisma client into src/lib/db/generated (bundled by Astro),
# then builds the SSR server to dist/.
RUN npx prisma generate && npm run build

# ── Stage 2: runtime ─────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    DATABASE_URL=file:/data/sidequest.db \
    SIDEQUEST_DATA_DIR=/data

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

# App runtime. node_modules is copied wholesale because it carries the Prisma
# CLI (needed by `migrate deploy`) and the SQLite query-compiler WASM.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json
COPY event.config.json ./event.config.json
COPY survey.config.json ./survey.config.json
COPY terms ./terms
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# SQLite DB + uploaded media live on one volume; the server runs unprivileged.
RUN chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /data \
 && chown -R node:node /data

USER node
VOLUME ["/data"]
EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
