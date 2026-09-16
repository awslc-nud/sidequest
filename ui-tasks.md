# UI Build Checklist — TechFair Mission Tracker

**Source docs:** `ui-spec.md` (design tokens, layout tree, component hierarchy), `spec.md` (system contracts)
**Assets:** `public/assets/mascot-idle.png`, `public/assets/mascot-surprised.png`, `public/assets/chest-closed.png`, `public/assets/chest-open.png`
**Icons:** `lucide-react` → `Camera`, `Users`, `CheckCircle2`, `Circle`

> Note on phase naming: this build is a single-column mobile screen, not a sidebar/dashboard layout. Phase 2 below substitutes "fixed sidebar / top command bar" with this project's actual shell primitives (hero zone + floating panel), per the component hierarchy already agreed in `ui-spec.md`. All other phase intents (scaffolding → primitives → composites → polish) are preserved.

---

## Phase 1: Design Tokens & Tailwind Base Setup

- [x] Create `tailwind.config.js` theme extension block with custom color tokens: `teal-800` (tab active / primary accent), `emerald-500` (progress fill / success), `teal-100` (progress track), `slate-800` (headings), `slate-500`/`slate-400` (muted text). Verify: run `npx tailwindcss --help` build with no errors and tokens resolve in a throwaway `<div className="bg-teal-800">`.
- [x] Add custom border radius scale to `tailwind.config.js` if `rounded-3xl`/`rounded-[2.5rem]` values from `ui-spec.md` aren't covered by default Tailwind scale (add `borderRadius: { 'panel': '2.5rem' }`). Verify: inspect a test div and confirm computed `border-radius` matches spec value.
- [x] Create `src/styles/globals.css` and import Tailwind base/components/utilities. Set base `font-family` (per `ui-spec.md` typography) on `body`. Verify: default page renders with correct font, no FOUC.
- [x] Add custom keyframe utility `chest-shake` to `tailwind.config.js` `extend.keyframes`/`extend.animation` (±3° rotate / ±2px translate, per spec's rapid vibration rule). Name the animation class `animate-chest-shake`. Verify: apply class to a placeholder `<div>` and visually confirm rapid side-to-side wobble.
- [x] Add custom `pop-in` scale keyframe utility (`scale(0.7 → 1.05 → 1)`) named `animate-pop-in` for the chest-open transition. Verify: apply to a placeholder image and confirm smooth overshoot-then-settle scale animation (~400ms).
- [x] Create `src/styles/tokens.ts` exporting named constants for colors/spacing/radius used outside Tailwind (e.g., inline SVG fills, JS-driven width %). Verify: import into a scratch component and confirm values match `ui-spec.md` table exactly (no hex drift).

---

## Phase 2: Shell & Global Scaffolding

- [x] Create `src/components/shell/AppShell.tsx`. Root wrapper: `relative min-h-screen bg-gradient-to-b from-teal-50 via-emerald-50 to-white overflow-hidden`. Accepts children. Verify: page fills full viewport height with no gradient banding or horizontal scroll at 375px width.
- [x] Create `src/components/shell/BackgroundDecor.tsx`. Absolutely-positioned decorative bubble `<div>`s using `bg-teal-200/40` and `bg-teal-300/30`, `rounded-full`, positioned per mockup corners. Set `pointer-events-none` and `aria-hidden="true"`. Verify: bubbles render behind content (`z-0`) and don't block taps on real UI.
- [x] Create `src/components/shell/EventHeader.tsx`. Renders title (`text-slate-800`, bold, centered) and subtitle (`text-slate-500`, smaller). Props: `title: string`, `subtitle: string`. Verify: text matches "TechFair 2025" / "Aug 28 - 29, 2025 • Main Campus" pixel-for-pixel against mockup spacing (`pt-8 pb-2`).
- [x] Create `src/components/hero/MascotChestHero.tsx` as a layout-only container: `relative z-10 flex justify-center items-center h-40`. Renders `<img>` slots for mascot and chest (logic wired in Phase 4). No animation logic yet — static `mascot-idle.png` + `chest-closed.png`. Verify: both images render centered, chest visually overlaps mascot's arms per mockup.
- [x] Create `src/components/shell/MainPanel.tsx`. Floating rounded container: `relative z-20 -mt-6 bg-white rounded-t-panel shadow-md px-4 pt-6 pb-10 min-h-[60vh]`. Accepts children. Verify: panel visually tucks under the hero bubbles with correct negative-margin overlap, no z-index clipping of mascot.
- [x] Wire `AppShell > BackgroundDecor + EventHeader + MascotChestHero + MainPanel` together in `src/screens/MissionsScreen.tsx` as the top-level composition (empty `MainPanel` for now). Verify: full page scaffold matches mockup silhouette with placeholder content, scrolls only within `MainPanel` if content overflows (`overflow-y-auto` if needed), body itself does not scroll horizontally.

---

## Phase 3: Primitives & Atoms

- [x] Create `src/components/primitives/IconTile.tsx`. Dark square tile: `bg-slate-900 rounded-xl p-2 flex items-center justify-center`, renders a passed Lucide icon component at `text-white` with fixed size (e.g. `size={20}`). Props: `icon: LucideIcon`. Verify: renders `Camera` and `Users` icons both centered and equal tile dimensions (no jitter between icon types).
- [x] Create `src/components/primitives/StatusIndicator.tsx`. Props: `completed: boolean`. Renders `CheckCircle2` (`text-emerald-500`, filled look) when `completed`, else `Circle` (`text-gray-300`, outline). Verify: toggling the prop in Storybook/dev harness swaps icon instantly with no layout shift (same bounding box size for both icons).
- [x] Create `src/components/primitives/Tab.tsx`. Props: `label: string`, `active: boolean`, `onClick`. Active: `bg-teal-800 text-white`; inactive: `bg-slate-100 text-slate-600`. Shared: `flex-1 py-2 rounded-full text-center transition-colors`. Verify: click toggles active styling with smooth color transition; keyboard focus ring visible (`focus-visible:ring-2`).
- [ ] Create `src/components/primitives/ProgressBar.tsx`. Props: `percent: number` (0–100). Track: `w-full h-2 bg-teal-100 rounded-full`. Fill: `h-2 bg-emerald-500 rounded-full transition-all duration-300 ease-out`, `style={{ width: \`${percent}%\` }}`. Verify: set percent to 0, 40, 100 in isolation and confirm fill width animates smoothly and never overflows track at 100%.
- [ ] Create `src/components/primitives/MissionText.tsx`. Renders `title` (`text-slate-800` font-medium) and `description` (`text-slate-400` text-sm) stacked vertically (`flex flex-col`). Verify: long description text wraps within row without pushing IconTile or StatusIndicator out of alignment.

---

## Phase 4: Composite Widgets & Main Canvas

- [ ] Create `src/components/missions/ProgressTracker.tsx`. Composes label (`"{completed} / {total} completed"`, `text-sm text-slate-600`) above `ProgressBar`. Props: `completed: number`, `total: number`. Derives `percent = (completed/total)*100`. Verify: label text and bar fill stay in sync when `completed` changes; matches "2 / 5 completed" at 40% fill from mockup.
- [ ] Create `src/components/missions/TabSwitcher.tsx`. Composes two `Tab` primitives ("Missions", "Event Info") in a `flex gap-2` row, manages `activeTab` state, exposes `onChange`. Verify: exactly one tab active at a time; switching to "Event Info" swaps rendered panel content (placeholder acceptable if Event Info content is out of scope per `spec.md`).
- [ ] Create `src/components/missions/MissionRow.tsx`. Composes `IconTile + MissionText + StatusIndicator` in `flex items-center justify-between gap-3 p-4 bg-white rounded-2xl shadow-sm`. Props: `mission: Mission`, `onToggle: (id) => void`. Row is clickable/tappable to toggle completion. Verify: clicking row toggles `StatusIndicator` state and fires `onToggle` with correct mission id; row hit-area covers full card, not just the checkbox icon.
- [ ] Create `src/components/missions/MissionList.tsx`. Renders array of `MissionRow` in `flex flex-col space-y-3` inside a `<ul>`. Props: `missions: Mission[]`, `onToggle`. Verify: renders all 5 seeded missions ("Arrival Moment", "Stage Slide", "New Friend", "Event Merch", "Crowd Reaction") with correct icon per mission (`Camera` x4, `Users` x1) and correct initial completed states (2 completed, 3 not, per mockup).
- [ ] Create `src/hooks/useMissionState.ts`. Implements the state contract from `spec.md`: `missions: Mission[]`, `isShaking: boolean`, derived `isAllCompleted`, derived `completedCount`/`progressPercent`. `toggleMission(id)` sets `isShaking = true` for 500ms via `setTimeout` on any single completion (not on un-checking, not when it's the final mission — see next task). Verify: unit-test-style manual check — toggling one mission (not the last) flips `isShaking` true then false after ~500ms; state updates are immutable (no direct array mutation).
- [ ] Extend `useMissionState.ts`: when a toggle causes `missions.every(m => m.completed)` to become true, skip the shake path and instead set a permanent `isAllCompleted = true` flag (does not reset on timer). Verify: completing the 5th mission does *not* trigger `isShaking`; `isAllCompleted` stays true even after further re-renders.
- [ ] Wire `MascotChestHero.tsx` to `useMissionState`: swap `mascot-idle.png` ↔ `mascot-surprised.png` based on `isShaking`, apply `animate-chest-shake` to the chest `<img>` conditionally on `isShaking`, apply small bounce (`translateY`) to mascot `<img>` conditionally on `isShaking`. Verify: toggling a non-final mission produces a visible ~500ms combo of chest wobble + mascot swap + jump, then both revert cleanly to idle state with no flicker.
- [ ] Extend `MascotChestHero.tsx`: when `isAllCompleted` is true, permanently render `chest-open.png` with `animate-pop-in` applied once (not looping), and keep mascot in an "excited" visual treatment (reuse `mascot-idle.png` with a CSS bounce/wave class, or swap to `mascot-excited.png` — flag to design if this asset doesn't exist yet, see `ui-spec.md` asset gap note). Verify: completing all 5 missions permanently swaps chest asset with a pop/scale effect that plays exactly once; reloading state (if persisted) does not replay the pop animation.
- [ ] Assemble `src/screens/MissionsScreen.tsx` fully: wire `useMissionState` output into `ProgressTracker`, `TabSwitcher`, `MissionList`, and `MascotChestHero`. Verify: end-to-end flow — checking missions 1–4 updates progress bar/counter and triggers per-mission shake; checking mission 5 shows "5 / 5 completed", 100%-filled bar, and permanent chest-open/mascot-excited state.

---

## Phase 5: View States & Polish

- [ ] Add empty state to `MissionList.tsx`: when `missions.length === 0`, render a centered fallback message ("No missions yet") plus `mascot-idle.png` at reduced opacity, instead of an empty `<ul>`. Verify: pass `missions={[]}` in dev harness and confirm no layout collapse or broken icon tiles.
- [ ] Create `src/components/missions/MissionRowSkeleton.tsx`: loading placeholder matching `MissionRow` dimensions using `animate-pulse` and `bg-slate-100` blocks for icon/title/description regions. Wire into `MissionList` behind an `isLoading` prop (render 5 skeleton rows). Verify: skeleton row height/padding exactly matches real `MissionRow` to prevent layout jump when real data loads.
- [ ] Add responsive adjustments to `AppShell.tsx`/`MainPanel.tsx`: cap max content width on tablet/desktop viewports (e.g., `max-w-md mx-auto`) so the mobile-first layout doesn't stretch full-bleed on wide screens. Verify: resize viewport to 768px and 1280px — content stays centered at mobile-card width, background gradient/bubbles still fill full viewport behind it.
- [ ] Polish `Tab.tsx` and `MissionRow.tsx` for touch/keyboard accessibility: ensure minimum 44px tap target height, add `aria-pressed` on tabs and `role="checkbox"` + `aria-checked` on mission rows. Verify: tab through the page with keyboard only — all tabs and mission rows are reachable and their toggle state is announced correctly (test with a screen reader or accessibility inspector).
- [ ] Final visual QA pass against `ui-spec.md`: compare rendered screen side-by-side with original mockup for color accuracy, spacing (`space-y-3`, `p-4`), radius (`rounded-2xl`/`rounded-t-panel`), and shadow depth. Verify: no pixel-level drift greater than ~2px on card padding/radius; all icons and assets load from `public/assets/` with correct alt text set.
