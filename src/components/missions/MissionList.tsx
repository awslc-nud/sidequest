import MissionRow from './MissionRow';
import type { Mission } from './types';

interface MissionListProps {
  missions: Mission[];
  /** Called with the mission id when a row is toggled. */
  onToggle: (id: string) => void;
}

/**
 * Vertical stack of mission rows (`ui-spec.md` §2 mission list).
 *
 * An empty-state fallback is added in the Phase 5 polish pass.
 */
export default function MissionList({ missions, onToggle }: MissionListProps) {
  return (
    <ul className="flex flex-col space-y-3">
      {missions.map((mission) => (
        <MissionRow key={mission.id} mission={mission} onToggle={onToggle} />
      ))}
    </ul>
  );
}
