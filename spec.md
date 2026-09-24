# SideQuest — Technical Specification (v1 / MVP)

**Target Stack:** Astro (SSR, Node adapter) · SQLite (WAL) via **Prisma ORM** · Tailwind CSS
**Author:** Principal Architecture Spec
**Status:** Implementation-ready
**Companion doc:** `SideQuest_PRD_V2.md`

---

## Table of Contents

1. System Architecture
2. Data Layer
3. API Contracts
4. Core Business Logic & Algorithms
5. Verification Strategy

---

## 1. System Architecture

### 1.1 Architecture Overview

SideQuest is a single-process, single-node deployment: one Astro SSR server (Node adapter) backed by one SQLite file on local disk, running in a Docker container on consumer hardware, exposed via a Cloudflare Tunnel. There is no external database, no object storage, no message queue, and no server-side image processing — these are explicit non-goals from the PRD.

Three logical actors talk to the same server:

- **Attendee client** (mobile browser) — stages photos locally, syncs via a serial upload worker, and requests claim passes.
- **Marshal client** (mobile browser, cookie-authenticated via a shared passphrase) — scans/validates claim tokens.
- **Media Lead** — does not use the web app; reads directly from the mounted filesystem volume.

There are two distinct things called "queue" in this system, and they solve different problems — this is easy to conflate, so it's called out explicitly here and again in §1.1.1 and §4.2:

- A **client-side retry list** (per device, in IndexedDB) that re-sends *that attendee's* photos if their connection drops.
- A **server-side Upload Admission Queue** (§1.1.1, §4.2) that caps how many uploads the host processes at once, protecting a single consumer PC from being overwhelmed when, say, 50 attendees all photograph the speaker within the same few seconds.

```mermaid
graph TD
    subgraph "Attendee Device (Browser)"
        A1[Camera Capture] --> A2[In-Memory Review<br/>Retake / Confirm]
        A2 -->|Confirm| A3[Canvas Compressor<br/>resize <=1920px, WebP q0.82-0.85]
        A3 --> A4[(IndexedDB<br/>photo blobs + retry list)]
        A4 --> A5[Serial Upload Worker<br/>concurrency=1 per device, jittered start + backoff]
        A2 -.Retake.->|discard, no I/O| X((wiped))
        A6[Progress / Chest UI] <--> A4
        A7[Claim Modal] --> A8[Claim QR + 4-char code]
    end

    subgraph "Marshal Device (Browser)"
        M1[/marshal/auth - shared passphrase/] --> M2[Camera Scanner]
        M2 --> M3[Manual Fallback Keypad]
    end

    subgraph "SideQuest Server (Astro SSR, Node adapter, single container)"
        AQ{{Upload Admission Queue<br/>bounded concurrency, protects host I/O}}
        API1[POST /api/session]
        API2[POST /api/upload]
        API3[GET /api/progress/:sid]
        API4[POST /api/claim]
        API5[POST /api/marshal/redeem]
        API6[GET /api/config]
        MW[Marshal Auth Middleware]
        CFG[event.config.json loader]
        PRISMA[Prisma Client]
    end

    subgraph "Host Filesystem (single volume)"
        FS[/data/uploads/&lt;event-slug&gt;/&lt;prompt-id&gt;/*.webp/]
        DBFILE[(data/sidequest.db)]
    end

    A5 -->|multipart POST, 1 in flight per device| API2
    A7 --> API4
    A6 -->|poll every N s| API3
    M2 --> API5
    M3 --> API5
    M1 --> MW --> API5

    API2 --> AQ
    AQ -->|admitted, bounded concurrency| FS
    AQ -->|admitted, bounded concurrency| PRISMA
    PRISMA --> DBFILE
    API3 --> PRISMA
    API4 --> PRISMA
    API5 --> PRISMA
    API6 --> CFG

    style FS fill:#f5deb3
    style DBFILE fill:#d0e8ff
    style AQ fill:#ffd6d6
```

**Key architectural decisions:**

| Decision | Rationale |
|---|---|
| Astro SSR (Node standalone adapter) instead of static | Server must own SQLite writes, filesystem writes, and marshal-cookie auth — none of which are compatible with static output. |
| SQLite with `WAL` + `busy_timeout` | Single-writer host, bursty concurrent writes at event peak; WAL avoids reader/writer lockouts, `busy_timeout` queues rather than fails a second writer. |
| **Prisma ORM** | Developer preference, and there's no real cost here for this app's scale: Prisma's `updateMany()` still returns a row-affected `count`, which is all the atomic-redemption logic in §4.7 needs — the race-condition guarantee is a property of SQLite's single-writer serialization, not of which client library issues the SQL. The only trade-off worth naming: Prisma's query engine adds a small native binary and a bit of cold-start overhead versus a zero-dependency driver, which is irrelevant at event scale. |
| No image library on server | Explicit non-goal. Server treats uploaded WebP bytes as an opaque blob and streams them to disk. |
| Config-driven event definition | One JSON file (`event.config.json`) defines quests, loot, domain, and feedback toggle — no admin UI needed for v1. |
| Anonymous session via signed cookie | No accounts. Session ID is a UUIDv4 minted server-side on first visit, stored in an httpOnly cookie AND mirrored into IndexedDB as a client-side fallback key. |
| **Single `data/` volume for DB + uploads** | Simpler ops (one bind mount, one backup target). No real downside: the media lead is never handed the raw `data/` directory — they're pointed at `data/uploads/<event-slug>/` specifically, so the `.db` file is never in their way. |
| **Server-side Upload Admission Queue** | A single-machine host has finite disk and upload bandwidth. Fifty attendees uploading the instant a "photograph the speaker" quest goes live is expected peak load, not an edge case — the server needs its own bounded concurrency, independent of each client's own per-device concurrency-of-1. |

### 1.1.1 Why two different "queues" exist

| | **Client retry list** (`IndexedDB.photos`) | **Server Upload Admission Queue** |
|---|---|---|
| Lives where | One attendee's browser | The Node process |
| Protects against | That one attendee's flaky cellular connection | The shared host's disk I/O / bandwidth being overwhelmed by *many* attendees at once |
| Scope | Per-device | Global, across all attendees |
| Mechanism | Serial worker (concurrency 1), exponential backoff + jitter on failure | Bounded semaphore (e.g. 4 concurrent uploads processed at a time), FIFO wait, `429` fast-reject past a depth cap |

Both are needed. The client-side one alone does **not** solve the "everyone photographs the speaker at once" scenario: 50 devices each running "concurrency 1" still means up to 50 simultaneous requests hitting the server. The Admission Queue is the piece that caps how many of those the host actually processes at once. Full implementation in §4.2.

### 1.2 Directory Layout

