interface MissionTextProps {
  /** Mission title, e.g. "Arrival Moment". */
  title: string;
  /** One-line mission description. */
  description: string;
}

/**
 * Stacked title + description for a mission row (`ui-spec.md` §3).
 *
 * `min-w-0 flex-1` lets the block shrink and wrap long descriptions inside the
 * row instead of pushing `IconTile` / `StatusIndicator` out of alignment.
 */
export default function MissionText({ title, description }: MissionTextProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <h3 className="font-medium text-slate-800">{title}</h3>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}
