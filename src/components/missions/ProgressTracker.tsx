import ProgressBar from '../primitives/ProgressBar';

interface ProgressTrackerProps {
  /** Number of completed tasks (photos + feedback). */
  completed: number;
  /** Total task count. */
  total: number;
}

/**
 * Progress label + bar (`ui-spec.md` §2 progress section).
 *
 * Percent is derived here rather than passed in so the label and fill can never
 * disagree. `total <= 0` is guarded to avoid `NaN`/division-by-zero.
 */
export default function ProgressTracker({ completed, total }: ProgressTrackerProps) {
  const percent = total > 0 ? (completed / total) * 100 : 0;

  return (
    <section className="mb-5 flex flex-col items-center">
      <span className="mb-2.5 text-sm tabular-nums text-brand-muted">
        {completed} / {total} completed
      </span>
      <ProgressBar percent={percent} />
    </section>
  );
}
