# SideQuest — Implementation Task List (`tasks.md`)

**Source:** `spec.md` (v1/MVP)
**Note on UI Deconstruction:** The UI Deconstruction doc referenced in the brief was not available at generation time. Phases 5 and 6 (Base UI Shell/Design System and Feature Components) are scoped from the spec's directory layout, component list (§1.2), and client-state contracts (§2.4–2.5) only. **Once the UI Deconstruction doc is supplied, re-open Phase 5/6 tasks to confirm exact spacing/typography/token values before marking them "done."** Everything in Phases 0–4 (data, backend, API) is fully spec-derived and should not need revision.

Ordering: Setup → Data Models → Backend Services → API Routes → Base UI Shell/Design System → Feature Components → Full E2E Integration.

---

## Phase 0 — Project Scaffolding & Environment

- [ ] **T001 — Init Astro project with Node SSR adapter.**
  Files: `astro.config.mjs`, `package.json`, `tsconfig.json`
  Run `npm create astro@latest` (TypeScript strict template), add `@astrojs/node` adapter in `standalone` mode.
  **Verify:** `npx astro build` exits 0 and produces `dist/server/entry.mjs`.

- [ ] **T002 — Install core dependencies.**
  Files: `package.json`, `package-lock.json`
  Install: `prisma`, `@prisma/client`, `zod`, `dexie`, `tailwindcss`, `@astrojs/tailwind`, `qrcode`, `vitest`, `@playwright/test`, `supertest` (or equivalent).
  **Verify:** `npm ls prisma zod dexie tailwindcss @playwright/test` shows all resolved with no `UNMET DEPENDENCY` errors.

- [ ] **T003 — Configure Tailwind.**
  Files: `tailwind.config.mjs`, `src/styles/global.css`
  Wire Tailwind into Astro via `@astrojs/tailwind` integration; create `global.css` with the three standard `@tailwind` directives (component/keyframe additions come in T056).
  **Verify:** `npx astro build` succeeds and generated HTML `<head>` includes a compiled Tailwind `<style>`/`<link>` output.

- [ ] **T004 — Author `Dockerfile` and `docker-compose.yml`.**
  Files: `Dockerfile`, `docker-compose.yml`
  Multi-stage Node build; mount `./data` as the single bind volume per §1.1/§1.2.
  **Verify:** `docker build -t sidequest .` exits 0.

- [ ] **T005 — Create `.env.example`.**
  Files: `.env.example`
  Include `DATABASE_URL`, `MARSHAL_SECRET_KEY`, `UPLOAD_CONCURRENCY`, `UPLOAD_QUEUE_DEPTH`.
  **Verify:** `grep -c . .env.example` returns 4 (one line per var), and `node -e "require('dotenv').config({path:'.env.example'})"` does not throw.

---

## Phase 1 — Data Models

- [ ] **T006 — Create `prisma/schema.prisma` with datasource/generator + `Session` model only.**
  Files: `prisma/schema.prisma`
  Per §2.2: `id`, `eventSlug`, `createdAt`, `lastSeenAt`, `feedbackDone`, `unlockedAt`.
  **Verify:** `npx prisma validate` exits 0.

- [ ] **T007 — Add `Submission` model to schema.**
  Files: `prisma/schema.prisma`
  Include both `@@unique([sessionId, promptId])` and `@@unique([sessionId, clientCaptureId])` exactly as specified in §2.2.
  **Verify:** `npx prisma validate` exits 0; `npx prisma format --check` reports no diff.

- [ ] **T008 — Add `Claim` model to schema.**
  Files: `prisma/schema.prisma`
  Include `@@unique([eventSlug, studentEmail])`, `@@unique([eventSlug, shortCode])`, `@@unique([sessionId])`, index on `claimToken`.
  **Verify:** `npx prisma validate` exits 0.

- [ ] **T009 — Add `FeedbackResponse` model to schema.**
  Files: `prisma/schema.prisma`
  **Verify:** `npx prisma validate` exits 0.

- [ ] **T010 — Add `MarshalSession` model to schema.**
  Files: `prisma/schema.prisma`
  **Verify:** `npx prisma validate` exits 0; full schema now matches §2.2 field-for-field (manual diff against spec).

