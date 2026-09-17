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
src/styles/tokens.ts   ←─ raw values (oklch, rem) matching ui-spec.md §1.1–1.2
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
| 13 | Responsive cap location | Non-positioned `mx-auto max-w-md` wrapper inside `AppShell` | Keeps content card-width on desktop while `BackgroundDecor`'s `absolute inset-0` still resolves against the positioned root and spans the viewport |
| 14 | Keyboard semantics | `role="checkbox"` + Enter/Space on rows | Follows task 62; rows are `tabIndex=0` with `focus-visible` ring |
| 15 | Hero layout | Mascot removed; chest-only, hero `h-48`, chest `h-32 w-52` | Design request (post-roadmap). Differs from `ui-spec.md` §2 (chest in mascot's arms) |
| 16 | Shake strength | Escalates with `completedCount / total`; keyframe reads `--chest-shake-x/-rot` (2→8px, 3→12°) set inline | "Every mission done shakes harder", normalized to the dynamic mission total |

`ui-spec.md` has no typography section and no mockup raster is checked in — both
are open items if pixel-perfect parity is required.

---

## 4. Component inventory

### Shell (`src/components/shell/`)

| Component | Purpose | State |
|---|---|---|
| `AppShell.tsx` | Root wrapper + page gradient + overflow clip | ✅ |
| `BackgroundDecor.tsx` | Decorative translucent bubbles (`aria-hidden`, `pointer-events-none`) | ✅ |
| `EventHeader.tsx` | Title + subtitle | ✅ |
| `MainPanel.tsx` | Floating rounded panel below hero | ✅ |

### Hero (`src/components/hero/`)

| Component | Purpose | State |
|---|---|---|
| `MascotChestHero.tsx` | Chest-only hero (mascot removed by design request); shake + one-shot open | ✅ |

### Primitives (`src/components/primitives/`)

| Component | Notes | State |
|---|---|---|
| `IconTile.tsx` | Fixed `h-10 w-10` dark tile; icon decorative | ✅ |
| `StatusIndicator.tsx` | `CheckCircle2` / `Circle`, both 24px | ✅ |
| `Tab.tsx` | Pill button; `focus-visible` ring; `aria-pressed` deferred to Phase 5 | ✅ |
| `ProgressBar.tsx` | Clamped 0–100, `role="progressbar"`, animated fill | ✅ |
| `MissionText.tsx` | `min-w-0 flex-1` so long text wraps | ✅ |

### Screens (`src/screens/`)

| Component | Purpose | State |
|---|---|---|
| `MissionsScreen.tsx` | Top-level composition, wired to `useMissionState` | ✅ |

### Missions (`src/components/missions/`)

| Component | Notes | State |
|---|---|---|
| `types.ts` | `Mission` / `MissionIcon` UI types (ui-spec §5) | ✅ |
| `seed.ts` | The 5 mockup missions (2/5 complete) | ✅ |
| `ProgressTracker.tsx` | Label + `ProgressBar`; derives percent | ✅ |
| `TabSwitcher.tsx` | Owns `activeTab`, swaps Missions/Event Info panels | ✅ |
| `MissionRow.tsx` | Tappable card; `role="checkbox"`/`aria-checked`, keyboard operable | ✅ |
| `MissionList.tsx` | `<ul>` of rows; empty state + `isLoading` skeletons | ✅ |
| `MissionRowSkeleton.tsx` | `animate-pulse` placeholder matching row footprint | ✅ |

### Hooks (`src/hooks/`)

| Hook | Notes | State |
|---|---|---|
| `useMissionState.ts` | Missions, `isShaking` (500ms), latched `isAllCompleted`, derived counts, `toggleMission` | ✅ |

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

---

## 7. Open items / follow-ups

- **No mockup raster** is checked into the repo, so the "pixel-for-pixel"
  comparisons requested by several tasks were verified structurally (class
  tokens + compiled CSS), not by pixel diff. A `<2px` parity check needs the
  original mockup.
- **Mascot removed from the hero** by design request. `mascot-idle.png` is still
  used by the `MissionList` empty state; `mascot-surprised.png` is now unused.
  Re-adding the mascot (or moving it beside the chest) is a small change to
  `MascotChestHero.tsx`.
- **`chest-closed.png` naming** — the repo ships `chest-locked.png`; the code
  uses the existing filename.
- `GET /api/config` is not wired to the header/missions (hardcoded to the
  mockup). This mission tracker is a standalone UI simulation of the seeded
  data; reconciling it with the server progress API is outside `ui-tasks.md`.
- `MissionsScreen` is mounted at `/` (`src/pages/index.astro`, `client:load`),
  replacing the earlier `AttendeeApp`. `BaseLayout` gained an optional
  `bodyClass` so this light screen isn't forced onto the dark body used by the
  marshal pages.
- **Header copy mismatch:** the page header is the mockup's "TechFair 2025",
  while `event.config.json` / the document title say "Tech Summit 2026". Wire the
  header to `GET /api/config` (or event config props) if they should match.
