/**
 * Soft seabed footer for the bottom of the floating panel (`ui-spec.md` §1.2
 * `brand-*` tokens).
 *
 * Two long, gentle dune waves anchor the bottom edge so the panel resolves into
 * water rather than ending flat. Kept low-contrast (pale `brand-track` behind a
 * faint `brand-accent`) so it reads as depth, not as a hard footer bar — this is
 * deliberately subtler than the rejected bubble/kelp attempts (see
 * `docs/ui-build.md` #21).
 *
 * Purely decorative: `aria-hidden` and `pointer-events-none`. It sits at
 * `-z-10` inside `MainPanel`'s stacking context, so it paints above the panel
 * background but behind the mission content.
 */

/** Far dune — pale track, drawn first (behind). */
const DUNE_BACK =
  'M0,42 C220,18 420,58 720,42 C1020,26 1220,58 1440,38 L1440,80 L0,80 Z';

/** Near dune — faint accent, overlapping the far dune. */
const DUNE_FRONT =
  'M0,60 C200,44 420,72 700,56 C980,40 1200,68 1440,50 L1440,80 L0,80 Z';

export default function Seabed() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-20 overflow-hidden"
    >
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path className="fill-brand-track/50" d={DUNE_BACK} />
      </svg>
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path className="fill-brand-accent/20" d={DUNE_FRONT} />
      </svg>
    </div>
  );
}
