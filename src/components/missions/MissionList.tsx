import MissionRow from './MissionRow';
import MissionRowSkeleton from './MissionRowSkeleton';
import type { Mission } from './types';

/** Number of placeholder rows to show while loading. */
const SKELETON_ROWS = 5;

interface MissionListProps {
  missions: Mission[];
  /** Called to open capture for a `todo` mission. */
  onStart: (mission: Mission) => void;
  /** Called to retry a `failed` mission's upload. */
  onRetry: (id: string) => void;
  /** Failure messages keyed by mission id (for `failed` rows). */
  failures?: Record<string, string>;
  /** When true, render skeleton placeholders instead of rows. */
  isLoading?: boolean;
}

/**
 * Vertical stack of mission rows (`ui-spec.md` §2 mission list).
 *
 * Shows skeletons while loading, a centered empty state when there are no
 * missions, and the real rows otherwise.
 */
export default function MissionList({ missions, onStart, onRetry, failures, isLoading = false }: MissionListProps) {
  if (isLoading) {
    return (
      <ul className="flex flex-col space-y-3">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <MissionRowSkeleton key={i} />
        ))}
      </ul>
    );
  }

  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <img
          src="/assets/mascot-idle.png"
          alt=""
          aria-hidden="true"
          className="h-24 w-24 object-contain opacity-40"
        />
        <p className="text-sm text-brand-muted">No missions yet</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col space-y-3">
      {missions.map((mission, index) => (
        <MissionRow
          key={mission.id}
          mission={mission}
          index={index}
          failureMessage={failures?.[mission.id]}
          onStart={() => onStart(mission)}
          onRetry={() => onRetry(mission.id)}
        />
      ))}
    </ul>
  );
}
