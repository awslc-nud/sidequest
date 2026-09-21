interface ProgressBarProps {
  /** Completion percentage (0–100). Values outside the range are clamped. */
  percent: number;
}

/**
 * Horizontal progress bar (`ui-spec.md` §2 progress section).
 *
 * The fill width is inline (JS-driven) because it tracks state; `transition-all`
 * animates every change. `overflow-hidden` on the track guarantees the fill can
 * never paint past the track's rounded cap at 100%.
 */
export default function ProgressBar({ percent }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-brand-track"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <div
        className="h-2 rounded-full bg-brand-accent transition-all duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
