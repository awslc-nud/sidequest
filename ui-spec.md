# UI Spec — TechFair 2025 Mission Tracker

**Source:** Conceptual mockup (mobile, single-screen mission tracker with mascot/chest reward mechanic)
**Status:** Implementation-ready reference for `ui-tasks.md`

---

## 1. Design Tokens

### 1.1 Color Palette → Tailwind Mapping

| Role | Description | Tailwind Class |
|---|---|---|
| Page background | Soft mint-to-white vertical gradient | `bg-gradient-to-b from-teal-50 via-emerald-50 to-white` |
| Header text (title) | Deep slate/navy | `text-slate-800` |
| Header subtext (date/location) | Muted slate | `text-slate-500` |
| Card/Surface background | Near-white with faint mint tint | `bg-white/90` or `bg-teal-50/40` |
| Card border (subtle) | None visible; rely on shadow | — |
| Icon tile background | Very dark navy, almost black | `bg-slate-900` |
| Icon tile foreground | White icon | `text-white` |
| Primary accent (active tab, progress fill, checkmark) | Deep teal/emerald | `bg-teal-700` / `bg-emerald-500` |
| Progress track (unfilled) | Pale mint | `bg-teal-100` |
| Inactive tab background | Light mint-gray | `bg-slate-100` |
| Inactive tab text | Slate | `text-slate-600` |
| Mission title text | Dark slate | `text-slate-800` |
| Mission description text (muted) | Gray | `text-slate-400` |
| Incomplete status ring | Light gray outline | `text-gray-300` |
| Complete status fill | Green/teal filled circle | `text-emerald-500` (fill), `text-white` (check) |
| Decorative bubbles | Translucent teal circles | `bg-teal-200/40`, `bg-teal-300/30` |

### 1.2 Radius / Elevation / Spacing

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
<div class="relative min-h-screen bg-gradient-to-b from-teal-50 via-emerald-50 to-white overflow-hidden">

  <!-- Decorative background bubbles (absolute positioned, behind content) -->
  <div class="absolute inset-0 pointer-events-none">...bubble divs...</div>

  <!-- Header -->
  <header class="relative z-10 text-center pt-8 pb-2">
    <h1>TechFair 2025</h1>
    <p>Aug 28 - 29, 2025 • Main Campus</p>
  </header>

  <!-- Mascot + Chest hero zone -->
  <div class="relative z-10 flex justify-center items-center h-40">
    <img mascot />
    <img chest class="absolute" />
  </div>

  <!-- Floating panel (overlaps hero zone, rounded top, sits over rest of screen) -->
  <main class="relative z-20 -mt-6 bg-white rounded-t-[2.5rem] shadow-md px-4 pt-6 pb-10 min-h-[60vh]">

    <!-- Progress -->
    <section class="flex flex-col items-center mb-4">
      <span class="text-sm text-slate-600 mb-2">2 / 5 completed</span>
      <div class="w-full h-2 bg-teal-100 rounded-full">
        <div class="h-2 bg-emerald-500 rounded-full" style="width: 40%" />
      </div>
    </section>

    <!-- Tabs -->
    <nav class="flex gap-2 mb-4">
      <button class="flex-1 py-2 rounded-full bg-teal-800 text-white">Missions</button>
      <button class="flex-1 py-2 rounded-full bg-slate-100 text-slate-600">Event Info</button>
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
│           ├── <IconTile>          (dark square, holds Lucide icon)
│           ├── <MissionText>
│           │   ├── <MissionTitle>
│           │   └── <MissionDescription>
│           └── <StatusIndicator>   (states: complete=CheckCircle2 filled | incomplete=Circle outline)
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

| Visual in mockup | Lucide Icon | Usage |
|---|---|---|
| Camera icon (4 of 5 mission rows) | `Camera` | IconTile for photo-based missions |
| Two-person silhouette icon ("New Friend" row) | `Users` | IconTile for social mission |
| Filled green check circle | `CheckCircle2` | StatusIndicator — completed |
| Empty gray ring | `Circle` | StatusIndicator — incomplete |

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
| Progress bar update | — | — | Fill width animates via CSS `transition: width 300ms ease-out` on every toggle |

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
