interface TabProps {
  /** Tab label, e.g. "Missions". */
  label: string;
  /** Whether this tab is the selected one. */
  active: boolean;
  /** Invoked when the tab is activated. */
  onClick: () => void;
}

/**
 * Pill tab button (`ui-spec.md` §2 tabs).
 *
 * Active/inactive styling differs only by colour, so the two states keep the
 * same footprint and the `transition-colors` eases the swap. The focus ring is
 * `focus-visible`-only so pointer users don't see it.
 */
export default function Tab({ label, active, onClick }: TabProps) {
  const state = active ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-600';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full py-2 text-center transition-colors focus-visible:ring-2 focus-visible:ring-teal-800 focus-visible:outline-none ${state}`}
    >
      {label}
    </button>
  );
}
