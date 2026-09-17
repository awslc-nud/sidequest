import { useEffect, useRef, useState } from 'react';

interface MascotChestHeroProps {
  /** True for ~500ms after a non-final mission is completed (ui-spec §6). */
  isShaking: boolean;
  /** Latched true once every mission is complete (ui-spec §6). */
  isAllCompleted: boolean;
}

/**
 * Chest hero zone.
 *
 * Per design request the mascot has been removed from behind the chest, so the
 * chest is the sole hero element (`ui-spec.md` §2 originally layered it over the
 * mascot's arms).
 *
 * - **Shake:** the chest picks up `animate-chest-shake` for ~500ms after a
 *   non-final completion.
 * - **All complete:** the chest permanently swaps to `chest-open.png` with a
 *   one-shot `animate-pop-in`, fired only on the false → true transition so a
 *   restored all-complete state won't replay it.
 *
 * Asset note: the repo ships `chest-locked.png`; `ui-spec.md` calls it
 * `chest-closed.png`.
 */
export default function MascotChestHero({ isShaking, isAllCompleted }: MascotChestHeroProps) {
  const [playPop, setPlayPop] = useState(false);
  const wasAllComplete = useRef(isAllCompleted);

  useEffect(() => {
    if (isAllCompleted && !wasAllComplete.current) setPlayPop(true);
    wasAllComplete.current = isAllCompleted;
  }, [isAllCompleted]);

  // The shake and all-complete states are mutually exclusive.
  const shaking = isShaking && !isAllCompleted;

  return (
    <div className="relative z-10 flex h-48 items-center justify-center">
      <img
        src={isAllCompleted ? '/assets/chest-open.png' : '/assets/chest-locked.png'}
        alt={isAllCompleted ? 'Opened reward chest' : 'Reward chest'}
        className={`h-32 w-52 object-contain ${
          isAllCompleted ? (playPop ? 'animate-pop-in' : '') : shaking ? 'animate-chest-shake' : ''
        }`}
      />
    </div>
  );
}
