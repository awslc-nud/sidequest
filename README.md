# SideQuest

A mobile-first mission tracker for events. Attendees complete photo "quests",
watch a chest unlock as they progress, then reveal a reward and claim a swag pass
(QR + short code) they show at the prize table. Event staff scan/verify passes in
a small marshal app.

Built as an Astro SSR app with React islands, a single-file SQLite database, and
an offline-first upload queue so flaky venue Wi-Fi doesn't lose photos.

## Features

- **Attendee flow** — snap a photo per quest, optimistic status (pending / synced
  / failed), progress bar + chest-shake feedback, and a final reveal.
- **Reward & claim** — once every quest is done the tracker flashes to `/reward`,
  shows the prize, and mints a pass with an institutional-email check.
- **Survey** — an optional keystone survey, available as a modal and as a
  standalone `/survey` page.
- **Marshal app** — shared-passphrase sign-in, then scan/redeem passes by token
  or short code.
- **Offline-first** — photos are staged in IndexedDB and retried; the server is
  the source of truth for progress.
- **Config-driven** — quests, loot, survey questions, and event branding come
  from one `event.config.json`.

## Tech stack

| Area      | Choice                                                    |
| --------- | --------------------------------------------------------- |
| Framework | Astro 7 (`output: server`, `@astrojs/node` standalone)    |
| UI        | React 19 islands, Tailwind CSS v4                         |
| Data      | Prisma 7 + `@prisma/client` over `better-sqlite3` (WAL)   |
| Client    | Dexie (IndexedDB), `qrcode`, `lucide-react`, Zod          |
| Tests     | Vitest (unit, integration, contract)                      |

## Requirements

- Node.js **>= 22.12**
- npm (a `package-lock.json` is committed)
- Optional: Docker + Docker Compose for containerized deploys
- Optional: Nix (`nix develop` / `direnv`) — the flake provides Node and the
  Prisma schema-engine binary on NixOS

## Install

```sh
git clone <repo-url> sidequest
cd sidequest
npm ci                     # or `npm install`
cp .env.example .env       # then set MARSHAL_SECRET_KEY
npm run db:generate        # generate the Prisma client
npm run db:migrate         # create/upgrade the local SQLite DB
```

`MARSHAL_SECRET_KEY` is the shared passphrase every marshal uses to sign in —
generate one with `openssl rand -base64 24`.

## Run (development)

```sh
npm run dev                # http://localhost:4321
npm run dev:lan            # bind 0.0.0.0 to test from a phone
```

Then open `http://localhost:4321/` (attendee) or `http://localhost:4321/marshal`
(staff). See `CLAUDE.md` / `AGENTS.md` for WSL2 LAN forwarding and background
dev-server tips.

## Build & run (production)

```sh
npm run build              # outputs dist/
node dist/server/entry.mjs # serves on HOST/PORT (default 0.0.0.0:4321)
```

Environment variables (see `.env.example`):

| Variable                                   | Purpose                                             |
| ------------------------------------------ | --------------------------------------------------- |
| `DATABASE_URL`                             | SQLite URL, e.g. `file:./data/sidequest.db`         |
| `SIDEQUEST_DATA_DIR`                       | Upload root; media lands in `<dir>/uploads/<slug>/` |
| `MARSHAL_SECRET_KEY`                       | Shared marshal passphrase (empty ⇒ auth fails closed) |
| `HOST` / `PORT`                            | Bind address/port for the standalone server         |
| `UPLOAD_CONCURRENCY` / `UPLOAD_QUEUE_DEPTH`| Upload admission-queue tuning                       |
| `SESSION_MAX_AGE_SECONDS`                  | Attendee/marshal cookie lifetime (default 12h)      |
| `EVENT_CONFIG_PATH`                        | Override the event config file path                 |
| `CLOUDFLARE_TUNNEL_TOKEN`                  | Optional — enables the Cloudflare Tunnel service    |

### Docker

The app ships as a container; `docker-compose.yml` runs it alongside an optional
Cloudflare Tunnel so the site can be hosted from behind CGNAT with no
port-forwarding.

```sh
cp .env.example .env       # set MARSHAL_SECRET_KEY (+ CLOUDFLARE_TUNNEL_TOKEN)
docker compose up --build -d                  # app only (LAN on :4321)
docker compose --profile tunnel up --build -d # app + cloudflared tunnel
```

The SQLite DB and uploaded media persist in the `sidequest-data` volume. For the
tunnel, point a Cloudflare Tunnel public hostname at `http://app:4321`.

A GitHub Actions workflow (`.github/workflows/docker-publish.yml`) builds and
publishes the image to `ghcr.io/<owner>/<repo>` on pushes to `main`/`master`
(PRs build without pushing).

