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
 * Falls back to a centered empty state when there are no missions, so the panel
 * never collapses to an unannounced empty `<ul>`.
 */
export default function MissionList({ missions, onToggle }: MissionListProps) {
  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <img
          src="/assets/mascot-idle.png"
          alt=""
          aria-hidden="true"
          className="h-24 w-24 object-contain opacity-40"
        />
        <p className="text-sm text-slate-400">No missions yet</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col space-y-3">
      {missions.map((mission) => (
        <MissionRow key={mission.id} mission={mission} onToggle={onToggle} />
      ))}
    </ul>
  );
}