```
sidequest/
├── astro.config.mjs
├── package.json
├── tailwind.config.mjs
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── event.config.json                  # Master JSON Configuration Engine (§2.3)
│
├── prisma/
│   ├── schema.prisma                  # single source of truth for DB schema (§2.2)
│   └── migrations/
│       └── 0001_init/migration.sql    # generated by `prisma migrate dev`
│
├── data/                               # single bind-mounted volume
│   ├── sidequest.db                    # SQLite file (WAL + shm/wal sidecars live here too)
│   └── uploads/
│       └── <event-slug>/
│           ├── prompt_1_arrival/
│           ├── prompt_2_stage/
│           └── ...
│
├── src/
│   ├── env.d.ts
│   ├── middleware.ts                   # marshal-auth guard, session-cookie mint
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   └── prismaClient.ts         # PrismaClient singleton + PRAGMA setup on connect
│   │   ├── config/
│   │   │   ├── loadEventConfig.ts      # parses + Zod-validates event.config.json
│   │   │   └── schema.ts               # Zod schema for config
│   │   ├── validation/
│   │   │   ├── email.ts                # domain regex + normalization
│   │   │   └── payloads.ts             # Zod schemas for all API bodies
│   │   ├── storage/
│   │   │   └── writeUpload.ts          # streaming filesystem writer
│   │   ├── uploadAdmission/
│   │   │   └── admissionQueue.ts       # server-side bounded-concurrency semaphore (§4.2)
│   │   ├── tokens/
│   │   │   └── claimToken.ts           # claim_token + 4-char shortcode generation
│   │   └── progress/
│   │       └── computeProgress.ts      # K/N math incl. feedback keystone
│   │
│   ├── pages/
│   │   ├── index.astro                 # attendee landing (chest + quest cards)
│   │   ├── marshal/
│   │   │   ├── auth.astro              # passphrase entry (§3.8)
│   │   │   └── index.astro             # /marshal scanner UI
│   │   └── api/
│   │       ├── config.ts               # GET /api/config
│   │       ├── session.ts              # POST /api/session
│   │       ├── upload.ts               # POST /api/upload
│   │       ├── progress/[sid].ts       # GET /api/progress/:sid
│   │       ├── claim.ts                # POST /api/claim
│   │       ├── feedback.ts             # POST /api/feedback
│   │       └── marshal/
│   │           └── redeem.ts           # POST /api/marshal/redeem
│   │
│   ├── components/
│   │   ├── Chest.tsx                   # CSS spring/rattle/burst FX
│   │   ├── QuestCard.tsx
│   │   ├── CameraCapture.tsx           # getUserMedia + <video>/<canvas>
│   │   ├── ReviewOverlay.tsx           # in-memory Retake/Confirm screen
│   │   ├── ClaimModal.tsx
│   │   ├── ClaimPass.tsx               # QR + 4-char fallback render
│   │   └── MarshalScanner.tsx
│   │
│   ├── client/
│   │   ├── canvasCompress.ts           # resize + WebP encode (runs in-browser)
│   │   ├── db/
│   │   │   └── indexedDb.ts            # photos + local UI cache
│   │   ├── uploadQueue.ts              # client-side serial retry worker (§4.1/§4.2a)
│   │   └── session.ts                  # session id read/mint, localStorage mirror
│   │
│   └── styles/
│       └── global.css                  # Tailwind entry + chest keyframes
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 2. Data Layer

### 2.1 Design Notes

- Timestamps are stored as **Unix epoch milliseconds (`Int`/`BigInt`)** for unambiguous ordering and cheap arithmetic (no timezone parsing at query time).
- `event_slug` partitions every table so a single DB file can, in principle, serve multiple events sequentially without collisions, even though v1 runs one event at a time.
- No table stores raw photo bytes — only file paths and metadata. The bytes live under `data/uploads/` per the non-goal "no server-side image processing," and to keep the DB small and WAL-friendly.
- **File size ceiling:** the target compression band stays **250–400KB** (unchanged from the PRD's stated target), but the **hard reject ceiling is 2MB**, not 500KB. 500KB as a hard cutoff was too tight given real-world variance in lighting/entropy across phone cameras — 2MB gives the client's quality-stepping loop real room to converge before giving up, while still catching genuinely broken output (a compression bug producing a multi-megabyte "WebP" is not normal variance and is still worth rejecting before it lands on a consumer host's disk).

### 2.2 Prisma Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL") // e.g. "file:../data/sidequest.db"
}

// ─────────────────────────────────────────────────────────────
// SESSIONS: one row per anonymous attendee session
// ─────────────────────────────────────────────────────────────
model Session {
  id            String    @id @default(uuid())
  eventSlug     String    @map("event_slug")
  createdAt     BigInt    @map("created_at")
  lastSeenAt    BigInt    @map("last_seen_at")
  feedbackDone  Boolean   @default(false) @map("feedback_done")
  unlockedAt    BigInt?   @map("unlocked_at")   // set when chest opens (NULL until N/N)

  submissions   Submission[]
  claim         Claim?
  feedback      FeedbackResponse?

  @@index([eventSlug])
  @@map("sessions")
}

// ─────────────────────────────────────────────────────────────
// SUBMISSIONS: one row per accepted photo mission upload
// ─────────────────────────────────────────────────────────────
model Submission {
  id               Int      @id @default(autoincrement())
  sessionId        String   @map("session_id")
  session          Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  eventSlug        String   @map("event_slug")
  promptId         String   @map("prompt_id")           // e.g. "prompt_2_stage"
  clientCaptureId  String   @map("client_capture_id")   // UUID minted client-side; idempotent retry key
  filePath         String   @map("file_path")           // relative path under data/uploads/
  fileSizeBytes    Int      @map("file_size_bytes")      // 1..2_000_000
  receivedAt       BigInt   @map("received_at")

  @@unique([sessionId, promptId])         // one accepted submission per mission
  @@unique([sessionId, clientCaptureId])  // idempotent retry — re-POST of same capture never double-inserts
  @@index([sessionId])
  @@index([eventSlug, promptId])
  @@map("submissions")
}

// ─────────────────────────────────────────────────────────────
// CLAIMS: one row per minted swag pass (email <-> token)
// ─────────────────────────────────────────────────────────────
model Claim {
  id                 Int      @id @default(autoincrement())
  eventSlug          String   @map("event_slug")
  sessionId          String   @unique @map("session_id")   // one claim per session
  session            Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  studentEmail       String   @map("student_email")         // normalized lowercase
  claimToken         String   @unique @map("claim_token")   // UUIDv4, encoded into QR
  shortCode          String   @map("short_code")            // 4-char alphanumeric fallback
  lootSnapshot       String   @map("loot_snapshot")         // JSON string, loot at mint time
  isClaimed          Boolean  @default(false) @map("is_claimed")
  claimedAt          BigInt?  @map("claimed_at")            // set atomically on redemption
  claimedByMarshal   String?  @map("claimed_by_marshal")    // generic label only — no real marshal identity exists (§3.8)
  createdAt          BigInt   @map("created_at")

  @@unique([eventSlug, studentEmail])   // hard "one redemption per institutional email" rule
  @@unique([eventSlug, shortCode])
  @@index([claimToken])
  @@map("claims")
}

// ─────────────────────────────────────────────────────────────
// FEEDBACK: optional keystone survey responses
// ─────────────────────────────────────────────────────────────
model FeedbackResponse {
  id            Int      @id @default(autoincrement())
  sessionId     String   @unique @map("session_id")
  session       Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  eventSlug     String   @map("event_slug")
  answersJson   String   @map("answers_json")   // free-form JSON blob, shape defined by config
  submittedAt   BigInt   @map("submitted_at")

  @@map("feedback_responses")
}

// ─────────────────────────────────────────────────────────────
// MARSHAL_SESSIONS: shared-passphrase auth cookie -> validity window
// ─────────────────────────────────────────────────────────────
model MarshalSession {
  token       String   @id                       // random 32-byte hex, stored in httpOnly cookie
  createdAt   BigInt   @map("created_at")
  expiresAt   BigInt   @map("expires_at")
  label       String?                            // optional human label, e.g. "North Gate table"

  @@index([expiresAt])
  @@map("marshal_sessions")
}
```

