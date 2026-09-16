/**
 * Design tokens — TechFair 2025 Mission Tracker.
 *
 * Source of truth for values that must be shared between Tailwind (loaded into
 * `tailwind.config.mjs` via `@config`) and code where utility classes cannot be
 * used: inline SVG fills, canvas/`style` props, and JS-computed measurements.
 *
 * Values match `ui-spec.md` §1.1–1.2 exactly. Colors are Tailwind v4's `oklch`
 * tokens (not hex) so there is no drift from the generated utility classes.
 *
 * Prefer utility classes (`bg-teal-800`, `rounded-2xl`, …) in components; reach
 * for these constants only when a class cannot express the value.
 */

/** `ui-spec.md` §1.1 color roles. */
export const colors = {
  /** Primary accent — active tab pill / primary actions (`teal-800`). */
  primary: 'oklch(43.7% 0.078 188.216)',
  /** Progress fill / success state (`emerald-500`). */
  success: 'oklch(69.6% 0.17 162.48)',
  /** Progress track, unfilled (`teal-100`). */
  progressTrack: 'oklch(95.3% 0.051 180.801)',
  /** Heading / mission title text (`slate-800`). */
  heading: 'oklch(27.9% 0.041 260.031)',
  /** Muted text — header subtext, progress label (`slate-500`). */
  muted: 'oklch(55.4% 0.046 257.417)',
  /** Faint text — mission descriptions (`slate-400`). */
  subtle: 'oklch(70.4% 0.04 256.788)',
  /** Incomplete status ring (`gray-300`). */
  statusIncomplete: 'oklch(87.2% 0.01 258.338)',
  /** Icon tile background (`slate-900`). */
  iconTile: 'oklch(20.8% 0.042 265.755)',
  /** Card / surface background (`white`). */
  surface: '#fff',
} as const;

/** Vertical rhythm from `ui-spec.md` §1.2. */
export const spacing = {
  /** Gap between mission rows (`space-y-3`). */
  missionRowGap: '0.75rem',
  /** Mission card internal padding (`p-4`). */
  cardPadding: '1rem',
} as const;

/** Corner radii from `ui-spec.md` §1.2. */
export const radius = {
  /** Icon tile (`rounded-xl`). */
  iconTile: '0.75rem',
  /** Mission row card (`rounded-2xl`). */
  card: '1rem',
  /** Floating top panel (`rounded-t-panel`, declared in `tailwind.config.mjs`). */
  panel: '2.5rem',
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