- [ ] **T011 — Generate initial migration.**
  Files: `prisma/migrations/0001_init/migration.sql`
  Run `npx prisma migrate dev --name init` against a throwaway `data/sidequest.db`.
  **Verify:** Command exits 0; `sqlite3 data/sidequest.db ".tables"` lists `sessions`, `submissions`, `claims`, `feedback_responses`, `marshal_sessions`.

- [ ] **T012 — Create `event.config.json` fixture.**
  Files: `event.config.json`
  Use the exact example payload in §2.3 (Tech Summit 2026 fixture) as the dev default.
  **Verify:** `node -e "JSON.parse(require('fs').readFileSync('event.config.json'))"` does not throw.

- [ ] **T013 — Create Zod config schema.**
  Files: `src/lib/config/schema.ts`
  Implement `QuestSchema`, `LootItemSchema`, `FeedbackQuestionSchema`, `EventConfigSchema` verbatim per §2.3.
  **Verify:** `npx vitest run tests/unit/configSchema.test.ts` (new test asserting the T012 fixture parses via `EventConfigSchema.parse`) passes with exit 0.

- [ ] **T014 — Create config loader.**
  Files: `src/lib/config/loadEventConfig.ts`
  Reads `event.config.json`, validates via `EventConfigSchema`, throws on failure (server must refuse to start per §2.3/§3.1).
  **Verify:** `npx vitest run tests/unit/loadEventConfig.test.ts` — test "malformed config (missing `quests`, bad slug regex) throws before server start" passes (retires §2.3 requirement).

---

## Phase 2 — Backend Services

- [ ] **T015 — Prisma client singleton with PRAGMA setup.**
  Files: `src/lib/db/prismaClient.ts`
  Exact code from §2.2: `PRAGMA journal_mode = WAL;`, `PRAGMA busy_timeout = 5000;`, `PRAGMA foreign_keys = ON;` run once at startup.
  **Verify:** `node -e "import('./src/lib/db/prismaClient.ts').then(async m=>{const r=await m.default.$queryRawUnsafe('PRAGMA journal_mode;'); console.log(r)})"` (via `tsx`) prints `wal`.

- [ ] **T016 — Email validation module.**
  Files: `src/lib/validation/email.ts`
  Normalize (trim/lowercase) + domain match against config's `allowed_email_domain`.
  **Verify:** `npx vitest run tests/unit/email.test.ts` — all three cases pass: gmail vs school.edu.ph rejected, mixed-case normalized correctly, malformed strings → `INVALID_EMAIL_SYNTAX` (retires AC-04 unit rows).

- [ ] **T017 — API payload Zod schemas.**
  Files: `src/lib/validation/payloads.ts`
  Schemas for `/api/upload` multipart fields, `/api/feedback` body, `/api/claim` body, `/api/marshal/redeem` body, matching §3.2–§3.7 JSON Schemas.
  **Verify:** `npx vitest run tests/unit/payloads.test.ts` — a valid and an invalid fixture per schema both resolve as expected (`safeParse().success` true/false respectively).