Prisma doesn't set SQLite `PRAGMA`s itself, so connection-time setup lives in the client singleton:

```typescript
// src/lib/db/prismaClient.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Run once at process startup, before serving traffic
await prisma.$executeRawUnsafe("PRAGMA journal_mode = WAL;");
await prisma.$executeRawUnsafe("PRAGMA busy_timeout = 5000;");
await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON;");

export default prisma;
```

### 2.3 Master JSON Configuration Engine (`event.config.json`)

Loaded once at server boot (hot-reloadable via file-watch in dev) and validated with a Zod schema before the server accepts traffic.

```json
{
  "event_name": "Tech Summit 2026",
  "event_slug": "tech-summit-2026",
  "allowed_email_domain": "school.edu.ph",
  "feedback_keystone": {
    "enabled": true,
    "questions": [
      { "id": "q1", "type": "rating_1_4", "label": "How was the event?" },
      { "id": "q2", "type": "text", "label": "Any suggestions?" }
    ]
  },
  "loot": [
    { "id": "sticker_pack", "label": "1x Sticker Pack", "qty": 1 },
    { "id": "tardigrade_pin", "label": "1x Tardigrade Pin", "qty": 1 }
  ],
  "quests": [
    { "id": "prompt_1_arrival", "title": "Arrival Selfie", "description": "Snap yourself at the entrance banner." },
    { "id": "prompt_2_stage", "title": "Stage Slide", "description": "Photograph the current speaker's slide." },
    { "id": "prompt_3_booth", "title": "Sponsor Booth", "description": "Capture a sponsor booth in action." }
  ]
}
```

Zod schema (`src/lib/config/schema.ts`):

```typescript
import { z } from "zod";

export const QuestSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  title: z.string().min(1),
  description: z.string().min(1),
});

export const LootItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string().min(1),
  qty: z.number().int().positive(),
});

export const FeedbackQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(["rating_1_4", "text", "boolean"]),
  label: z.string(),
});

export const EventConfigSchema = z.object({
  event_name: z.string().min(1),
  event_slug: z.string().regex(/^[a-z0-9-]+$/),
  allowed_email_domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i),
  feedback_keystone: z.object({
    enabled: z.boolean(),
    questions: z.array(FeedbackQuestionSchema),
  }),
  loot: z.array(LootItemSchema).min(1),
  quests: z.array(QuestSchema).min(1),
});

export type EventConfig = z.infer<typeof EventConfigSchema>;
```

**Derived value — Total Task Count (N):**
`N = quests.length + (feedback_keystone.enabled ? 1 : 0)`
Computed fresh on every progress request directly from the loaded config, never stored, so config edits between deploys can't desync a stored total (see §4.4).

### 2.4 Client-Side State (IndexedDB) — Schema & Validation

Two IndexedDB object stores under database `sidequest-client`:

```typescript
// src/client/db/indexedDb.ts

interface PhotoRecord {
  clientCaptureId: string;     // UUIDv4, primary key
  promptId: string;
  blob: Blob;                  // compressed WebP, <=2MB hard ceiling
  sizeBytes: number;
  capturedAt: number;          // epoch ms
  status: "pending" | "uploading" | "synced" | "failed";
  attempts: number;
  lastAttemptAt: number | null;
}

// This is a cached read for instant UI rendering ("Syncing 2 photos...") —
// it is NOT a work queue. The actual retry ordering is derived live from
// `photos.status` on each worker tick (§4.1/§4.2a). This table just avoids
// recomputing a COUNT() on every render. The thing that behaves like a
// traffic-shaping "queue" for burst protection lives on the server (§4.2b),
// not here.
interface LocalUiCache {
  key: "uiCache";               // singleton row
  sessionId: string;
  pendingCountCached: number;   // derived; refreshed after every photos.put()/delete()
}

// Dexie schema version 1
db.version(1).stores({
  photos: "clientCaptureId, promptId, status",
  uiCache: "key",
});
```

**Client-side validation rules (enforced before any IndexedDB write):**

1. `blob.size <= 2_000_000` (2MB hard ceiling) — if exceeded after compression at floor quality, the client has already stepped quality down as far as it will go (see §4.1); reject the capture and prompt retake.
2. `blob.type === "image/webp"`.
3. Exactly one `PhotoRecord` may exist per `promptId` per session — a re-confirm for an already-completed prompt **replaces** (delete + insert) rather than appending, mirrored server-side by `@@unique([sessionId, promptId])`.
4. `status` transitions are one-directional except retry: `pending → uploading → synced`, or `uploading → failed → pending` (retry), never `synced → *`.

### 2.5 State Management Approach (Client)

State is split across three tiers:

| Tier | Store | Lifetime | Contents |
|---|---|---|---|
| Ephemeral (RAM) | React component state | Single capture, discarded on Retake or after Confirm | Raw camera frame, in-progress canvas buffer |
| Durable client | IndexedDB (`photos`, `uiCache`) | Survives tab close / reboot | Compressed WebP blobs, upload status, session id mirror |
| Durable server | SQLite (via Prisma) | Permanent (event lifetime) | Canonical submission/claim/session records |

**Reconciliation on load (`GET /api/progress/:sid`):** the client always treats the **server's submission list as canonical** for the completed/K count shown in the UI, and uses local IndexedDB only to (a) resume the upload queue and (b) render optimistic thumbnails before server ack. This avoids drift if a user resumes on a different device/tab where IndexedDB is empty but the server already has their uploads (covers the "Accidental Tab Closure" edge case in PRD §4.1).

---

## 3. API Contracts

All endpoints return `application/json` except where noted. All error responses share this shape:

```json
{ "error": { "code": "STRING_ERROR_CODE", "message": "Human readable message" } }
```

### 3.1 `GET /api/config`

Returns the public subset of the event config needed to render the attendee UI (no secrets).

- **Response `200`:**
```json
{
  "event_name": "Tech Summit 2026",
  "event_slug": "tech-summit-2026",
  "allowed_email_domain": "school.edu.ph",
  "quests": [
    { "id": "prompt_1_arrival", "title": "Arrival Selfie", "description": "..." }
  ],
  "feedback_keystone": { "enabled": true, "questions": [ ] },
  "total_tasks": 4
}
```
- **Errors:** `500 CONFIG_LOAD_FAILED` if `event.config.json` fails schema validation at boot (server should refuse to start in this case; this response path is a defensive fallback only).

---

### 3.2 `POST /api/session`

Mints (or returns existing) anonymous session. Idempotent: if the request carries a valid `sq_session` cookie referencing an existing row, that same session is returned.

**Request body:** none required.

```json
{ "type": "object", "properties": {}, "additionalProperties": false }
```

- **Response `201` (new session):**
```json
{ "session_id": "b3f1...uuid", "created": true }
```
- **Response `200` (existing session resumed):**
```json
{ "session_id": "b3f1...uuid", "created": false }
```
- Sets `Set-Cookie: sq_session=<id>; HttpOnly; Secure; SameSite=Lax; Max-Age=<event duration>`.