## Configuration

Everything event-specific lives in `event.config.json`:

```jsonc
{
  "event_name": "Tech Summit 2026",
  "event_slug": "tech-summit-2026",
  "event_date": "Aug 29, 2026",          // optional header line
  "event_venue": "Main Campus",          // optional header line
  "allowed_email_domain": "school.edu.ph",
  "feedback_keystone": {
    "enabled": true,
    "questions": [
      { "id": "q1", "type": "rating_1_5", "label": "How was the event?" },
      { "id": "q2", "type": "text", "label": "Any suggestions?" }
    ]
  },
  "loot": [
    { "id": "tardigrade_pin", "label": "1x Tardigrade Pin", "qty": 1, "image": "/assets/prize.png" }
  ],
  "quests": [
    { "id": "prompt_1_arrival", "title": "Arrival Selfie", "description": "Snap yourself at the entrance banner." }
  ]
}
```

Quest and loot `id`s must be lowercase `[a-z0-9_]`. Prize/quest art lives in
`public/assets/`.

## Scripts

| Command                  | Action                                                      |
| ------------------------ | ----------------------------------------------------------- |
| `npm run dev`            | Start the dev server (`dev:bg` background, `dev:lan` on LAN)|
| `npm run build`          | Build the production server to `dist/`                      |
| `npm run preview`        | Preview the production build                                |
| `npm run typecheck`      | `astro check` (types + Astro diagnostics)                   |
| `npm test`               | Run the Vitest suite (unit + integration + contract)        |
| `npm run db:generate`    | Generate the Prisma client                                  |
| `npm run db:migrate`     | Create/apply migrations in development                      |
| `npm run db:deploy`      | Apply committed migrations (production/CI)                  |
| `npm run db:stats`       | Row counts + uploaded-media size                            |
| `npm run db:reset`       | Clear all rows and uploads (safe while the server runs)     |
| `npm run db:clear-uploads`| Delete uploaded media only                                 |
| `npm run db:reset:hard`  | Delete the DB files and re-apply migrations (stop server)   |

### Database notes

The dev database is a single SQLite file (default `data/sidequest.db`, WAL mode).
Don't `rm` it while the dev server is running — the server keeps the file open
and keeps writing to the unlinked inode. Use the `db:*` helpers instead. On NixOS
the Prisma CLI needs `PRISMA_SCHEMA_ENGINE_BINARY`, provided by `nix develop`.

## Project structure

```
src/
├── pages/            # routes + API endpoints (see below)
├── screens/          # MissionsScreen (top-level attendee composition)
├── components/
│   ├── shell/        # AppShell, header, panel, backdrop, seabed
│   ├── hero/         # mascot + chest
│   ├── missions/     # progress tracker, mission list/row
│   ├── primitives/   # IconTile, StatusIndicator, ProgressBar, MissionText
│   └── react/        # islands: capture, claim, feedback, reward, survey
├── hooks/            # useQuestTracker (session/config/progress/upload queue)
├── lib/              # config, db, progress, validation, storage, marshal
├── client/           # browser helpers (session, http, IndexedDB, upload queue)
└── styles/           # global.css + tokens.ts
prisma/               # schema + migrations
scripts/              # db helper, LAN forwarder
```

### Routes

| Path             | Purpose                                         |
| ---------------- | ----------------------------------------------- |
| `/`              | Attendee mission tracker                        |
| `/reward`        | Reward reveal + claim / survey (post-completion)|
| `/survey`        | Standalone survey form                          |
| `/marshal`       | Pass scanner/redeemer (auth required)           |
| `/marshal/auth`  | Marshal sign-in                                 |

### API

`POST /api/session`, `GET /api/config`, `GET /api/progress/:sid`,
`POST /api/upload`, `POST /api/feedback`, `POST /api/claim`,
`POST /api/marshal/redeem`. Error responses share the shape
`{ "error": { "code": "...", "message": "..." } }`.

## Documentation

| Document            | Contents                                                        |
| ------------------- | --------------------------------------------------------------- |
| `spec.md`           | Product/architecture spec: data model, API contracts, invariants|
| `ui-spec.md`        | Design system: palette tokens, layout, typography               |
| `ui-tasks.md`       | UI implementation checklist by phase                            |
| `docs/ui-build.md`  | Build notes, component inventory, and logged deviations         |
| `AGENTS.md`         | Environment/dev notes for contributors and agents               |

Astro docs: <https://docs.astro.build>. Tailwind v4: <https://tailwindcss.com>.
Prisma: <https://www.prisma.io/docs>.
