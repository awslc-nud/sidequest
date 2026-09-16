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
 *
 * The inner column is capped at `max-w-md` and centered so the mobile-first
 * layout keeps a card width on tablet/desktop. That wrapper is deliberately
 * **not** `relative`: `BackgroundDecor`'s `absolute inset-0` layer then resolves
 * against this positioned root, so the gradient and bubbles still span the full
 * viewport behind the centered content.
 */
export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-teal-50 via-emerald-50 to-white">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
