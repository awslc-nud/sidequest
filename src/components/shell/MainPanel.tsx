import type { ReactNode } from 'react';

interface MainPanelProps {
  /** Panel content — progress, tabs and the mission list. Optional while empty. */
  children?: ReactNode;
}

/**
 * Floating white panel beneath the hero (`ui-spec.md` §2).
 *
 * `-mt-6` pulls it up to overlap the hero zone while `z-20` keeps it above the
 * hero (`z-10`) and decorative bubbles (`z-0`), producing the "tucked under"
 * silhouette. The panel runs all the way to the bottom edge on the spec's
 * "near-white with faint mint tint" surface (`bg-teal-50`), so the white mission
 * cards read against it. `flex-1` lets it stretch to fill the viewport on tall
 * screens. The `rounded-t-panel` radius comes from `tailwind.config.mjs`.
 */
export default function MainPanel({ children }: MainPanelProps) {
  return (
    <main className="relative z-20 -mt-6 min-h-[60vh] flex-1 rounded-t-panel bg-teal-50 px-4 pt-7 pb-12 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)]">
      {children}
    </main>
  );
}
