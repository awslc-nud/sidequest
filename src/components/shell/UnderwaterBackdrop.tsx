/**
 * Ambient "underwater" backdrop rendered behind the header and hero (`z-0`).
 *
 * Replaces the earlier scattered-bubble decoration with a more deliberate
 * scene, all built from `ui-spec.md` §1 tokens:
 * - a wavy water-surface band at the top edge (two offset SVG waves),
 * - soft sun shafts slanting down from the surface,
 * - a gentle spotlight glow behind the chest so the hero reads as lit.
 *
 * Purely decorative: `pointer-events-none` lets taps pass through and
 * `aria-hidden` keeps it out of the accessibility tree. `AppShell` clips
 * overflow, so nothing here can cause horizontal scroll.
 */
export default function UnderwaterBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Water surface — two offset waves give the top edge some depth. */}
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-0 h-24 w-full"
      >
        <path
          className="fill-teal-100/70"
          d="M0 0h1200v54c-90 22-170-10-270-6s-160 34-260 30-170-30-270-26S90 76 0 58z"
        />
        <path
          className="fill-teal-200/50"
          d="M0 0h1200v30c-80 18-180-14-280-10s-150 30-250 26-180-28-280-24S80 50 0 34z"
        />
      </svg>

      {/* Sun shafts breaking through the surface. */}
      <div className="absolute -top-24 left-[7%] h-[64vh] w-16 -rotate-[15deg] bg-gradient-to-b from-white/85 via-white/35 to-transparent blur-2xl" />
      <div className="absolute -top-24 left-[40%] h-[78vh] w-28 -rotate-[10deg] bg-gradient-to-b from-white/75 via-white/25 to-transparent blur-3xl" />
      <div className="absolute -top-24 right-[8%] h-[60vh] w-20 -rotate-[20deg] bg-gradient-to-b from-teal-200/70 via-teal-200/25 to-transparent blur-2xl" />

      {/* Soft spotlight behind the chest. */}
      <div className="absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-200/35 blur-3xl" />
      <div className="absolute left-1/2 top-28 h-40 w-40 -translate-x-1/2 rounded-full bg-white/55 blur-2xl" />
    </div>
  );
}
