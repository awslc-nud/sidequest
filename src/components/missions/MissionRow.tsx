import { Camera, Users, type LucideIcon } from 'lucide-react';
import IconTile from '../primitives/IconTile';
import MissionText from '../primitives/MissionText';
import StatusIndicator from '../primitives/StatusIndicator';
import type { Mission } from './types';

/** Maps a mission's icon key to its Lucide component (`ui-spec.md` §4.1). */
const ICONS: Record<Mission['icon'], LucideIcon> = {
  camera: Camera,
  users: Users,
};

interface MissionRowProps {
  mission: Mission;
  /** Called with the mission id when the row is tapped. */
  onToggle: (id: string) => void;
}

/**
 * Tappable mission card (`ui-spec.md` §3).
 *
 * The click handler is on the `<li>` itself so the whole card is the hit area,
 * not just the status icon. Interactive roles/keyboard semantics are added in
 * the Phase 5 accessibility pass.
 */
export default function MissionRow({ mission, onToggle }: MissionRowProps) {
  return (
    <li
      onClick={() => onToggle(mission.id)}
      className="flex cursor-pointer items-center justify-between gap-3 p-4 bg-white rounded-2xl shadow-sm"
    >
      <IconTile icon={ICONS[mission.icon]} />
      <MissionText title={mission.title} description={mission.description} />
      <StatusIndicator completed={mission.completed} />
    </li>
  );
}
