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
 * not just the status icon. It exposes `role="checkbox"` + `aria-checked` for
 * assistive tech and is keyboard-operable via Enter/Space (44px+ target by
 * construction: `p-4` around a 44px content row).
 */
export default function MissionRow({ mission, onToggle }: MissionRowProps) {
  const toggle = () => onToggle(mission.id);

  return (
    <li
      role="checkbox"
      aria-checked={mission.completed}
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          toggle();
        }
      }}
      className="flex cursor-pointer items-center gap-3.5 rounded-2xl bg-white p-4 shadow-sm transition duration-150 hover:shadow-md active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-teal-800 focus-visible:outline-none"
    >
      <IconTile icon={ICONS[mission.icon]} />
      <MissionText title={mission.title} description={mission.description} />
      <StatusIndicator completed={mission.completed} />
    </li>
  );
}
