import type { ReactNode } from 'react';

interface AppShellProps {
  /** Screen content — normally `EventHeader`, `MascotChestHero` and `MainPanel`. */
  children: ReactNode;
}

/**
 * Root screen wrapper for the mobile mission tracker.
 *
 * Establishes the mint-to-white page gradient (`ui-spec.md` §1, started on
 * `teal-100` so `UnderwaterBackdrop`'s white sun shafts have something to read
 * against) and clips overflow so nothing can introduce horizontal scroll on
 * narrow (375px) viewports.
 *
 * The inner column is capped at `max-w-md` and centered so the mobile-first
 * layout keeps a card width on tablet/desktop, and is a full-height flex column
 * so `MainPanel` (`flex-1`) always stretches to the bottom edge.
 */
export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-teal-100 via-emerald-50 to-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">{children}</div>
    </div>
  );
}
