# UI Build Notes — TechFair Mission Tracker

Working log for the mobile mission-tracker screen described by `ui-spec.md` and
sequenced by `ui-tasks.md`. This file records **decisions, deviations, and the
current component inventory** — it complements, and does not replace, those specs.

---

## 1. Source documents

| Doc | Role |
|---|---|
| `spec.md` | System architecture + API contracts (authoritative) |
| `ui-spec.md` | Design tokens, layout skeleton, component hierarchy (authoritative for visuals) |
| `ui-tasks.md` | Sequential build checklist (progress tracked here by checkbox) |

Where `ui-tasks.md` contradicts the repo reality, the repo wins and the deviation
is logged below.

---

## 2. Tailwind v4 adaptations

`ui-tasks.md` was written assuming Tailwind **v3**. This project runs Tailwind
**v4** via `@tailwindcss/vite`, so:

- **No auto-discovered JS config.** `tailwind.config.mjs` is loaded explicitly
  from `src/styles/global.css` with the `@config` directive.
- **CSS entry name.** The checklist says `src/styles/globals.css`; the repo
  (and `spec.md:196`, `BaseLayout.astro`) use the singular
  `src/styles/global.css`. We extend the existing file rather than fork a second
  entry point.
- **`@tailwind base/components/utilities`** is v3 syntax; `@import "tailwindcss"`
  already supplies the theme/preflight/utilities layers.
- **Gradients** were renamed (`bg-linear-to-*`), but the v3 alias
  `bg-gradient-to-*` still compiles identically, so the spec's literal class is
  used.

### Token pipeline (single source of truth)

```
src/styles/tokens.ts   ←─ raw values (hex, rem) matching ui-spec.md §1.1–1.2
        │  imported by jiti
        ▼
tailwind.config.mjs    ←─ theme.extend maps semantic tokens → utility scales
        │  loaded via @config
        ▼
src/styles/global.css  ←─ @import "tailwindcss" + @config + base rules
```

`tailwind.config.mjs` imports `tokens.ts`, so Tailwind utilities and runtime JS
(e.g. inline SVG fills) can never drift. Prefer utility classes in components;
reach for `tokens.ts` only where a class can't express the value.

---

## 3. Deviations & decisions log

