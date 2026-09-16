import { CheckCircle2, Circle } from 'lucide-react';

interface StatusIndicatorProps {
  /** Whether the mission is complete. */
  completed: boolean;
}

/**
 * Completion indicator for a mission row (`ui-spec.md` §3).
 *
 * Both Lucide glyphs share a 24px square viewBox, so switching state never
 * changes the row's layout. The indicator is decorative (`aria-hidden`); the
 * accessible checked state lives on `MissionRow`'s `role="checkbox"`.
 */
export default function StatusIndicator({ completed }: StatusIndicatorProps) {
  return completed ? (
    <CheckCircle2 size={24} className="shrink-0 text-emerald-500" aria-hidden="true" />
  ) : (
    <Circle size={24} className="shrink-0 text-gray-300" aria-hidden="true" />
  );
}