---

### 3.3 `POST /api/upload`

Accepts a single confirmed photo. `multipart/form-data`.

**Form fields:**

| Field | Type | Constraints |
|---|---|---|
| `session_id` | string | must match cookie session; UUIDv4 |
| `prompt_id` | string | must exist in loaded config `quests[].id` |
| `client_capture_id` | string | UUIDv4, used for idempotent retry dedup |
| `file` | binary | `image/webp`, **≤ 2MB** |

**JSON Schema equivalent (for the parsed multipart fields):**
```json
{
  "type": "object",
  "required": ["session_id", "prompt_id", "client_capture_id", "file"],
  "properties": {
    "session_id": { "type": "string", "format": "uuid" },
    "prompt_id": { "type": "string", "pattern": "^[a-z0-9_]+$" },
    "client_capture_id": { "type": "string", "format": "uuid" },
    "file": { "type": "string", "contentEncoding": "binary", "contentMediaType": "image/webp" }
  }
}
```

- **Response `201`:**
```json
{
  "accepted": true,
  "prompt_id": "prompt_2_stage",
  "progress": { "completed": 2, "total": 4 },
  "chest_unlocked": false
}
```
- **Response `200`** (idempotent replay — same `client_capture_id` already recorded): identical body to `201`, signals client to mark local record `synced` without erroring.
- **Errors:**
  - `400 INVALID_PROMPT_ID` — prompt not found in config.
  - `400 FILE_TOO_LARGE` — file exceeds 2MB.
  - `400 INVALID_CONTENT_TYPE` — not `image/webp`.
  - `403 SESSION_MISMATCH` — `session_id` in body doesn't match the authenticated cookie session.
  - `404 SESSION_NOT_FOUND` — session_id has no corresponding row.
  - `409 CHEST_ALREADY_UNLOCKED` — session already reached `unlockedAt`; quest cards are read-only (AC-03).
  - `413 PAYLOAD_TOO_LARGE` — request body exceeds server-configured multipart limit (defense in depth alongside `400`).
  - **`429 SERVER_BUSY`** — the Upload Admission Queue's wait list is already at its depth cap (§4.2). Response includes a `Retry-After` header (seconds):
    ```json
    { "error": { "code": "SERVER_BUSY", "message": "Server is processing a burst of uploads, please retry shortly" } }
    ```
    The client's existing jittered-backoff retry logic (§4.1/§4.2a) treats this identically to a network failure and honors `Retry-After` when present.
  - `500 STORAGE_WRITE_FAILED` — disk write failed (rolled back; no DB row committed — see §4.3).

---

### 3.4 `GET /api/progress/:sid`

Polled by the client UI (interval-based; WebSocket is v2).

- **Response `200`:**
```json
{
  "session_id": "b3f1...uuid",
  "completed_prompt_ids": ["prompt_1_arrival", "prompt_2_stage"],
  "feedback_done": false,
  "completed": 2,
  "total": 4,
  "chest_unlocked": false,
  "unlocked_at": null,
  "claim": null
}
```
  When a claim already exists for the session:
```json
"claim": {
  "claim_token": "c7a2...",
  "short_code": "K4T9",
  "is_claimed": true,
  "claimed_at": 1782000000000
}
```
- **Errors:** `404 SESSION_NOT_FOUND`.

---

### 3.5 `POST /api/feedback`

Submits the keystone survey. Only accepted once feedback is enabled in config and all photo prompts are complete (server re-validates; client should already gate this).

**Request:**
```json
{
  "session_id": "b3f1...uuid",
  "answers": { "q1": 5, "q2": "Great event, more snacks please." }
}
```
- **Response `200`:**
```json
{ "accepted": true, "progress": { "completed": 4, "total": 4 }, "chest_unlocked": true }
```
- **Errors:**
  - `400 FEEDBACK_DISABLED` — config has `feedback_keystone.enabled = false`.
  - `400 PROMPTS_INCOMPLETE` — not all photo quests are done yet.
  - `409 FEEDBACK_ALREADY_SUBMITTED`.
  - `404 SESSION_NOT_FOUND`.

---

### 3.6 `POST /api/claim`

Mints the swag pass. Only valid once `chest_unlocked = true` for the session.

**Request:**
```json
{ "session_id": "b3f1...uuid", "student_email": "Student.Name@School.EDU.PH" }
```
- **Response `201`:**
```json
{
  "claim_token": "c7a2...uuid",
  "short_code": "K4T9",
  "student_email": "student.name@school.edu.ph",
  "loot": [
    { "id": "sticker_pack", "label": "1x Sticker Pack", "qty": 1 }
  ]
}
```
- **Errors:**
  - `400 CHEST_NOT_UNLOCKED` — attempted claim before N/N complete (AC-03 gate).
  - `422 INVALID_EMAIL_SYNTAX` — fails RFC-lite regex.
  - `422 EMAIL_DOMAIN_MISMATCH` — domain ≠ `allowed_email_domain` (AC-04).
  - `409 EMAIL_ALREADY_CLAIMED` — `@@unique([eventSlug, studentEmail])` violated; response includes no PII beyond echoing the rejected email.
  - `409 SESSION_ALREADY_CLAIMED` — this session already minted a different pass (`@@unique([sessionId])` on `Claim`).
  - `404 SESSION_NOT_FOUND`.

---

### 3.7 `POST /api/marshal/redeem`

Requires a valid marshal cookie (see §3.8/middleware). Body accepts either a scanned token or a manually typed short code — exactly one must be present.

**Request:**
```json
{ "claim_token": "c7a2...uuid" }
```
_or_
```json
{ "short_code": "K4T9" }
```
- **Response `200` (success):**
```json
{
  "status": "claimed",
  "student_email": "student.name@school.edu.ph",
  "loot": [ { "id": "sticker_pack", "label": "1x Sticker Pack", "qty": 1 } ],
  "claimed_at": 1782000000123
}
```
- **Response `409` (already claimed — the core anti-double-dispense path, AC-05):**
```json
{
  "error": {
    "code": "ALREADY_CLAIMED",
    "message": "ALREADY CLAIMED at 2026-09-07T14:32:11Z",
    "claimed_at": 1782000000123
  }
}
```
- **Errors:**
  - `400 MISSING_TOKEN` — neither `claim_token` nor `short_code` supplied, or both supplied.
  - `401 MARSHAL_UNAUTHENTICATED` — missing/expired marshal cookie.
  - `404 TOKEN_NOT_FOUND` — token/code doesn't match any claim row.

---

### 3.8 Marshal Authentication — `POST /marshal/auth`

This is a **single shared static passphrase**, not per-marshal accounts — there is no marshal identity in this system, consistent with the PRD's "no user accounts" non-goal.

