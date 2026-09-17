import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface MascotChestHeroProps {
  /** True for ~500ms after a non-final mission is completed (ui-spec §6). */
  isShaking: boolean;
  /**
   * Shake strength, 0–1, derived from the completion fraction at the moment of
   * the shake. Escalates the wobble amplitude with progress and adapts to a
   * dynamic mission count.
   */
  shakeIntensity: number;
  /** Latched true once every mission is complete (ui-spec §6). */
  isAllCompleted: boolean;
}

/** Shake amplitude at intensity 0 (matches `ui-spec.md` §6 baseline). */
const SHAKE_X_MIN_PX = 2;
const SHAKE_ROT_MIN_DEG = 3;
/** Shake amplitude at intensity 1 (the strongest escalation). */
const SHAKE_X_MAX_PX = 8;
const SHAKE_ROT_MAX_DEG = 12;

/**
 * Chest hero zone.
 *
 * Per design request the mascot has been removed from behind the chest, so the
 * chest is the sole hero element (`ui-spec.md` §2 originally layered it over the
 * mascot's arms).
 *
 * - **Shake:** the chest picks up `animate-chest-shake` for ~500ms after a
 *   non-final completion. Amplitude is set via the `--chest-shake-x` /
 *   `--chest-shake-rot` CSS variables, interpolated from `shakeIntensity`, so
 *   each subsequent completion wobbles harder.
 * - **All complete:** the chest permanently swaps to `chest-open.png` with a
 *   one-shot `animate-pop-in`, fired only on the false → true transition so a
 *   restored all-complete state won't replay it.
 *
 * Asset note: the repo ships `chest-locked.png`; `ui-spec.md` calls it
 * `chest-closed.png`.
 */
export default function MascotChestHero({
  isShaking,
  shakeIntensity,
  isAllCompleted,
}: MascotChestHeroProps) {
  const [playPop, setPlayPop] = useState(false);
  const wasAllComplete = useRef(isAllCompleted);

  useEffect(() => {
    if (isAllCompleted && !wasAllComplete.current) setPlayPop(true);
    wasAllComplete.current = isAllCompleted;
  }, [isAllCompleted]);

  // The shake and all-complete states are mutually exclusive.
  const shaking = isShaking && !isAllCompleted;

  const intensity = Math.min(1, Math.max(0, shakeIntensity));
  // Linear interpolation, rounded to 2dp so the CSS variables stay tidy.
  const lerp = (min: number, max: number) => Math.round((min + (max - min) * intensity) * 100) / 100;
  const shakeStyle = {
    '--chest-shake-x': `${lerp(SHAKE_X_MIN_PX, SHAKE_X_MAX_PX)}px`,
    '--chest-shake-rot': `${lerp(SHAKE_ROT_MIN_DEG, SHAKE_ROT_MAX_DEG)}deg`,
  } as CSSProperties;

  return (
    <div className="relative z-10 flex h-48 items-center justify-center">
      <img
        src={isAllCompleted ? '/assets/chest-open.png' : '/assets/chest-locked.png'}
        alt={isAllCompleted ? 'Opened reward chest' : 'Reward chest'}
        style={shakeStyle}
        className={`h-32 w-52 object-contain ${
          isAllCompleted ? (playPop ? 'animate-pop-in' : '') : shaking ? 'animate-chest-shake' : ''
        }`}
      />
    </div>
  );
}