- [ ] **T018 — Claim token + short code generation.**
  Files: `src/lib/tokens/claimToken.ts`
  `generateShortCode()` alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` per §4.6; `claimToken` as UUIDv4.
  **Verify:** `npx vitest run tests/unit/claimToken.test.ts` — "never emits 0/O/1/I/L" and "100k generations, statistical no-collision sanity check" both pass (retires §4.6, AC-05 unit rows).

- [ ] **T019 — Progress computation module.**
  Files: `src/lib/progress/computeProgress.ts`
  Implement exactly per §4.4 pseudocode (single source of truth for K/N).
  **Verify:** `npx vitest run tests/unit/computeProgress.test.ts` — "feedback disabled excludes feedback from N" and "duplicate prompt submissions do not double-count K" both pass (retires AC-03 unit rows).

- [ ] **T020 — Streaming upload writer.**
  Files: `src/lib/storage/writeUpload.ts`
  Implements tmp-file write + `fsyncAndRename` atomic rename per §4.3 (disk-before-DB ordering contract).
  **Verify:** `npx vitest run tests/unit/writeUpload.test.ts` — writing a fixture blob results in a file at the final path with byte-identical content and no `.part` file remaining; a simulated mid-write failure leaves no partial file at the final path.

- [ ] **T021 — Server-side Upload Admission Queue.**
  Files: `src/lib/uploadAdmission/admissionQueue.ts`
  Implement `tryEnqueue()`/`release()` exactly per §4.2(b) bounded-semaphore pseudocode, reading `MAX_CONCURRENT_UPLOADS`/`MAX_QUEUE_DEPTH` from env with the stated defaults (4/40).
  **Verify:** `npx vitest run tests/unit/admissionQueue.test.ts` — both §5.1 rows pass: "`MAX_CONCURRENT_UPLOADS=2`, 5 concurrent `tryEnqueue()` → 2 admitted immediately, 3 queued; releasing one admits exactly one more" and "`MAX_QUEUE_DEPTH=2`, caller beyond capacity rejected without waiting."

---

## Phase 3 — API Routes

- [ ] **T022 — Session-mint middleware.**
  Files: `src/middleware.ts`
  Implement the session-cookie half only (mint/read `sq_session`), leaving marshal-guard logic for T035.
  **Verify:** `npx vitest run tests/unit/middleware.session.test.ts` — a request with no cookie gets a `Set-Cookie: sq_session=...` response header attached to `context.locals`.

- [ ] **T023 — `GET /api/config` route.**
  Files: `src/pages/api/config.ts`
  Return the public config subset per §3.1, computing `total_tasks` via `N = quests.length + (feedback ? 1 : 0)`.
  **Verify:** Start dev server (`npm run dev`), `curl -s http://localhost:4321/api/config | jq .total_tasks` returns the expected integer for the T012 fixture; response body has no `MARSHAL_SECRET_KEY` key.

- [ ] **T024 — Contract test: `/api/config` shape.**
  Files: `tests/contract/config.test.ts`
  **Verify:** `npx vitest run tests/contract/config.test.ts` — response validates against a "public config" JSON Schema and asserts absence of `MARSHAL_SECRET_KEY`/internal loot cost fields (retires §5.3 row 2).

- [ ] **T025 — `POST /api/session` route.**
  Files: `src/pages/api/session.ts`
  Idempotent mint/resume per §3.2, sets `sq_session` cookie with correct flags.
  **Verify:** `npx vitest run tests/integration/session.test.ts` — "POST twice with same cookie → second call `created:false`, same `session_id`" passes against a real SQLite file (retires §5.2 row 1).

- [ ] **T026 — `POST /api/upload` route — validation + admission queue wiring.**
  Files: `src/pages/api/upload.ts`
  Implement request parsing, `admissionQueue.tryEnqueue()`/`release()` wrapping, and all `400`/`403`/`404`/`409`/`413`/`429` error branches per §3.3, calling into T020/T021.
  **Verify:** `npx tsc --noEmit` passes (no type errors) and `npm run dev` + manual `curl -F` smoke test returns `429` with `Retry-After` header when `UPLOAD_CONCURRENCY=0` is set.

- [ ] **T027 — Wire disk-then-DB write logic into upload handler.**
  Files: `src/pages/api/upload.ts`
  Implement the `prisma.$transaction` upsert + `unlockedAt` flip exactly per §4.3.
  **Verify:** `npx vitest run tests/integration/upload.happyPath.test.ts` — valid ≤2MB webp → `201`, file exists on disk at expected path, `submissions` row exists (retires AC-06).

- [ ] **T028 — Integration test: upload idempotent replay.**
  Files: `tests/integration/upload.idempotent.test.ts`
  **Verify:** `npx vitest run tests/integration/upload.idempotent.test.ts` — same `client_capture_id` posted twice → second call `200` (not `201`), only one `submissions` row exists (retires §4.3).

- [ ] **T029 — Integration test: upload rejects oversized/wrong content-type.**
  Files: `tests/integration/upload.validation.test.ts`
  **Verify:** `npx vitest run tests/integration/upload.validation.test.ts` — 2.5MB payload → `400 FILE_TOO_LARGE` with no file/DB row written; 1.8MB accepted; `image/png` → `400 INVALID_CONTENT_TYPE` (retires §4.3, §2.1, §3.3).

- [ ] **T030 — Integration test: upload after unlock + folder partitioning.**
  Files: `tests/integration/upload.postUnlock.test.ts`
  **Verify:** `npx vitest run tests/integration/upload.postUnlock.test.ts` — post-unlock upload → `409 CHEST_ALREADY_UNLOCKED`; two distinct `prompt_id`s land in two distinct subfolders under the correct `event_slug` root, filenames match `<session_id>_<timestamp>.webp` (retires AC-03, AC-06).

