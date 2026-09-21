import { AlertTriangle, Check, Circle, Loader2 } from 'lucide-react';
import type { QuestStatus } from '../../client/types';

interface StatusIndicatorProps {
  /** Server/local completion state for the mission. */
  status: QuestStatus;
}

/**
 * Completion indicator for a mission row (`ui-spec.md` §3).
 *
 * - `done` — solid accent disc with a white check (the reference's filled badge)
 * - `pending_sync` — spinner while the staged photo uploads
 * - `failed` — orange alert so a terminal failure is obvious
 * - `todo` — thin track-colored ring
 *
 * All states occupy the same 24px square, so switching never shifts the row's
 * layout. The indicator is decorative (`aria-hidden`); the accessible state is
 * announced by the row's label.
 */
export default function StatusIndicator({ status }: StatusIndicatorProps) {
  if (status === 'done') {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent"
        aria-hidden="true"
      >
        <Check className="h-3.5 w-3.5 text-brand-white" strokeWidth={3} />
      </span>
    );
  }

  if (status === 'pending_sync') {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-brand-track text-brand-deep"
        aria-hidden="true"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-orange-soft text-brand-orange"
        aria-hidden="true"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
      </span>
    );
  }

  return <Circle size={24} strokeWidth={2} className="shrink-0 text-brand-track" aria-hidden="true" />;
}