- One secret lives in `.env` as `MARSHAL_SECRET_KEY` (a random 20+ character string generated once before the event and shared verbally with volunteers, or written on a card at the exit table).
- **Every marshal uses the same key.** There is no way to tell which volunteer redeemed which claim beyond the optional generic `claimedByMarshal` label — not a real identity, since none exists.
- Flow:
  1. Marshal opens `/marshal/auth` on their phone and sees a simple passphrase input field.
  2. The form `POST`s the passphrase in the request body — **not** as a `?key=` URL query param. A GET query param would get written into browser history and, if the tunnel/host logs request URLs, into server logs — an avoidable leak of the one secret gating swag distribution. Functionally this is identical to what the PRD describes; only the transport of the key changes.
  3. Server does a constant-time comparison of the submitted value against `process.env.MARSHAL_SECRET_KEY`.
  4. On match: insert a row into `marshal_sessions` with a random 32-byte token, `Set-Cookie: sq_marshal=<token>; HttpOnly; Secure; SameSite=Strict; Max-Age=<remaining event time>`, redirect (`302`) to `/marshal`.
  5. On mismatch: re-render the form with an inline error, `403`, no cookie set. (Recommended: rate-limit repeated attempts per IP, since a short/memorable passphrase is otherwise brute-forceable.)
- `src/middleware.ts` guards every `/marshal/*` page and `/api/marshal/*` route by checking `sq_marshal` against `marshal_sessions` (token exists AND `expiresAt > now`).

---

## 4. Core Business Logic & Algorithms

### 4.1 Staged Review → Compress → Stage Locally (Client, AC-01 / AC-02)

```
FUNCTION onCaptureConfirmed(rawFrame, promptId):
    # Runs entirely in-memory until this point (AC-01)
    canvas   = drawToCanvas(rawFrame)
    resized  = resizeLongEdge(canvas, maxPx = 1920)     # no-op if already <=1920
    quality  = 0.85
    blob     = encodeWebP(resized, quality)

    # Step down in modest increments; the 2MB ceiling gives real headroom
    # versus a tight 500KB cutoff, so we rarely need to drop quality far.
    WHILE blob.size > 2_000_000 AND quality > 0.50:
        quality -= 0.05
        blob = encodeWebP(resized, quality)

    IF blob.size > 2_000_000:
        SHOW_ERROR("Image too large, please retake in better lighting")
        RETURN   # nothing written to IndexedDB, nothing queued

    # Soft telemetry only (not a rejection) if well above the target band —
    # helps flag unusual source images without blocking the attendee.
    IF blob.size > 500_000:
        LOG_CLIENT_METRIC("upload_above_target_band", blob.size)

    captureId = uuidv4()
    photoRecord = {
        clientCaptureId: captureId,
        promptId: promptId,
        blob: blob,
        sizeBytes: blob.size,
        capturedAt: now(),
        status: "pending",
        attempts: 0,
        lastAttemptAt: null
    }

    # Replace-not-append: enforce one photo per prompt locally
    existing = IndexedDB.photos.get({promptId})
    IF existing EXISTS:
        IndexedDB.photos.delete(existing.clientCaptureId)

    IndexedDB.photos.put(photoRecord)
    IndexedDB.uiCache.put({
        key: "uiCache", sessionId: getSessionId(),
        pendingCountCached: IndexedDB.photos.where(status IN ["pending","uploading","failed"]).count()
    })

    # Optimistic UI (server has not acknowledged yet)
    UI.markQuestCard(promptId, state = "COMPLETE_PENDING_SYNC")
    UI.playChestRattleAnimation()

    UploadQueue.wake()   # nudge the serial worker
```

### 4.2 Two Independent Concurrency Controls

There are two separate mechanisms in this system, one per device and one on the server, and both are necessary — this section is the direct answer to "how do we stop 50 simultaneous uploads from overwhelming the host."

#### 4.2(a) Client-side serial retry worker

Runs per device, concurrency hard-capped at 1 (PRD §"Journey 1" step 5), with a randomized initial delay before each device's *first* attempt so that many devices finishing compression at nearly the same instant (e.g. right after a "photograph the speaker" prompt appears) don't all fire their first request in the same 100ms window.

```
STATE: isRunning = false

FUNCTION UploadQueue.wake():
    IF isRunning: RETURN
    isRunning = true
    RUN_ASYNC(processLoop)

FUNCTION processLoop():
    WHILE true:
        record = IndexedDB.photos
                     .where(status IN ["pending", "failed"])
                     .orderBy(capturedAt)
                     .first()
        IF record IS NULL:
            isRunning = false
            RETURN

        IF NOT navigator.onLine:
            SLEEP(2000)
            CONTINUE

        IF record.attempts == 0:
            SLEEP(randomJitter(0, 3000))   # spread the initial burst across ~3s per device

        record.status = "uploading"
        IndexedDB.photos.put(record)

        TRY:
            response = httpPostMultipart("/api/upload", {
                session_id: getSessionId(),
                prompt_id: record.promptId,
                client_capture_id: record.clientCaptureId,
                file: record.blob
            })

            IF response.status IN [200, 201]:
                record.status = "synced"
                IndexedDB.photos.put(record)
                UI.markQuestCard(record.promptId, "COMPLETE")
                UI.refreshProgressFromServer(response.body.progress)
                IF response.body.chest_unlocked:
                    UI.triggerChestBurst()

            ELSE IF response.status == 409 AND response.body.error.code == "CHEST_ALREADY_UNLOCKED":
                # Server is canonical; treat as terminal success (nothing more to send)
                record.status = "synced"
                IndexedDB.photos.put(record)

            ELSE:
                RAISE UploadError(response.status, response.headers["Retry-After"])

        CATCH (NetworkError OR UploadError) AS e:
            record.attempts += 1
            record.lastAttemptAt = now()
            record.status = "failed"
            IndexedDB.photos.put(record)

            # Honor a server-provided Retry-After (e.g. from a 429 SERVER_BUSY)
            # if present, otherwise fall back to our own exponential backoff.
            backoffMs = e.retryAfterSeconds
                ? e.retryAfterSeconds * 1000 + randomJitter(0, 500)
                : MIN(30000, 1000 * (2 ** record.attempts)) + randomJitter(0, 500)
            SLEEP(backoffMs)
            # loop continues; same record retried since status is "failed"
```

#### 4.2(b) Server-side Upload Admission Queue

This is the piece that actually protects the host. It sits in front of the expensive part of `/api/upload` — the disk write plus the database write — and caps how many requests, *across all attendees combined*, are doing that work at the same time.

```
# src/lib/uploadAdmission/admissionQueue.ts

GLOBAL: MAX_CONCURRENT_UPLOADS = env.UPLOAD_CONCURRENCY ?? 4   # tune to the host's real disk/upload bandwidth
GLOBAL: MAX_QUEUE_DEPTH        = env.UPLOAD_QUEUE_DEPTH ?? 40  # beyond this, fail fast rather than pile up requests
GLOBAL: activeCount = 0
GLOBAL: waiters = FIFO<resolve fn>

FUNCTION tryEnqueue():
    IF activeCount < MAX_CONCURRENT_UPLOADS:
        activeCount += 1
        RETURN { admitted: true }

    IF waiters.length >= MAX_QUEUE_DEPTH:
        RETURN { admitted: false }   # caller returns 429 immediately, no long hold-open

    RETURN new Promise(resolve => {
        waiters.push(resolve)
    }).then(() => ({ admitted: true }))

FUNCTION release():
    activeCount -= 1
    IF waiters.length > 0:
        next = waiters.shift()
        activeCount += 1
        next()   # resolves the waiting request handler, letting it proceed
```