- [ ] **T031 — `GET /api/progress/[sid].ts` route.**
  Files: `src/pages/api/progress/[sid].ts`
  Calls `computeProgress` (T019); includes `claim` sub-object when present per §3.4.
  **Verify:** `npx vitest run tests/integration/progress.test.ts` — two fixture configs (feedback enabled/disabled) both produce correct `total`; unknown `sid` → `404 SESSION_NOT_FOUND` (retires AC-03).

- [ ] **T032 — `POST /api/feedback` route.**
  Files: `src/pages/api/feedback.ts`
  Gate on config-enabled + all prompts complete per §3.5.
  **Verify:** `npx vitest run tests/integration/feedback.test.ts` — pre-completion call → `400 PROMPTS_INCOMPLETE`; submitting the final required item flips `chest_unlocked:true` in the same response (retires Journey 1 step 6, AC-03).

- [ ] **T033 — `POST /api/claim` route.**
  Files: `src/pages/api/claim.ts`
  Implement exactly per §4.5 pseudocode including the 5-attempt shortcode-collision retry loop.
  **Verify:** `npx vitest run tests/integration/claim.test.ts` — pre-unlock claim → `400 CHEST_NOT_UNLOCKED`; non-matching domain rejected server-side even bypassing client check; duplicate email across two sessions → second `409 EMAIL_ALREADY_CLAIMED`; same session twice with different emails → second `409 SESSION_ALREADY_CLAIMED` (retires AC-03, AC-04, §4.5, §4.8).

- [ ] **T034 — `/marshal/auth` page + `POST /marshal/auth` handler.**
  Files: `src/pages/marshal/auth.astro`
  Constant-time comparison against `MARSHAL_SECRET_KEY`; sets `sq_marshal` cookie on match; re-renders form with `403` on mismatch, per §3.8.
  **Verify:** `npx vitest run tests/unit/marshalCompare.test.ts` — comparison uses a constant-time function (assert no early-exit timing difference between correct-prefix and fully-wrong string, per §5.1 row); `npx vitest run tests/integration/marshalAuth.test.ts` — correct passphrase → cookie set + `302`; incorrect → `403`, no cookie (retires Journey 2 step 1).

- [ ] **T035 — Complete `src/middleware.ts` marshal guard.**
  Files: `src/middleware.ts`
  Guard every `/marshal/*` page and `/api/marshal/*` route: checks `sq_marshal` cookie against `marshal_sessions` (exists AND `expiresAt > now`).
  **Verify:** `npx vitest run tests/integration/marshalGuard.test.ts` — request with no `sq_marshal` cookie to `/api/marshal/redeem` → `401 MARSHAL_UNAUTHENTICATED`; a `marshal_sessions` row with `expiresAt < now` is treated as unauthenticated (retires Journey 2 step 1, §3.8).

- [ ] **T036 — `POST /api/marshal/redeem` route.**
  Files: `src/pages/api/marshal/redeem.ts`
  Implement exactly per §4.7 (the `updateMany` atomic gate) including `token_not_found`/`missing_token` branches.
  **Verify:** `npx vitest run tests/integration/redeem.happyPath.test.ts` — success path returns `200` with `status:"claimed"`; redemption via `short_code` follows the identical success path (retires AC-05, Journey 2 step 3).

- [ ] **T037 — Integration test: concurrent redemption race.**
  Files: `tests/integration/redeem.race.test.ts`
  **Verify:** `npx vitest run tests/integration/redeem.race.test.ts --repeat 100` (or equivalent loop) — fire two parallel redeem requests for the identical `claim_token` via `Promise.all`; assert exactly one resolves `200 {count:1}`, the other `409 {count:0}` with populated `claimed_at`, across all 100 iterations with zero double-success outcomes (retires AC-05, §4.7, DoD item 5).

- [ ] **T038 — Integration test: burst load through Admission Queue.**
  Files: `tests/integration/upload.burstLoad.test.ts`
  **Verify:** `npx vitest run tests/integration/upload.burstLoad.test.ts` — 50 concurrent uploads against `UPLOAD_CONCURRENCY=4`: no request hangs, all resolve `2xx` or `429`, at most 4 mid-flight in disk-write phase at any sampled instant (via test-hook counter), every `429` carries `Retry-After` (retires burst-load resilience requirement, supersedes plain smoke test).

