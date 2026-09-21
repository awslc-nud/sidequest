interface MissionTextProps {
  /** Mission title, e.g. "Arrival Moment". */
  title: string;
  /** One-line mission description. */
  description: string;
  /** Optional status line under the description (e.g. an upload failure). */
  hint?: string;
  /** Tone for the hint line. */
  tone?: 'muted' | 'danger';
}

/**
 * Stacked title + description for a mission row (`ui-spec.md` §3).
 *
 * `min-w-0 flex-1` lets the block shrink and wrap long descriptions inside the
 * row instead of pushing `IconTile` / `StatusIndicator` out of alignment.
 */
export default function MissionText({ title, description, hint, tone = 'muted' }: MissionTextProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <h3 className="font-semibold leading-snug text-brand-ink">{title}</h3>
      <p className="text-sm leading-snug text-brand-muted">{description}</p>
      {hint && (
        <p className={`text-xs leading-snug ${tone === 'danger' ? 'text-brand-orange' : 'text-brand-deep'}`} role="status">
          {hint}
        </p>
      )}
    </div>
  );
}
