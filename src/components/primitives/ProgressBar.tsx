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
 *
 * A faint inset shadow on the track and a soft gradient/glow on the fill give
 * the bar depth so it reads as a physical gauge, not a flat rectangle.
 */
export default function ProgressBar({ percent }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-brand-track shadow-[inset_0_1px_2px_rgba(23,87,80,0.12)]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <div
        className="h-2 rounded-full bg-gradient-to-r from-brand-accent to-brand-accent/70 shadow-[0_0_6px_rgba(100,204,195,0.45)] transition-all duration-300 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