- [ ] **T039 — Integration test: WAL busy-timeout smoke test.**
  Files: `tests/integration/upload.walSmoke.test.ts`
  **Verify:** `npx vitest run tests/integration/upload.walSmoke.test.ts` — 50 concurrent uploads across distinct sessions/prompts with Admission Queue disabled (test-only override) all succeed with correct row counts, no `SQLITE_BUSY` surfaced (retires §2.2 host constraint).

- [ ] **T040 — Contract tests: error shape + upload/redeem body parity.**
  Files: `tests/contract/errorShapes.test.ts`, `tests/contract/uploadRedeem.test.ts`
  **Verify:** `npx vitest run tests/contract/errorShapes.test.ts tests/contract/uploadRedeem.test.ts` — every `4xx`/`5xx` body (including `429 SERVER_BUSY`) validates against `{error:{code,message}}` schema; `/api/upload` `200`/`201` bodies share one schema; `/api/marshal/redeem` success/`409` bodies both include numeric `claimed_at` (retires §5.3).

---

## Phase 4 — Base UI Shell / Design System

*(Scoped from spec §1.2/§2.4/§2.5 layout + state contracts. Confirm visual tokens against the UI Deconstruction doc once available.)*

- [ ] **T041 — Global stylesheet: Tailwind entry + chest keyframes.**
  Files: `src/styles/global.css`
  Add placeholder `@keyframes` blocks for spring/rattle/burst (per §1.2 comment); final easing/timing values to be confirmed against UI Deconstruction.
  **Verify:** `npx astro build` succeeds; `grep -q "@keyframes" src/styles/global.css` true.

- [ ] **T042 — Base Astro layout shell.**
  Files: `src/layouts/BaseLayout.astro`
  Minimal HTML shell (meta viewport, mobile-first, imports `global.css`) shared by attendee and marshal pages.
  **Verify:** `npx astro build` succeeds; rendered output includes `<meta name="viewport"...>`.

- [ ] **T043 — Client session module.**
  Files: `src/client/session.ts`
  Session id read/mint against `sq_session` cookie, mirrored into `localStorage` per §1.2/§2.5.
  **Verify:** `npx vitest run tests/unit/clientSession.test.ts` (jsdom env) — mints once, subsequent calls return the same id from the mirror.

- [ ] **T044 — Client IndexedDB schema (Dexie).**
  Files: `src/client/db/indexedDb.ts`
  Implement `photos`/`uiCache` stores exactly per §2.4 Dexie v1 schema.
  **Verify:** `npx vitest run tests/unit/indexedDb.schema.test.ts` (fake-indexeddb) — schema version 1 stores created with correct indexes.

- [ ] **T045 — Client-side validation rules on IndexedDB writes.**
  Files: `src/client/db/indexedDb.ts`
  Enforce the four rules in §2.4: size ceiling, MIME type, one-record-per-prompt (delete+insert replace), one-directional status transitions.
  **Verify:** `npx vitest run tests/unit/indexedDb.rules.test.ts` — re-confirming an already-completed prompt replaces rather than appends; attempting `synced → pending` transition directly is rejected/no-ops.

- [ ] **T046 — Canvas compression module.**
  Files: `src/client/canvasCompress.ts`
  Implement resize-to-≤1920px + iterative WebP quality-stepping loop (0.85 → 0.50) exactly per §4.1.
  **Verify:** `npx vitest run tests/unit/canvasCompress.test.ts` — 4000×3000 fixture → output long edge ≤1920px; output MIME exactly `image/webp`; worst-case high-entropy fixture converges to ≤2MB within the quality range (retires AC-02, §4.1 file-size ceiling).

- [ ] **T047 — Client serial upload worker.**
  Files: `src/client/uploadQueue.ts`
  Implement `wake()`/`processLoop()` exactly per §4.2(a), including jittered initial delay and backoff-with-`Retry-After` handling.
  **Verify:** `npx vitest run tests/unit/uploadQueue.test.ts` — backoff sequence is monotonically non-decreasing and capped at 30s+jitter when no `Retry-After` present; mocked `429` with `Retry-After: 2` → next attempt waits ≥2s (retires §4.2(a) unit + contract rows).