| # | Item | Decision | Rationale |
|---|---|---|---|
| 1 | `tailwind.config.js` vs `.mjs` | `.mjs` | `spec.md:123` + ESM repo (`"type": "module"`) |
| 2 | Base typeface | System sans stack (`--font-sans`) | `ui-spec.md` defines no typography; system stack ⇒ no FOUC |
| 3 | Header type scale | `text-2xl` title / `text-sm` subtitle | Not specified in `ui-spec.md`; preflight resets heading sizes so set explicitly |
| 4 | Chest asset name | Use `chest-locked.png` | Spec says `chest-closed.png`; only `chest-locked.png` ships in `public/assets/` |
| 5 | Bubble positions | Approximated | No mockup image in repo; offsets centralized for easy tuning |
| 6 | `MainPanel` children | Optional | Panel is intentionally empty during scaffolding |
| 7 | React 19 resource hoisting | Hero located by container class in tests | React 19 hoists `<link rel="preload" as="image">` to the top of SSR output |
| 8 | Mascot state swap | Both mascot images mounted + opacity cross-fade | `src` swap could flash before the new asset loads; cross-fade guarantees "no flicker" |
| 9 | `isAllCompleted` | One-way latch, not derived | `ui-spec.md` §6 says it must not reset when a mission is later un-checked |
| 10 | Chest pop-in | Only on the false→true transition via effect | Prevents replaying when mounted already all-complete |
| 11 | Excited mascot | `mascot-idle.png` + `animate-bounce` | **No `mascot-excited.png` asset exists** (ui-spec asset gap) — flag to design |
| 12 | Hook `progressPercent` | Exposed but unused by the screen | `ProgressTracker` derives its own percent from completed/total |
| 13 | Responsive cap location | Non-positioned `mx-auto max-w-md` wrapper inside `AppShell` | Keeps content card-width on desktop (the original `BackgroundDecor` it was chosen for has since been removed) |
| 14 | Keyboard semantics | `role="checkbox"` + Enter/Space on rows | Follows task 62; rows are `tabIndex=0` with `focus-visible` ring |
| 15 | Hero layout | Mascot removed; chest-only, hero `h-48`, chest `h-32 w-52` | Design request (post-roadmap). Differs from `ui-spec.md` §2 (chest in mascot's arms) |
| 16 | Shake strength | Escalates with `completedCount / total`; keyframe reads `--chest-shake-x/-rot` (2→8px, 3→12°) set inline | "Every mission done shakes harder", normalized to the dynamic mission total |
| 17 | Tab navigation removed | Deleted `TabSwitcher.tsx` + `Tab.tsx`; `MissionList` renders directly | Design request (post-roadmap). Differs from `ui-spec.md` §2/§3 tabs |
| 18 | Status indicator | Filled emerald disc + white `Check` (not `CheckCircle2`), incomplete stays a thin ring | Matches the reference's solid check badge; reads more clearly at a glance |
| 19 | Background bubbles | Removed; `BackgroundDecor.tsx` deleted and replaced by `UnderwaterBackdrop` (V3) | Design request: the decorative circles made the screen feel "vibe coded" |
| 20 | Lower-half polish | `gap-3.5` row rhythm, `font-semibold`/`leading-snug` text, press (`active:scale-[0.99]`) + hover feedback | "Look & feel" pass against `reference.png` |
| 21 | Bottom decoration | **None** — `MainPanel` runs to the bottom edge with a plain white base (revisited in #28) | Design request: earlier attempts (corner "cloud" of circles, then SVG underwater vegetation) both looked off; the bottom should stay plain |
| 22 | Chest shake intensity | Generated `chest-shake` keyframes: 9 direction changes, `linear` timing, and `--chest-shake-{x,y,rot,scale}` vars (x 2→12px, y 0.5→5px, rot 2→14°, scale 1→1.04). `shakeIntensity = (completedCount / total) ** SHAKE_INTENSITY_CURVE` (4) | Feedback: speeding up the shake alone didn't read as more intense — added amplitude, vertical jitter, a scale pulse and more alternations. The `count/total` fraction ⇒ the ramp adapts to a dynamic quest count, and the exponent keeps early quests gentle (e.g. 3/5 ≈ 3.3px, 4/5 ≈ 6.1px) |
| 23 | Underwater backdrop | `UnderwaterBackdrop.tsx` (`z-0`): wavy water-surface band, three blurred sun shafts and a soft spotlight behind the chest, all from `ui-spec.md` §1.2 `brand-*` tokens. Page gradient starts on `brand-track` instead of `brand-bg` | Design request: after removing the bubbles the screen felt too plain; theme is underwater, but no scattered circles. The deeper top gives the white shafts contrast |
| 24 | Panel surface | `MainPanel` `bg-brand-white` → `bg-brand-bg` | Design request: the bottom half looked too plain; uses the spec's "near-white with faint mint tint" surface so the white mission cards read against it |
| 25 | Backend wiring | `MissionsScreen` now runs on `useQuestTracker` (session + `/api/config` + `/api/progress` + offline upload queue + feedback/claim); `useMissionState.ts` and `seed.ts` deleted | Design request: connect the polished frontend to the real backend and camera capture. Replaces the standalone mock simulation |
| 26 | Header date/venue | `event.config.json` gained optional `event_date` / `event_venue`, exposed via `GET /api/config`; `EventHeader.subtitle` is now optional | The header was hardcoded to the mockup's "TechFair 2025 / Aug 28-29"; the config is authoritative |
| 27 | Palette v2 migration | Rewrote `tokens.ts` to the approved hex palette and moved all mission-tracker colors to the `brand-*` namespace (`bg-brand-bg`, `text-brand-ink`, `bg-brand-accent`, …); removed the v1 `teal`/`emerald`/`slate` `theme.extend` overrides. Every attendee-screen component was migrated; `color-scheme` is now `light` globally and re-declared `dark` on the marshal body. Legacy unmounted components (`AttendeeApp`, `QuestCard`, `Chest`) and the marshal UI keep their own palettes | `ui-spec.md` §1.7 marks `teal-*`/`emerald-*`/`slate-*` deprecated in favor of the approved `brand-*` tokens |
| 28 | Bottom seabed | New `Seabed.tsx` rendered inside `MainPanel` at `-z-10`: two long dune waves in `brand-track/50` behind a `brand-accent/20` front dune; `MainPanel` padding `pb-12` → `pb-20` to clear it. Deliberately low-contrast and non-circular | Design request: "add some designs at the bottom". Revisits #21's plain bottom; avoids the rejected bubble/kelp motifs |
| 29 | Survey decoupled from progress | `totalTaskCount`/`computeProgress` now count **photo quests only**; the chest unlocks at N/N quests and `/api/feedback` no longer flips `unlockedAt`. The survey is a separate post-quest step: it auto-opens as `FeedbackModal` once every quest is done, is also a standalone page at `/survey` (same `FeedbackForm` + `POST /api/feedback`), and stays required before claiming (`400 FEEDBACK_REQUIRED`). `ClaimFlow` drops the inline form and gains a "Take the survey" CTA; `claimGate` takes `feedbackRequired`/`feedbackDone` | Product request: the survey must not count towards the progress bar; provide both modal and standalone versions |
| 30 | Reward reveal finale + hand-off | On the **final** quest the chest shakes for `FINALE_SHAKE_DURATION_MS` (900ms) at full strength with the chest held shut, then pops open, holds ~900ms, a `brand-white` overlay flashes (~380ms) and the screen MPA-navigates to `/reward`. `/reward` is now the **single post-completion destination**: `/` also `location.replace`s to it when the session is already complete on load, and the tracker no longer hosts claim/survey. The page renders the one prize's artwork (`loot[0].image`, new optional `image` config field, icon fallback) plus the shared `ClaimFlow`/`FeedbackModal`. Reduced-motion skips straight to `/reward`; the completion transition is derived during render so the chest can't flash open for a frame before the shake | Product request: build suspense on the last quest, flash to a reward page, and route everything there; there is always exactly one prize |

`ui-spec.md` has no typography section. `reference.png` (the conceptual mockup)
lives at the repo root and is the visual basis for the look & feel; it is not
wired into any build step.

---

## 4. Component inventory

### Shell (`src/components/shell/`)

| Component | Purpose | State |
|---|---|---|
| `AppShell.tsx` | Root wrapper + page gradient + overflow clip | ✅ |
| `BackgroundDecor.tsx` | **Removed** — decorative bubbles deleted by design request | ❌ |
| `UnderwaterBackdrop.tsx` | Water surface + sun shafts + hero spotlight behind content (`z-0`) | ✅ |
| `EventHeader.tsx` | Title + subtitle | ✅ |
| `MainPanel.tsx` | Floating rounded panel below hero; hosts the `Seabed` | ✅ |
| `Seabed.tsx` | Soft dune-wave footer at the panel's bottom edge | ✅ |

### Hero (`src/components/hero/`)

| Component | Purpose | State |
|---|---|---|
| `MascotChestHero.tsx` | Chest-only hero (mascot removed by design request); shake + one-shot open | ✅ |

### Primitives (`src/components/primitives/`)

| Component | Notes | State |
|---|---|---|
| `IconTile.tsx` | Fixed `h-10 w-10` dark tile; icon decorative | ✅ |
| `StatusIndicator.tsx` | Status-aware 24px indicator: emerald check / spinner / red alert / gray ring | ✅ |
| `Tab.tsx` | **Removed** — only consumer was `TabSwitcher`; deleted by design request | ❌ |
| `ProgressBar.tsx` | Clamped 0–100, `role="progressbar"`, animated fill | ✅ |
| `MissionText.tsx` | `min-w-0 flex-1` so long text wraps | ✅ |

### Screens (`src/screens/`)

| Component | Purpose | State |
|---|---|---|
| `MissionsScreen.tsx` | Top-level composition, wired to the backend via `useQuestTracker` | ✅ |

### Missions (`src/components/missions/`)

| Component | Notes | State |
|---|---|---|
| `types.ts` | `Mission` / `MissionIcon` UI types, incl. server `QuestStatus` | ✅ |
| `seed.ts` | **Removed** — mock missions replaced by `/api/config` | ❌ |
| `ProgressTracker.tsx` | Label + `ProgressBar`; derives percent | ✅ |
| `TabSwitcher.tsx` | **Removed** — Missions/Event Info tabs deleted by design request | ❌ |
| `MissionRow.tsx` | Full-row `<button>`; opens capture (`todo`) / retries (`failed`), disabled otherwise | ✅ |
| `MissionList.tsx` | `<ul>` of rows; empty state + `isLoading` skeletons | ✅ |
| `MissionRowSkeleton.tsx` | `animate-pulse` placeholder matching row footprint | ✅ |

### Hooks (`src/hooks/`)

| Hook | Notes | State |
|---|---|---|
| `useMissionState.ts` | **Removed** — mock toggle engine replaced by the backend hook | ❌ |
| `useQuestTracker.ts` | Session + config + progress, offline photo staging/retry, chest shake escalation, capture/claim actions | ✅ |

### Survey (`src/components/react/` + `src/pages/`)

| Component | Notes | State |
|---|---|---|
| `FeedbackForm.tsx` | Shared question renderer + `POST /api/feedback` (used by both variants) | ✅ |
| `FeedbackModal.tsx` | Modal wrapper; auto-opens on quest completion, ESC/close dismissible | ✅ |
| `SurveyPage.tsx` | Standalone bootstrap (session/config/progress) + form; success/incomplete/disabled states | ✅ |
| `src/pages/survey.astro` | `/survey` route — the standalone survey form | ✅ |
| `RewardPage.tsx` | `/reward` reveal: single prize artwork (`loot[0].image`) + claim/survey actions; locked before completion | ✅ |
| `src/pages/reward.astro` | `/reward` route — post-finale reward reveal (loot injected server-side) | ✅ |

---

## 5. Verification approach

- **Build/typecheck:** `npm run build`, `npm run typecheck` (Astro check) must be
  clean for every task.
- **Rendered markup:** components are verified by temporary
  `renderToStaticMarkup` (or jsdom + `createRoot` for interactions) vitest
  harnesses, then the harness is deleted. This keeps the tree free of throwaway
  tests while still asserting exact classes/handlers.
- **Compiled CSS:** generated utility rules are grepped out of `dist/` to prove
  the Tailwind config actually emits what components reference.
- **Visual checks** (pixel parity, animation feel) cannot be confirmed headlessly
  and are flagged per task; use the dev server / a phone for those.

---

## 6. Commit log (UI build)

| Commit | Phase/Task |
|---|---|
| `4e972e1` | add techfair ui spec, assets, and tailwind design token config |
| `cc79af9` | add 2.5rem panel radius token for mission tracker |
| `e7e4222` | set system sans base font for mission tracker |
| `7dd7afe` | add chest-shake keyframe utility for mission completion |
| `74feb25` | add pop-in keyframe utility for chest-open transition |
| `67bd5e8` | add shared design tokens and source tailwind theme from them |
| `3855252` | add app shell root wrapper for mission tracker |
| `64f48a1` | add decorative background bubbles to app shell |
| `58aa1b7` | add event header for mission tracker |
| `7c1a5bf` | add mascot and chest hero layout |
| `711dfc5` | add floating main panel container |
| `b3eade1` | compose mission tracker screen scaffold |
| `f5bd9d8` | add icon tile primitive |
| `8bcdaa4` | add mission status indicator primitive |
| `11342a8` | add tab pill primitive |
| `3ffadbd` | add progress bar primitive |
| `8890a46` | add mission text primitive |
| `c890c85` | add ui build notes documenting decisions and component inventory |
| `3094aae` | add progress tracker composite |
| `04c061f` | add tab switcher composite |
| `e09a86a` | add mission row composite with shared ui mission type |
| `cfae5c4` | add mission list and seeded missions |
| `ccc8eba` | add mission state hook with shake sequencing |
| `5b093df` | latch all-complete state permanently on final mission |
| `d0e976f` | wire mascot chest hero to shake state with flicker-free cross-fade |
| `5955bae` | add permanent chest-open and excited mascot state |
| `93c8b0b` | assemble mission tracker screen with full state wiring (Phase 4 complete) |
| `a899b01` | update ui build notes for phase 4 |
| `fe41fc5` | add mission list empty state |
| `4debcf6` | add mission row skeleton loading state |
| `adad6e4` | cap content width on wide viewports |
| `9028eaf` | add touch and keyboard accessibility to tabs and mission rows |
| `d6d76e4` | complete final visual qa pass and document open items (Phase 5 complete) |
| `03f1b26` | mount mission tracker screen at / |
| `c78916a` | enlarge chest and drop mascot from hero |
| `b6969d4` | scale chest shake strength with completion progress |
| `7c25b39` | remove mission and event info tabs |
| `f7eba3b` | polish mission tracker UI and add underwater backdrop |

---

## 7. Open items / follow-ups

- **Mockup raster:** `reference.png` is now at the repo root and is the basis
  for the look & feel, but it has not been committed. The earlier
  "pixel-for-pixel" comparisons were verified structurally (class tokens +
  compiled CSS), not by pixel diff.
- **Mascot removed from the hero** by design request. `mascot-idle.png` is still
  used by the `MissionList` empty state; `mascot-surprised.png` is now unused.
  Re-adding the mascot (or moving it beside the chest) is a small change to
  `MascotChestHero.tsx`.
- **`chest-closed.png` naming** — the repo ships `chest-locked.png`; the code
  uses the existing filename.
- **Wired to the backend (deviation #25):** header, quests, progress, uploads,
  feedback and claim now come from `GET /api/config` / `/api/progress` and the
  offline upload queue. `useQuestTracker` is the single integration point.
- `MissionsScreen` is mounted at `/` (`src/pages/index.astro`, `client:load`),
  replacing the earlier `AttendeeApp`. `BaseLayout` gained an optional
  `bodyClass` so this light screen isn't forced onto the dark body used by the
  marshal pages.
- **Legacy `AttendeeApp`** (dark theme) is still in the tree and covered by
  `tests/unit/attendeeApp.test.tsx`, but is no longer mounted. It can be removed
  along with its test and `QuestCard.tsx` once nothing references it.
- **Camera capture** uses a hidden `<input type="file" accept="image/*"
  capture="environment">` — phones open the native camera, desktop falls back to
  a file picker. A live `getUserMedia` preview is not implemented.
- **Prize artwork:** `event.config.json` points the single loot item at
  `/assets/prize.png`, which is **not in the repo yet**. Until it's added,
  `/reward` falls back to a `Gift` icon (`PrizeArt`'s `onError`). Drop the final
  prize image at `public/assets/prize.png` (or change the `image` field).