```
FUNCTION POST /api/upload(req):
    admission = await admissionQueue.tryEnqueue()
    IF admission.admitted == false:
        SET Retry-After: randomInt(1, 4)   # seconds; jittered so waiting clients don't retry in lockstep either
        RETURN 429 SERVER_BUSY

    TRY:
        # ... §4.3 validation + disk write + Prisma write logic runs here,
        #     with the guarantee that at most MAX_CONCURRENT_UPLOADS requests
        #     across ALL attendees are inside this block at once ...
    FINALLY:
        admissionQueue.release()
```

**Why this solves the "50 people upload at once" scenario:** without it, the Node event loop will happily *accept* 50 concurrent multipart streams and start writing 50 files to disk and issuing 50 SQLite transactions simultaneously — on a consumer PC's disk and upload bandwidth, this is exactly the kind of burst that causes request timeouts, `SQLITE_BUSY` surfacing to users, or a saturated Cloudflare Tunnel. With the Admission Queue in place, only `MAX_CONCURRENT_UPLOADS` requests (tune this during a dry run on the actual host hardware — start at 4) are ever doing real disk/DB work at once; the rest either wait briefly in-memory (bounded by `MAX_QUEUE_DEPTH`) or get an immediate `429` that plugs directly into the client's existing backoff/retry code (§4.2a) with zero new client-side logic required.

### 4.3 Server Upload Handler — Filesystem-then-DB Ordering (AC-06)

Called after the Admission Queue has admitted the request. The write order still matters: **disk write must succeed before the DB row commits**, so a crash mid-write never leaves a "phantom" submission row pointing at a missing/partial file. A DB failure after a successful disk write is tolerated (client retries via `client_capture_id` idempotency; the orphaned file is harmless).

```
FUNCTION handleUpload(req):
    session = requireValidSession(req.session_id, req.cookie)
    IF session.unlockedAt IS NOT NULL:
        RETURN 409 CHEST_ALREADY_UNLOCKED

    quest = config.quests.find(q => q.id == req.prompt_id)
    IF quest IS NULL: RETURN 400 INVALID_PROMPT_ID

    IF req.file.size > 2_000_000: RETURN 400 FILE_TOO_LARGE
    IF req.file.contentType != "image/webp": RETURN 400 INVALID_CONTENT_TYPE

    # Idempotent replay check BEFORE touching disk
    existing = await prisma.submission.findUnique({
        where: { sessionId_clientCaptureId: { sessionId: session.id, clientCaptureId: req.client_capture_id } }
    })
    IF existing EXISTS:
        RETURN 200 { accepted: true, progress: await computeProgress(prisma, session), chest_unlocked: session.unlockedAt != NULL }

    destDir   = `data/uploads/${config.event_slug}/${req.prompt_id}/`
    filename  = `${session.id}_${now_ms()}.webp`
    tmpPath   = destDir + filename + ".part"
    finalPath = destDir + filename

    ensureDirExists(destDir)
    streamToDisk(req.file.stream, tmpPath)      # append-only write, no buffering full file in RAM
    fsyncAndRename(tmpPath, finalPath)          # atomic rename -> no partial-file readers

    TRY:
        progress = await prisma.$transaction(async (tx) => {
            # ON CONFLICT upsert on (sessionId, promptId): a re-confirm of the
            # same mission on a *new* client_capture_id replaces the old row+file reference
            await tx.submission.upsert({
                where: { sessionId_promptId: { sessionId: session.id, promptId: req.prompt_id } },
                update: { clientCaptureId: req.client_capture_id, filePath: relative(finalPath),
                          fileSizeBytes: req.file.size, receivedAt: now_ms() },
                create: { sessionId: session.id, eventSlug: config.event_slug, promptId: req.prompt_id,
                          clientCaptureId: req.client_capture_id, filePath: relative(finalPath),
                          fileSizeBytes: req.file.size, receivedAt: now_ms() }
            })

            const p = await computeProgress(tx, session)
            IF p.completed == p.total AND session.unlockedAt IS NULL:
                await tx.session.update({ where: { id: session.id }, data: { unlockedAt: now_ms() } })
            RETURN p
        })
    CATCH PrismaClientKnownRequestError:
        # File already safely on disk; do not delete it. Surface a retryable error.
        RETURN 500 STORAGE_WRITE_FAILED

    RETURN 201 {
        accepted: true,
        prompt_id: req.prompt_id,
        progress: progress,
        chest_unlocked: (progress.completed == progress.total)
    }
```

### 4.4 Dynamic Progress Computation (AC-03)

```
FUNCTION computeProgress(tx, session):
    N = config.quests.length + (config.feedback_keystone.enabled ? 1 : 0)

    submissions = await tx.submission.findMany({
        where: { sessionId: session.id },
        select: { promptId: true }
    })
    K = submissions.length + (session.feedbackDone ? 1 : 0)

    RETURN { completed: K, total: N, completed_prompt_ids: submissions.map(s => s.promptId) }
```

This function is the single source of truth for K/N, called identically from `/api/upload`, `/api/feedback`, and `/api/progress/:sid` — guaranteeing the "chest unlocks exactly at K==N" invariant can never be computed inconsistently across endpoints.

### 4.5 Claim Pass Minting (AC-04)

```
FUNCTION POST /api/claim(req):
    session = requireValidSession(req.session_id, req.cookie)
    IF session.unlockedAt IS NULL:
        RETURN 400 CHEST_NOT_UNLOCKED

    normalizedEmail = req.student_email.trim().toLowerCase()
    IF NOT matchesEmailSyntax(normalizedEmail):
        RETURN 422 INVALID_EMAIL_SYNTAX

    domain = normalizedEmail.split("@")[1]
    IF domain != config.allowed_email_domain:
        RETURN 422 EMAIL_DOMAIN_MISMATCH

    FOR attempt IN 1..5:
        claimToken = uuidv4()
        shortCode  = generateShortCode()   # see 4.6
        TRY:
            claim = await prisma.claim.create({
                data: {
                    eventSlug: config.event_slug, sessionId: session.id, studentEmail: normalizedEmail,
                    claimToken, shortCode, lootSnapshot: JSON.stringify(config.loot),
                    isClaimed: false, createdAt: now_ms()
                }
            })
            RETURN 201 { claim_token: claimToken, short_code: shortCode, student_email: normalizedEmail, loot: config.loot }
        CATCH PrismaClientKnownRequestError AS e WHERE e.code == "P2002":   # unique constraint violation
            target = e.meta.target
            IF target INCLUDES "studentEmail": RETURN 409 EMAIL_ALREADY_CLAIMED
            IF target INCLUDES "sessionId":    RETURN 409 SESSION_ALREADY_CLAIMED
            IF target INCLUDES "shortCode":    CONTINUE   # retry loop with a freshly generated code
    RETURN 500 CLAIM_MINT_FAILED   # exhausted retries; astronomically unlikely at event scale
```

### 4.6 4-Character Fallback Code Generation

Alphabet excludes visually ambiguous characters (`0/O`, `1/I/L`) to keep it legible on cracked/glare-washed screens (PRD §4.1):

```
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"   # 32 symbols, no 0/O/1/I/L

FUNCTION generateShortCode():
    RETURN join(randomChoice(ALPHABET) for _ in range(4))   # 32^4 = ~1.05M combinations per event
```

Collision handling is delegated to the DB's `@@unique([eventSlug, shortCode])` constraint plus the bounded retry loop in §4.5 — acceptable given event-scale cardinalities (hundreds to low thousands of attendees).

