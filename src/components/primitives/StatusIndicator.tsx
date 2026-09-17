import { Check, Circle } from 'lucide-react';

interface StatusIndicatorProps {
  /** Whether the mission is complete. */
  completed: boolean;
}

/**
 * Completion indicator for a mission row (`ui-spec.md` §3).
 *
 * Complete is a solid emerald disc with a white check (matching the reference's
 * filled badge); incomplete is a thin gray ring. Both states occupy the same
 * 24px square, so toggling never shifts the row's layout. The indicator is
 * decorative (`aria-hidden`); the accessible checked state lives on
 * `MissionRow`'s `role="checkbox"`.
 */
export default function StatusIndicator({ completed }: StatusIndicatorProps) {
  return completed ? (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500"
      aria-hidden="true"
    >
      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
    </span>
  ) : (
    <Circle size={24} strokeWidth={2} className="shrink-0 text-gray-300" aria-hidden="true" />
  );
}
