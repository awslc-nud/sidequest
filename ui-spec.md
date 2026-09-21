# UI Spec — TechFair 2025 Mission Tracker

**Source:** Conceptual mockup (mobile, single-screen mission tracker with mascot/chest reward mechanic)
**Status:** Implementation-ready reference for `ui-tasks.md`
**Palette version:** v2 — updated to match approved brand color tokens

---

## 1. Design Tokens

### 1.1 Approved Brand Colors (source of truth)

These are the exact tokens from the approved palette. Every UI color in this spec must map to one of these — no ad hoc hex values elsewhere.

| Token Name | Hex | Swatch | Notes |
|---|---|---|---|
| Background | `#EDF7F9` | pale mint | Page/app background |
| Primary Text | `#000000` | black | Headings, high-emphasis text |
| Secondary Text | `#7B7B7B` | gray | Muted/supporting text |
| Secondary Accent | `#64CCC3` | teal | Primary interactive accent (active states, fills) |
| Third Accent | `#C8EDED` | pale teal | Unfilled tracks, soft highlight backgrounds |
| Color (Deep Accent) | `#175750` | deep teal-green | Dark surfaces (icon tiles), high-contrast accent |
| White | `#FFFFFF` | white | Card/surface background |
| Orange | `#FF8E04` | orange | Reserved: alerts / warning / attention states |
| Secondary Orange | `#FFE4C4` | pale orange | Reserved: soft warning background |

> Orange / Secondary Orange are not used by any element in the current mockup. They're captured here as approved tokens for future states (e.g. an "urgent mission" badge or error state) so the agent doesn't invent an off-palette color if that need comes up.

### 1.2 Tailwind Config — Custom Color Extension

Since these hex values don't map cleanly to Tailwind's default palette, register them as named `brand-*` tokens rather than using default color names (`teal-*`, `slate-*`, `emerald-*` are **deprecated** for this project as of v2 — do not use them going forward).

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#EDF7F9',
          ink: '#000000',
          muted: '#7B7B7B',
          accent: '#64CCC3',
          track: '#C8EDED',
          deep: '#175750',
          white: '#FFFFFF',
          orange: '#FF8E04',
          'orange-soft': '#FFE4C4',
        },
      },
    },
  },
};
```

### 1.3 Semantic Role → Tailwind Class Mapping

| Role | Description | Token | Tailwind Class |
|---|---|---|---|
| Page background | Flat pale mint (no gradient in v2 — see note below) | Background | `bg-brand-bg` |
| Header text (title) | High-emphasis heading | Primary Text | `text-brand-ink` |
| Header subtext (date/location) | Muted supporting text | Secondary Text | `text-brand-muted` |
| Card/Surface background | White cards floating on mint background | White | `bg-brand-white` |
| Icon tile background | Dark deep-teal square | Color (Deep Accent) | `bg-brand-deep` |
| Icon tile foreground | Icon on dark tile | White | `text-brand-white` |
| Primary accent (active tab, progress fill, checkmark) | Teal accent | Secondary Accent | `bg-brand-accent` / `text-brand-accent` |
| Progress track (unfilled) | Pale teal | Third Accent | `bg-brand-track` |
| Inactive tab background | Neutral, recedes behind active tab | White | `bg-brand-white` |
| Inactive tab text | Muted | Secondary Text | `text-brand-muted` |
| Mission title text | High-emphasis | Primary Text | `text-brand-ink` |
| Mission description text (muted) | Supporting | Secondary Text | `text-brand-muted` |
| Incomplete status ring | Soft, low-emphasis outline | Third Accent | `text-brand-track` (or `text-brand-muted` if track color reads too faint against white — verify in browser) |
| Complete status fill | Filled checkmark | Secondary Accent | `text-brand-accent` (fill), `text-brand-white` (check glyph) |
| Decorative bubbles | Translucent teal circles | Secondary Accent / Third Accent | `bg-brand-accent/20`, `bg-brand-track/50` |
| Reserved: alert/urgent badge | Not in current mockup | Orange | `bg-brand-orange text-brand-white` |
| Reserved: soft warning background | Not in current mockup | Secondary Orange | `bg-brand-orange-soft` |

> **Background change from v1:** the original spec used a `from-teal-50 via-emerald-50 to-white` gradient. The approved palette defines a single flat `Background` value (`#EDF7F9`), so v2 uses a **flat background** (`bg-brand-bg`) instead of a gradient. If a gradient is still desired for visual depth, it should be a subtle `bg-brand-bg` → `bg-brand-white` gradient (`bg-gradient-to-b from-brand-bg to-brand-white`) — flag to design for a decision before implementing either way.

### 1.4 Radius / Elevation / Spacing

*(Unchanged from v1 — not color-related.)*