- [ ] **T048 — Client premature-claim gate.**
  Files: `src/client/session.ts` (or new `src/client/claimGate.ts`)
  Implement `canShowClaimModal()` exactly per §4.8.
  **Verify:** `npx vitest run tests/unit/claimGate.test.ts` — returns `false` while `pendingCount > 0` even if server progress reads complete; returns `true` only when both conditions hold.

---

## Phase 5 — Feature Components

*(Visual/interaction detail pending UI Deconstruction doc; components below implement the functional contracts from spec §1.2/§4 only.)*

- [ ] **T049 — `QuestCard.tsx`.**
  Files: `src/components/QuestCard.tsx`
  Renders quest title/description, `COMPLETE_PENDING_SYNC`/`COMPLETE`/read-only states.
  **Verify:** `npx vitest run tests/unit/QuestCard.test.tsx` (Testing Library) — renders read-only (non-interactive) state when `chestUnlocked` prop is true.

- [ ] **T050 — `Chest.tsx`.**
  Files: `src/components/Chest.tsx`
  CSS spring/rattle/burst FX hooks (`playChestRattleAnimation`, `triggerChestBurst`) wired to the keyframes from T041.
  **Verify:** `npx vitest run tests/unit/Chest.test.tsx` — calling the exposed burst trigger adds the expected animation class/state.

- [ ] **T051 — `CameraCapture.tsx`.**
  Files: `src/components/CameraCapture.tsx`
  `getUserMedia` + `<video>`/`<canvas>` capture, invoking `onCaptureConfirmed` (T046/T044 pipeline) only on Confirm, never on Retake.
  **Verify:** `npx vitest run tests/unit/CameraCapture.test.tsx` (mocked `getUserMedia`) — Retake path calls no compression/storage functions (zero I/O), matching AC-01 intent ahead of full E2E coverage in T058.

- [ ] **T052 — `ReviewOverlay.tsx`.**
  Files: `src/components/ReviewOverlay.tsx`
  In-memory Retake/Confirm screen; on Retake, discards buffer with no IndexedDB/network calls.
  **Verify:** `npx vitest run tests/unit/ReviewOverlay.test.tsx` — Retake handler triggers zero calls to any mocked IndexedDB/upload module.

- [ ] **T053 — `ClaimModal.tsx`.**
  Files: `src/components/ClaimModal.tsx`
  Email input + domain-mismatch/invalid-syntax inline errors sourced from `/api/claim` error codes; CTA disabled per `canShowClaimModal()` (T048) with "Syncing N photos..." label.
  **Verify:** `npx vitest run tests/unit/ClaimModal.test.tsx` — CTA is disabled and shows the syncing label when `canShowClaimModal()` returns false.

- [ ] **T054 — `ClaimPass.tsx`.**
  Files: `src/components/ClaimPass.tsx`
  Renders QR (via `qrcode` lib, encoding `claim_token`) + 4-char fallback code.
  **Verify:** `npx vitest run tests/unit/ClaimPass.test.tsx` — rendered QR payload decodes back to the exact `claim_token` prop passed in.

- [ ] **T055 — `MarshalScanner.tsx`.**
  Files: `src/components/MarshalScanner.tsx`
  Camera scanner + manual fallback keypad, both posting to `/api/marshal/redeem`; green/red result screens; auto-reset viewfinder after a scan.
  **Verify:** `npx vitest run tests/unit/MarshalScanner.test.tsx` — after a mocked successful redeem response, the component calls its reset handler.

- [ ] **T056 — Wire `src/pages/index.astro`.**
  Files: `src/pages/index.astro`
  Compose `Chest`, `QuestCard` list, `CameraCapture`/`ReviewOverlay`, `ClaimModal`/`ClaimPass`, polling `/api/progress/:sid` per §2.5 reconciliation rule (server list is canonical).
  **Verify:** `npm run dev` + manual load in a headless browser (`npx playwright open http://localhost:4321`) shows quest cards rendered from `/api/config` data with no console errors.

- [ ] **T057 — Wire `src/pages/marshal/index.astro`.**
  Files: `src/pages/marshal/index.astro`
  Composes `MarshalScanner`, gated by the middleware guard from T035.
  **Verify:** Unauthenticated request to `/marshal` redirects to `/marshal/auth` (manual `curl -I` shows `302`/`401` per middleware behavior).

