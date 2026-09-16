import { useEffect, useRef, useState } from 'react';

interface MascotChestHeroProps {
  /** True for ~500ms after a non-final mission is completed (ui-spec §6). */
  isShaking: boolean;
  /** Latched true once every mission is complete (ui-spec §6). */
  isAllCompleted: boolean;
}

/**
 * Mascot + chest hero zone (`ui-spec.md` §2, §3 states).
 *
 * - **Shake:** both mascot states are mounted and cross-faded via opacity rather
 *   than swapping `src`, so the swap is flicker-free. The mascot bounces with a
 *   `translate` and the chest picks up `animate-chest-shake`.
 * - **All complete:** the chest permanently swaps to `chest-open.png` with a
 *   one-shot `animate-pop-in`. The pop only fires on the false → true
 *   transition, so a restored all-complete state won't replay it on mount.
 *
 * Asset notes: the repo ships `chest-locked.png` (ui-spec calls it
 * `chest-closed.png`), and there is **no `mascot-excited.png`** — per the
 * `ui-spec.md` §4.2 asset-gap note the idle asset is reused with a CSS bounce.
 * Flag to design if a dedicated excited asset should be requested.
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
    <div className="relative z-10 flex h-40 items-center justify-center">
      <div
        className={`relative h-36 w-36 transition-transform duration-200 ease-out ${
          shaking ? 'translate-y-1' : 'translate-y-0'
        } ${isAllCompleted ? 'animate-bounce' : ''}`}
      >
        <img
          src="/assets/mascot-idle.png"
          alt="Mission tracker mascot"
          aria-hidden={shaking}
          className={`absolute inset-0 h-36 w-36 object-contain transition-opacity duration-150 ${
            shaking ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <img
          src="/assets/mascot-surprised.png"
          alt="Mission tracker mascot"
          aria-hidden={!shaking}
          className={`absolute inset-0 h-36 w-36 object-contain transition-opacity duration-150 ${
            shaking ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
      <img
        src={isAllCompleted ? '/assets/chest-open.png' : '/assets/chest-locked.png'}
        alt={isAllCompleted ? 'Opened reward chest' : 'Reward chest'}
        className={`absolute h-[90px] w-[110px] translate-y-4 object-contain ${
          isAllCompleted ? (playPop ? 'animate-pop-in' : '') : shaking ? 'animate-chest-shake' : ''
        }`}
      />
    </div>
  );
}