| Token | Value |
|---|---|
| Card radius | `rounded-2xl` (mission rows), `rounded-3xl` (top panel container) |
| Icon tile radius | `rounded-xl` |
| Tab pill radius | `rounded-full` |
| Progress bar radius | `rounded-full` |
| Card shadow | `shadow-sm` (mission rows), `shadow-md` on the whole panel that overlaps the mascot |
| Vertical spacing between mission rows | `space-y-3` |
| Card internal padding | `p-4` |
| Section padding (screen) | `px-4 pt-6 pb-8` |

---

## 2. Layout Skeleton

```
<div class="relative min-h-screen bg-brand-bg overflow-hidden">

  <!-- Decorative background bubbles (absolute positioned, behind content) -->
  <div class="absolute inset-0 pointer-events-none">
    <!-- e.g. <div class="bg-brand-accent/20 rounded-full ..." /> -->
    <!-- e.g. <div class="bg-brand-track/50 rounded-full ..." /> -->
  </div>

  <!-- Header -->
  <header class="relative z-10 text-center pt-8 pb-2">
    <h1 class="text-brand-ink">TechFair 2025</h1>
    <p class="text-brand-muted">Aug 28 - 29, 2025 • Main Campus</p>
  </header>

  <!-- Mascot + Chest hero zone -->
  <div class="relative z-10 flex justify-center items-center h-40">
    <img mascot />
    <img chest class="absolute" />
  </div>

  <!-- Floating panel (overlaps hero zone, rounded top, sits over rest of screen) -->
  <main class="relative z-20 -mt-6 bg-brand-white rounded-t-[2.5rem] shadow-md px-4 pt-6 pb-10 min-h-[60vh]">

    <!-- Progress -->
    <section class="flex flex-col items-center mb-4">
      <span class="text-sm text-brand-muted mb-2">2 / 5 completed</span>
      <div class="w-full h-2 bg-brand-track rounded-full">
        <div class="h-2 bg-brand-accent rounded-full" style="width: 40%" />
      </div>
    </section>

    <!-- Tabs -->
    <nav class="flex gap-2 mb-4">
      <button class="flex-1 py-2 rounded-full bg-brand-deep text-brand-white">Missions</button>
      <button class="flex-1 py-2 rounded-full bg-brand-white text-brand-muted border border-brand-track">Event Info</button>
    </nav>

    <!-- Mission List -->
    <ul class="flex flex-col space-y-3">
      <!-- MissionRow x5 -->
    </ul>

  </main>
</div>
```

**Structural notes:**
- Single-column mobile flow (`flex flex-col`), no sidebar.
- Mascot/chest hero sits in normal flow but the white panel below uses a **negative margin** (`-mt-6` or similar) to visually tuck under/overlap the hero bubbles.
- Mission list is a simple vertical stack, not a grid.
- Inactive tab now uses a thin `border-brand-track` since a flat white-on-white background alone gives too little separation from the panel behind it — verify visually and drop the border if it reads fine without one.

---

## 3. Component Hierarchy

```
<TechFairScreen>
├── <BackgroundDecor>              (state: static, decorative only)
├── <EventHeader>
│   ├── title: "TechFair 2025"
│   └── subtitle: "Aug 28 - 29, 2025 • Main Campus"
├── <MascotChestHero>
│   ├── <MascotImage>              (states: idle | surprised | excited/waving)
│   └── <ChestImage>               (states: closed | shaking | open)
├── <MainPanel>                     (rounded top container, contains everything below)
│   ├── <ProgressTracker>
│   │   ├── <ProgressLabel>         text: "{completedCount} / {total} completed"
│   │   └── <ProgressBar>
│   │       └── <ProgressFill>      (width: dynamic %, state: partial | full)
│   ├── <TabSwitcher>
│   │   ├── <Tab label="Missions">  (states: active | inactive)
│   │   └── <Tab label="Event Info"> (states: active | inactive)
│   └── <MissionList>
│       └── <MissionRow> (x5, repeatable)
│           ├── <IconTile>          (dark square, bg-brand-deep, holds Lucide icon)
│           ├── <MissionText>
│           │   ├── <MissionTitle>       (text-brand-ink)
│           │   └── <MissionDescription> (text-brand-muted)
│           └── <StatusIndicator>   (states: complete=CheckCircle2 text-brand-accent | incomplete=Circle text-brand-track)
```

**States per component:**
- `MascotImage`: `idle` (default) → `surprised` (during 500ms single-mission shake) → back to `idle`; permanently `excited/waving` once `isAllCompleted`.
- `ChestImage`: `closed` (default) → `shaking` (CSS animation class applied, same image) → back to `closed`; permanently swaps to `open` asset once `isAllCompleted`.
- `MissionRow`: `default` (unchecked) / `completed` (checked, dims description slightly — optional).
- `MissionList` empty state: not shown in mockup, but included for robustness ("No missions yet").
- `TabSwitcher`: `Missions` active by default; `Event Info` renders alternate content (placeholder, content out of scope here).

