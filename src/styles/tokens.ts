/**
 * Design tokens — TechFair 2025 Mission Tracker.
 *
 * Source of truth for values that must be shared between Tailwind (loaded into
 * `tailwind.config.mjs` via `@config`) and code where utility classes cannot be
 * used: inline SVG fills, canvas/`style` props, and JS-computed measurements.
 *
 * Values match the approved **v2** palette in `ui-spec.md` §1.1–1.2 exactly.
 * These are the only UI colors in the mission tracker — the v1 `teal-*`,
 * `emerald-*` and `slate-*` default-Tailwind classes are deprecated.
 *
 * Prefer the generated `brand-*` utility classes (`bg-brand-accent`,
 * `text-brand-ink`, …) in components; reach for these constants only when a
 * class cannot express the value.
 */

/** `ui-spec.md` §1.1 approved brand colors. */
export const colors = {
  /** Page/app background — pale mint (`bg-brand-bg`). */
  bg: '#EDF7F9',
  /** Headings / high-emphasis text (`text-brand-ink`). */
  ink: '#000000',
  /** Muted / supporting text (`text-brand-muted`). */
  muted: '#7B7B7B',
  /** Primary interactive accent — active states, fills (`brand-accent`). */
  accent: '#64CCC3',
  /** Unfilled tracks / soft highlight backgrounds (`brand-track`). */
  track: '#C8EDED',
  /** Dark surfaces (icon tiles) / high-contrast accent (`brand-deep`). */
  deep: '#175750',
  /** Card / surface background (`brand-white`). */
  white: '#FFFFFF',
  /** Reserved: alerts / warning / attention states (`brand-orange`). */
  orange: '#FF8E04',
  /** Reserved: soft warning background (`brand-orange-soft`). */
  orangeSoft: '#FFE4C4',
} as const;

/** Vertical rhythm from `ui-spec.md` §1.4. */
export const spacing = {
  /** Gap between mission rows (`space-y-3`). */
  missionRowGap: '0.75rem',
  /** Mission card internal padding (`p-4`). */
  cardPadding: '1rem',
} as const;

/** Corner radii from `ui-spec.md` §1.4. */
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
