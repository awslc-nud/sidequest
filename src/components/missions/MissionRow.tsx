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
  index: number;
  /** Server/worker failure message for a `failed` row. */
  failureMessage?: string;
  /** Called to open the capture flow (row `todo`). */
  onStart: () => void;
  /** Called to re-queue a terminally-failed upload (row `failed`). */
  onRetry: () => void;
}

/**
 * Tappable mission card (`ui-spec.md` §3), now server-driven.
 *
 * The whole card is a `<button>`: tapping a `todo` row opens capture, a `failed`
 * row retries, and `done`/`pending_sync` rows are disabled. 44px+ target by
 * construction (`p-4` around a 40px content row).
 */
export default function MissionRow({ mission, index, failureMessage, onStart, onRetry }: MissionRowProps) {
  const actionable = mission.status === 'todo' || mission.status === 'failed';
  const onClick = mission.status === 'failed' ? onRetry : onStart;

  const hint =
    mission.status === 'pending_sync'
      ? 'Uploading…'
      : mission.status === 'failed'
        ? (failureMessage ?? 'Upload failed — tap to retry.')
        : undefined;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={!actionable}
        aria-label={`Quest ${index + 1}: ${mission.title}`}
        className="flex w-full items-center gap-3.5 rounded-2xl bg-brand-white p-4 text-left shadow-sm ring-1 ring-brand-track/50 transition duration-150 enabled:cursor-pointer enabled:hover:shadow-md enabled:active:scale-[0.99] disabled:cursor-default focus-visible:ring-2 focus-visible:ring-brand-deep focus-visible:outline-none"
      >
        <IconTile icon={ICONS[mission.icon]} />
        <MissionText
          title={mission.title}
          description={mission.description}
          hint={hint}
          tone={mission.status === 'failed' ? 'danger' : 'muted'}
        />
        <StatusIndicator status={mission.status} />
      </button>
    </li>
  );
}