---

## 4. Raw Assets & Icons

### 4.1 Lucide-react Icon Mapping

| Visual in mockup | Lucide Icon | Usage | Color class |
|---|---|---|---|
| Camera icon (4 of 5 mission rows) | `Camera` | IconTile for photo-based missions | `text-brand-white` on `bg-brand-deep` |
| Two-person silhouette icon ("New Friend" row) | `Users` | IconTile for social mission | `text-brand-white` on `bg-brand-deep` |
| Filled green check circle | `CheckCircle2` | StatusIndicator — completed | `text-brand-accent` |
| Empty gray ring | `Circle` | StatusIndicator — incomplete | `text-brand-track` |

### 4.2 Custom Image Assets (provided)

| Asset | Used for | Suggested display size |
|---|---|---|
| `/assets/mascot-idle.png` | Default mascot state | ~140×140px container |
| `/assets/mascot-surprised.png` | Mascot during single-mission shake (500ms) | Same as idle, swapped in place |
| `/assets/chest-closed.png` | Default chest state | ~110×90px, centered in mascot's arms |
| `/assets/chest-open.png` | Final all-complete state | Same footprint as closed; scale-in on swap |

> **Asset gap:** No distinct "excited/waving" mascot asset is provided. Either reuse `mascot-idle.png` with a CSS bounce/wave treatment for the all-complete state, or request a dedicated `mascot-excited.png` before implementation.

---

## 5. Interactive State Logic

```ts
interface Mission {
  id: string;
  title: string;
  description: string;
  icon: 'camera' | 'users';
  completed: boolean;
}

state:
  missions: Mission[]
  isShaking: boolean        // true for 500ms after any single toggle-to-complete
  isAllCompleted: boolean   // derived = missions.every(m => m.completed)

derived:
  completedCount = missions.filter(m => m.completed).length
  progressPercent = (completedCount / missions.length) * 100
```

**Seed data (matches mockup):**

| Title | Description | Icon | Initial state |
|---|---|---|---|
| Arrival Moment | Take a photo of yourself at the event venue! | Camera | completed |
| Stage Slide | Capture a photo of a slide from the main stage. | Camera | completed |
| New Friend | Snap a photo with someone new today! | Users | incomplete |
| Event Merch | Take a photo of the event merchandise! | Camera | incomplete |
| Crowd Reaction | Capture the energy of the crowd! | Camera | incomplete |

---

## 6. Animation & Visual Rules

| Trigger | Chest | Mascot | Duration |
|---|---|---|---|
| Single mission checked (not last) | `chest-closed.png` + `animate-shake` keyframe (rapid rotate/translate vibration, e.g. ±3° / ±2px) | Swap to `mascot-surprised.png` + small jump (`translateY` bounce) | 500ms, then revert both to default/idle |
| Last mission checked → `isAllCompleted = true` | Swap `chest-closed.png` → `chest-open.png` permanently, with `scale(0.7 → 1.05 → 1)` pop-in | Switch to excited/waving state permanently | ~400ms pop transition, no revert |
| Progress bar update | `bg-brand-accent` fill | — | Fill width animates via CSS `transition: width 300ms ease-out` on every toggle |

**Suggested keyframe:**

```css
@keyframes chest-shake {
  0%, 100% { transform: translateX(0) rotate(0); }
  25%      { transform: translateX(-2px) rotate(-3deg); }
  75%      { transform: translateX(2px) rotate(3deg); }
}
```

Applied via a conditional class (`isShaking && 'animate-chest-shake'`) rather than always-on.

**Behavioral edge cases:**
- Un-checking a mission does **not** trigger the shake sequence — shake fires only on a completion (false → true) transition.
- The final mission's completion transition skips the shake path entirely and goes straight to the permanent "all completed" state (chest-open + excited mascot); the two states are mutually exclusive, not sequential.
- `isAllCompleted` does not reset if a mission is later un-checked, unless the product decision is to make it reversible — flag this to product before implementation if reversibility is required.

---

## 7. Migration Notes (v1 → v2)

- All `teal-*`, `emerald-*`, `slate-*` default-Tailwind class references from v1 are replaced with `brand-*` custom tokens throughout this document and `ui-tasks.md` should be updated to match before the agent starts Phase 1.
- Page background changed from a 3-stop gradient to a flat `bg-brand-bg` (see §1.3 note) — confirm with design before implementation if the gradient look is still wanted.
- Icon tile dark background changed from generic `slate-900` (near-black) to the on-brand deep teal `#175750` (`bg-brand-deep`) — this is a visible color shift from the original mockup screenshot and should be visually confirmed against final design intent, not just against the old spec.
