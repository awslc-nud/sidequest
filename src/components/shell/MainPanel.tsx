import type { ReactNode } from 'react';
import Seabed from './Seabed';

interface MainPanelProps {
  /** Panel content — progress and the mission list. Optional while empty. */
  children?: ReactNode;
}

/**
 * Wavy top edge where the panel meets the hero (`ui-spec.md` §2, revised).
 *
 * Layered like `Seabed`: translucent crests stagger above an opaque `brand-bg`
 * silhouette so the transition reads as depth rather than a hard corner. All
 * three share a phase, just offset vertically, so they nest into parallel bands.
 * Rendered just above the panel (`bottom-full`) so the front wave becomes the
 * panel's edge.
 */
const WAVE_BACK =
  'M0,64 L0,14 C160,0 320,28 480,14 C640,0 800,28 960,14 C1120,0 1280,28 1440,14 L1440,64 Z';
const WAVE_MID =
  'M0,64 L0,24 C160,10 320,38 480,24 C640,10 800,38 960,24 C1120,10 1280,38 1440,24 L1440,64 Z';
const WAVE_FRONT =
  'M0,64 L0,36 C160,22 320,50 480,36 C640,22 800,50 960,36 C1120,22 1280,50 1440,36 L1440,64 Z';

/**
 * Floating panel beneath the hero (`ui-spec.md` §2).
 *
 * `z-20` keeps it above the hero (`z-10`) and the backdrop (`z-0`), and the
 * layered waves overlap the hero zone to produce the "tucked under" silhouette
 * (formerly a `rounded-t-panel` corner). The panel runs all the way to the
 * bottom edge on the spec's "near-white with faint mint tint" surface
 * (`bg-brand-bg`), so the white mission cards read against it. `flex-1` lets it
 * stretch to fill the viewport on tall screens.
 *
 * A soft `Seabed` (dune waves) sits at the bottom behind the content; the extra
 * `pb-20` keeps the mission list and claim flow clear of it.
 */
export default function MainPanel({ children }: MainPanelProps) {
  return (
    <main className="relative z-20 min-h-[60vh] flex-1 bg-brand-bg px-4 pt-9 pb-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-full h-8 overflow-hidden"
      >
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path className="fill-brand-track/50" d={WAVE_BACK} />
        </svg>
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path className="fill-brand-accent/20" d={WAVE_MID} />
        </svg>
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path className="fill-brand-bg" d={WAVE_FRONT} />
        </svg>
      </div>
      <Seabed />
      {children}
    </main>
  );
}
