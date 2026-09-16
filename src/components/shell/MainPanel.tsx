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
 * silhouette. The `rounded-t-panel` radius comes from `tailwind.config.mjs`.
 */
export default function MainPanel({ children }: MainPanelProps) {
  return (
    <main className="relative z-20 -mt-6 min-h-[60vh] rounded-t-panel bg-white px-4 pt-6 pb-10 shadow-md">
      {children}
    </main>
  );
}
