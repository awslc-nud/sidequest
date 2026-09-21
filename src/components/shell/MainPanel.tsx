import type { ReactNode } from 'react';
import Seabed from './Seabed';

interface MainPanelProps {
  /** Panel content — progress and the mission list. Optional while empty. */
  children?: ReactNode;
}

/**
 * Floating panel beneath the hero (`ui-spec.md` §2).
 *
 * `-mt-6` pulls it up to overlap the hero zone while `z-20` keeps it above the
 * hero (`z-10`) and the backdrop (`z-0`), producing the "tucked under"
 * silhouette. The panel runs all the way to the bottom edge on the spec's
 * "near-white with faint mint tint" surface (`bg-brand-bg`), so the white
 * mission cards read against it. `flex-1` lets it stretch to fill the viewport
 * on tall screens. The `rounded-t-panel` radius comes from
 * `tailwind.config.mjs`.
 *
 * A soft `Seabed` (dune waves) sits at the bottom behind the content; the extra
 * `pb-20` keeps the mission list and claim flow clear of it.
 */
export default function MainPanel({ children }: MainPanelProps) {
  return (
    <main className="relative z-20 -mt-6 min-h-[60vh] flex-1 rounded-t-panel bg-brand-bg px-4 pt-7 pb-20 shadow-[0_-8px_24px_-12px_rgba(23,87,80,0.18)]">
      <Seabed />
      {children}
    </main>
  );
}
