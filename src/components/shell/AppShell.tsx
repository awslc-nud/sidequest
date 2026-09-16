import type { ReactNode } from 'react';

interface AppShellProps {
  /** Screen content — normally `EventHeader`, `MascotChestHero` and `MainPanel`. */
  children: ReactNode;
}

/**
 * Root screen wrapper for the mobile mission tracker.
 *
 * Establishes the mint-to-white page gradient (`ui-spec.md` §1) and clips
 * absolutely-positioned decorative children so they can never introduce
 * horizontal scroll on narrow (375px) viewports.
 */
export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-teal-50 via-emerald-50 to-white">
      {children}
    </div>
  );
}