### 4.7 Atomic Redemption — Race Condition Resolution (AC-05, PRD §4.1)

This is the single most safety-critical query in the system. It must guarantee **exactly one** of two simultaneous marshal scans succeeds, with zero possibility of double-dispense, without relying on application-level locking.

```
FUNCTION POST /api/marshal/redeem(req):
    requireMarshalAuth(req.cookie)      # 401 MARSHAL_UNAUTHENTICATED if invalid/expired

    IF (req.claim_token IS NULL) == (req.short_code IS NULL):
        RETURN 400 MISSING_TOKEN   # exactly one of the two must be present

    whereClause = req.claim_token ? { claimToken: req.claim_token } : { shortCode: req.short_code }
    row = await prisma.claim.findUnique({ where: whereClause })
    IF row IS NULL: RETURN 404 TOKEN_NOT_FOUND

    now = now_ms()

    # ── THE ATOMIC GATE ──
    # Prisma's updateMany() compiles to a single UPDATE ... WHERE statement
    # and returns { count }. SQLite serializes writers even under WAL, so of
    # two near-simultaneous updateMany() calls against the same claimToken,
    # exactly one matches `isClaimed: false` and flips the row; the other's
    # WHERE predicate is guaranteed to see the first one's committed write
    # and match zero rows.
    result = await prisma.claim.updateMany({
        where: { claimToken: row.claimToken, isClaimed: false },
        data:  { isClaimed: true, claimedAt: now, claimedByMarshal: marshalIdentity(req.cookie) }
    })

    IF result.count == 1:
        # We won the race.
        RETURN 200 {
            status: "claimed",
            student_email: row.studentEmail,
            loot: JSON.parse(row.lootSnapshot),
            claimed_at: now
        }
    ELSE:
        # count == 0: either we lost the race to a concurrent request,
        # or this token was already claimed earlier. Re-read for the
        # authoritative timestamp to display.
        current = await prisma.claim.findUnique({
            where: { claimToken: row.claimToken },
            select: { claimedAt: true }
        })
        RETURN 409 {
            error: {
                code: "ALREADY_CLAIMED",
                message: `ALREADY CLAIMED at ${isoFormat(current.claimedAt)}`,
                claimed_at: current.claimedAt
            }
        }
```

**Why this is sufficient without explicit application locks:** SQLite executes writer transactions strictly serially even under WAL mode (WAL allows concurrent *readers* with one *writer*; `busy_timeout` queues a second writer rather than failing it outright). Two near-simultaneous `UPDATE` statements against the same row are therefore totally ordered by SQLite itself — the second one's `isClaimed: false` predicate is guaranteed to see the first one's committed write, making the "second gets zero rows" outcome deterministic rather than probabilistic. Switching the client library from a raw driver to Prisma did not change this guarantee — it's a property of SQLite, and `updateMany()`'s `{ count }` return value exposes exactly what's needed to detect the loser of the race.

### 4.8 Premature Claim Gate (Client-Side, PRD §4.1 "Premature Claim with In-Flight Queue")

```
FUNCTION canShowClaimModal():
    pendingCount = IndexedDB.photos.where(status IN ["pending", "uploading", "failed"]).count()
    serverProgress = lastKnownServerProgress   # refreshed on each successful /api/upload or /api/progress poll
    RETURN pendingCount == 0 AND serverProgress.completed == serverProgress.total

# The "Generate Pass" CTA is disabled (with an inline "Syncing N photos..." label)
# until canShowClaimModal() is true. The server-side CHEST_NOT_UNLOCKED check in
# §4.5 is the authoritative backstop if this client gate is bypassed.
```

---

## 5. Verification Strategy

A feature is not "done" until every applicable test in this section passes in CI. Tests are grouped by the PRD Acceptance Criteria they retire.

### 5.1 Unit Tests

| Area | Test | Retires |
|---|---|---|
| `canvasCompress.ts` | Given a 4000×3000 source image, output long edge ≤ 1920px | AC-02 |
| `canvasCompress.ts` | Output MIME type is exactly `image/webp` | AC-02 |
| `canvasCompress.ts` | Iterative quality reduction converges output to ≤ 2MB for a worst-case high-entropy source image, within the 0.85 → 0.50 quality-step range | §4.1 (file size ceiling) |
| `email.ts` validation | `test.user@gmail.com` against `school.edu.ph` → rejected | AC-04 |
| `email.ts` validation | `Student.Name@School.EDU.PH` → normalized to `student.name@school.edu.ph` | AC-04 |
| `email.ts` validation | Malformed strings (`no-at-sign`, `a@b`, empty string) → `INVALID_EMAIL_SYNTAX` | AC-04 |
| `computeProgress()` | `feedback_keystone.enabled=false` excludes feedback from N | AC-03 |
| `computeProgress()` | K increments per unique submitted `prompt_id`; duplicate prompt submissions do not double-count K | AC-03 |
| `generateShortCode()` | Never emits `0`, `O`, `1`, `I`, `L` | §4.6 |
| `claimToken.ts` | Token is a valid UUIDv4 with no collisions across 100k generations (statistical sanity check) | AC-05 |
| Config loader | Malformed `event.config.json` (missing `quests`, bad slug regex) fails Zod validation and the loader throws before server start | §2.3 |
| Client upload worker backoff | Backoff sequence is monotonically non-decreasing and capped at 30s + jitter bound when no `Retry-After` is present | §4.2(a) |
| `admissionQueue.ts` | With `MAX_CONCURRENT_UPLOADS = 2`, firing 5 concurrent `tryEnqueue()` calls admits exactly 2 immediately and queues 3; releasing one admits exactly one more | §4.2(b) |
| `admissionQueue.ts` | With `MAX_QUEUE_DEPTH = 2`, a caller beyond active + queued capacity is rejected (`admitted: false`) without waiting | §4.2(b) |
| Marshal passphrase compare | Comparison uses a constant-time function (no early-exit timing difference between a correct prefix and a fully wrong string) | §3.8 |

### 5.2 Integration Tests (API + real SQLite file via Prisma, no mocks for DB)

