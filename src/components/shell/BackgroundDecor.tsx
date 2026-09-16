/**
 * Decorative translucent teal bubbles rendered behind all content
 * (`ui-spec.md` §2, "Decorative background bubbles").
 *
 * Purely presentational: `pointer-events-none` lets taps pass through to the
 * real UI and `aria-hidden` keeps it out of the accessibility tree. The parent
 * `AppShell` clips overflow, so negative offsets can bleed off-screen without
 * introducing horizontal scroll.
 *
 * Bubble positions are an approximation of the mockup's four corners; adjust
 * offsets here once the reference image is available.
 */
export default function BackgroundDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      {/* Top-left, largest — frames the event header. */}
      <div className="absolute -left-16 -top-12 h-56 w-56 rounded-full bg-teal-200/40" />
      {/* Top-right, medium — balances the header. */}
      <div className="absolute -right-10 top-16 h-36 w-36 rounded-full bg-teal-300/30" />
      {/* Lower-left, wide — soft base behind the floating panel. */}
      <div className="absolute -bottom-20 -left-8 h-52 w-52 rounded-full bg-teal-200/40" />
    </div>
  );
}