---

## Phase 6 — Full End-to-End Integration

- [ ] **T058 — Playwright config + mocked `getUserMedia` fixture.**
  Files: `playwright.config.ts`, `tests/e2e/fixtures/camera.ts`
  **Verify:** `npx playwright test --list` shows the fixture loaded with zero config errors.

- [ ] **T059 — E2E: full attendee happy path.**
  Files: `tests/e2e/attendeeHappyPath.spec.ts`
  **Verify:** `npx playwright test tests/e2e/attendeeHappyPath.spec.ts` — land on `/`, complete all quest cards with fixture images, complete feedback survey, chest burst fires, valid institutional email accepted, Claim QR + short code render (retires Journey 1 full, AC-01–AC-04).

- [ ] **T060 — E2E: Retake produces zero I/O.**
  Files: `tests/e2e/retakeZeroIO.spec.ts`
  **Verify:** `npx playwright test tests/e2e/retakeZeroIO.spec.ts` — network + IndexedDB inspection confirms no `POST /api/upload` fired and no IndexedDB row written after Retake (retires AC-01).

- [ ] **T061 — E2E: offline resilience.**
  Files: `tests/e2e/offlineResilience.spec.ts`
  **Verify:** `npx playwright test tests/e2e/offlineResilience.spec.ts` — simulated `navigator.onLine=false` mid-capture stages photo in IndexedDB without blocking UI; reconnect → queued upload reaches `synced` (retires edge case row 1).

- [ ] **T062 — E2E: session survives reload.**
  Files: `tests/e2e/sessionSurvivesReload.spec.ts`
  **Verify:** `npx playwright test tests/e2e/sessionSurvivesReload.spec.ts` — complete 2/4 quests, hard-reload, progress bar shows `2/4` sourced from server, not reset to zero (retires edge case row 2).

- [ ] **T063 — E2E: marshal scan-to-reset loop.**
  Files: `tests/e2e/marshalScanReset.spec.ts`
  **Verify:** `npx playwright test tests/e2e/marshalScanReset.spec.ts` — authenticate via passphrase form, scan valid QR, green success screen, viewfinder auto-resets and is scan-ready within 1.5s (retires Journey 2 steps 3–4).

- [ ] **T064 — E2E: marshal duplicate-scan UX.**
  Files: `tests/e2e/marshalDuplicateScan.spec.ts`
  **Verify:** `npx playwright test tests/e2e/marshalDuplicateScan.spec.ts` — scanning an already-claimed QR renders red screen with the exact prior `claimed_at`, formatted human-readably (retires AC-05, edge case row 5).

- [ ] **T065 — E2E: fallback code entry under simulated glare.**
  Files: `tests/e2e/fallbackCodeEntry.spec.ts`
  **Verify:** `npx playwright test tests/e2e/fallbackCodeEntry.spec.ts` — manual keypad redemption reaches the identical success path as camera scan (retires edge case row 3).

- [ ] **T066 — Non-functional: redemption latency + compression corpus + sustained burst.**
  Files: `tests/perf/redemptionLatency.spec.ts`, `tests/perf/compressionCorpus.spec.ts`, `tests/perf/sustainedBurst.spec.ts`
  **Verify:** All three pass their thresholds: redemption round-trip p95 < 2000ms; 100% of a 50-image fixture corpus compress to ≤2MB (majority in 250–400KB band); a scripted 200-upload/60s burst against `UPLOAD_CONCURRENCY=4` produces zero client-visible `5xx` (retires §5.5 rows 1–3).

- [ ] **T067 — Final Definition-of-Done audit.**
  Files: none (process/checklist task — annotate `tasks.md` itself with pass/fail per item)
  **Verify:** Run the full suite — `npx vitest run && npx playwright test` — and confirm all six §5.6 DoD conditions hold: unit tests pass for touched modules, integration tests pass against a real WAL-mode SQLite file via Prisma, contract tests show no shape drift, at least one E2E scenario per PRD Journey passes headless mobile-viewport, the redemption race test has been re-run at ≥100 iterations with zero double-success, and any `admissionQueue.ts`/tuning changes have been validated against the burst-load test ideally on real host hardware.