| Test | Steps | Retires |
|---|---|---|
| Session mint & resume | `POST /api/session` twice with the same cookie → second call returns `created:false`, same `session_id` | Journey 1 step 2 |
| Upload happy path | `POST /api/upload` with valid webp ≤2MB → `201`, file exists on disk at expected path, `submissions` row exists | AC-06 |
| Upload idempotent replay | Same `client_capture_id` posted twice → second call returns `200` (not `201`), only one `submissions` row exists | §4.3 |
| Upload rejects oversized file | 2.5MB payload → `400 FILE_TOO_LARGE`, **no file written to disk**, no DB row; a 1.8MB payload is accepted (confirms the widened ceiling behaves as intended) | §4.3, §2.1 |
| Upload rejects wrong content-type | `image/png` payload → `400 INVALID_CONTENT_TYPE` | §3.3 |
| Upload after unlock | Complete all N tasks, then attempt one more `POST /api/upload` → `409 CHEST_ALREADY_UNLOCKED`, quest cards effectively read-only | AC-03 |
| Progress math scales with config | Two fixture configs (feedback enabled vs disabled) both produce correct `total` from `GET /api/progress/:sid` | AC-03 |
| Chest unlock trigger | Submitting the final required task (Nth) flips `chest_unlocked:true` in the **same response** that completed it | AC-03 |
| Feedback gate | `POST /api/feedback` before all photo prompts complete → `400 PROMPTS_INCOMPLETE` | Journey 1 step 6 |
| Claim before unlock | `POST /api/claim` with `unlockedAt IS NULL` → `400 CHEST_NOT_UNLOCKED` | AC-03, §4.8 |
| Claim domain validation (server) | Non-matching domain email rejected server-side even if a hypothetical client bypasses its own check | AC-04 |
| Duplicate email claim | Two different sessions claim with the same normalized email → second gets `409 EMAIL_ALREADY_CLAIMED` | AC-04, edge case table row 4 |
| Duplicate session claim | Same session calls `/api/claim` twice with different emails → second gets `409 SESSION_ALREADY_CLAIMED` | §4.5 |
| **Concurrent redemption race** | Fire two parallel `POST /api/marshal/redeem` requests for the identical `claim_token` (e.g. via `Promise.all`, both backed by `prisma.claim.updateMany()`) → assert exactly one resolves `200` (`count:1`), the other resolves `409 ALREADY_CLAIMED` (`count:0`) with a populated `claimed_at`; repeat 100x to rule out flakiness | AC-05, edge case table row 5, §4.7 |
| Redemption via short code | Redeem using `short_code` instead of `claim_token` → identical success path | Journey 2 step 3 / PRD §4.1 row 3 |
| Redemption without marshal auth | Call `/api/marshal/redeem` with no `sq_marshal` cookie → `401 MARSHAL_UNAUTHENTICATED` | Journey 2 step 1 |
| Marshal auth via POST body | `POST /marshal/auth` with the correct passphrase in the body → cookie set, redirect; incorrect passphrase → form re-rendered with error, `403`, no cookie | Journey 2 step 1, §3.8 |
| Marshal cookie expiry | Request with a `marshal_sessions` row whose `expiresAt < now` → treated as unauthenticated | §3.8 |
| Folder partitioning | Uploads for two different `prompt_id`s land in two distinct subfolders under the correct `event_slug` root within `data/uploads/`; filename matches `<session_id>_<timestamp>.webp` pattern | AC-06 |
| **Burst load through the Upload Admission Queue** | Fire 50 concurrent `POST /api/upload` requests (distinct sessions, same `prompt_id`, simulating "everyone photographs the speaker") against a server configured with `UPLOAD_CONCURRENCY=4`. Assert: no request hangs indefinitely, all 50 eventually resolve either `2xx` or `429`, at most 4 are ever mid-flight in the disk-write phase at any sampled instant (instrument via a test hook/counter), and every `429` carries a `Retry-After` header | Burst-load resilience; supersedes a plain "N concurrent uploads succeed" smoke test |
| Client honors `Retry-After` on `429` | Mock server returns `429` with `Retry-After: 2`; assert the client's next attempt waits ≥ 2s rather than following the default backoff curve | §4.2(a) |
| WAL busy-timeout smoke test | Fire 50 concurrent `/api/upload` requests across distinct sessions/prompts with the Admission Queue disabled (test-only override) → all still succeed with correct row counts, no `SQLITE_BUSY` surfaced to clients, validating `busy_timeout` as a second line of defense beneath the Admission Queue | §2.2 host constraint |

### 5.3 Contract Tests (Client ⇄ Server payload shape)

| Test | Retires |
|---|---|
| Every documented `4xx`/`5xx` response body validates against the shared `{ error: { code, message } }` JSON Schema, including the new `429 SERVER_BUSY` shape | §3 (all endpoints) |
| `GET /api/config` response validates against the "public config" JSON Schema and never leaks `MARSHAL_SECRET_KEY` or internal loot cost fields (if added later) | §3.1 |
| `POST /api/upload` `201`/`200` success bodies both validate against the same schema (client must treat them identically) | §4.3 |
| `POST /api/marshal/redeem` success and `409` bodies match the schemas in §3.7 exactly, including that `claimed_at` is present and numeric in both the success and conflict cases | AC-05 |

### 5.4 End-to-End Tests (browser automation, e.g. Playwright with a mocked `getUserMedia` fixture)

| Scenario | Steps | Retires |
|---|---|---|
| Full attendee happy path | Land on `/`, complete all quest cards with fixture images, complete feedback survey, observe chest burst animation fire, enter valid institutional email, see Claim QR + short code rendered | Journey 1 (full), AC-01–AC-04 |
| Retake produces zero I/O | Open camera, capture, tap Retake, assert (via network + IndexedDB inspection) that **no** `POST /api/upload` fired and **no** IndexedDB row was written | AC-01 |
| Offline resilience | Simulate `navigator.onLine = false` mid-capture, confirm photo stages in IndexedDB, UI does not block, then simulate reconnect and assert the queued upload eventually reaches `synced` | Edge case table row 1 |
| Session survives reload | Complete 2/4 quests, hard-reload the tab (simulating tab closure/reboot), assert progress bar still shows `2/4` sourced from the server, not a re-prompt from zero | Edge case table row 2 |
| Marshal scan-to-reset loop | Authenticate as marshal via the passphrase form, scan a valid QR, see green success screen, assert viewfinder auto-resets and is ready for the next scan within 1.5s | Journey 2 steps 3–4 |
| Marshal duplicate-scan UX | Scan an already-claimed QR, assert red screen renders the exact prior `claimed_at` timestamp, formatted human-readably | AC-05, edge case table row 5 |
| Fallback code entry under simulated glare | Use the manual keypad instead of the camera to redeem a code, assert identical success path to camera scan | Edge case table row 3 |

### 5.5 Non-Functional / Performance Checks

| Check | Threshold | Retires |
|---|---|---|
| Marshal redemption round-trip latency | p95 < 2000ms per PRD "under two seconds per attendee" | PRD §1 Core Value Prop |
| Compressed image payload size | 100% of a 50-image fixture corpus (varied lighting/content) produce output ≤ 2MB, with the large majority landing in the 250–400KB target band | §2.1 |
| Upload Admission Queue under sustained burst | No client-visible `5xx` during a scripted burst of 200 uploads in 60s against `UPLOAD_CONCURRENCY=4`; requests either succeed or receive a `429` with `Retry-After` | §4.2(b) |

### 5.6 Definition of Done (per feature)

A feature is considered complete only when:

1. All unit tests for the touched modules pass.
2. All integration tests tied to its Acceptance Criteria (per the tables above) pass against a real SQLite file (not an in-memory mock), with WAL mode enabled and accessed through Prisma.
3. Contract tests confirm no response shape drift from §3.
4. At least one E2E scenario covering the corresponding PRD Journey passes in a headless mobile-viewport browser profile.
5. For any change touching §4.3 (upload) or §4.7 (redemption), the concurrency test in §5.2 ("Concurrent redemption race" or the WAL/busy-timeout smoke test) has been re-run and passes at least 100 iterations with zero double-success outcomes.
6. Any change to `admissionQueue.ts` or the `UPLOAD_CONCURRENCY`/`UPLOAD_QUEUE_DEPTH` tuning values must be validated against the burst-load integration test in §5.2, ideally re-run against the *actual* host hardware (or a resource-throttled equivalent) rather than CI infrastructure — the whole point of this component is protecting one specific consumer PC's real disk/bandwidth limits, which CI hardware won't represent accurately.
