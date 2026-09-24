import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { SHAKE_CYCLE_MS } from '../../hooks/useQuestTracker';

interface MascotChestHeroProps {
  /** True while the chest is rattling after a completion. */
  isShaking: boolean;
  /**
   * Shake strength, 0–1, derived from the completion fraction at the moment of
   * the shake. Escalates the wobble amplitude with progress and adapts to a
   * dynamic mission count.
   */
  shakeIntensity: number;
  /** How long the current shake runs (ms); later tiers run more cycles. */
  shakeDurationMs: number;
  /** Latched true once every mission is complete (ui-spec §6). */
  isAllCompleted: boolean;
}

/** Shake amplitude at intensity 0 — kept tiny so the first completion barely moves. */
const SHAKE_X_MIN_PX = 1;
const SHAKE_Y_MIN_PX = 0.25;
const SHAKE_ROT_MIN_DEG = 1;
const SHAKE_SCALE_MIN = 1;
/** Shake amplitude at intensity 1 (the strongest escalation). */
const SHAKE_X_MAX_PX = 12;
const SHAKE_Y_MAX_PX = 5;
const SHAKE_ROT_MAX_DEG = 14;
const SHAKE_SCALE_MAX = 1.04;

/**
 * Chest hero zone.
 *
 * The mascot sits behind the chest (`mascot-idle.png`), switching to the
 * surprised pose while the chest rattles.
 *
 * - **Shake:** the chest picks up `animate-chest-shake` after a non-final
 *   completion. Amplitude is set via the `--chest-shake-x/y/rot/scale` CSS
 *   variables interpolated from `shakeIntensity`, and the number of rattle
 *   cycles from `shakeDurationMs`, so each subsequent completion wobbles harder
 *   and for longer.
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
  shakeDurationMs,
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
  // Repeat the rattle cycle so a longer shake keeps the same frantic tempo.
  const cycles = Math.max(1, Math.round(shakeDurationMs / SHAKE_CYCLE_MS));
  // Linear interpolation, rounded to 2dp so the CSS variables stay tidy.
  const lerp = (min: number, max: number) => Math.round((min + (max - min) * intensity) * 100) / 100;
  const shakeStyle = {
    '--chest-shake-x': `${lerp(SHAKE_X_MIN_PX, SHAKE_X_MAX_PX)}px`,
    '--chest-shake-y': `${lerp(SHAKE_Y_MIN_PX, SHAKE_Y_MAX_PX)}px`,
    '--chest-shake-rot': `${lerp(SHAKE_ROT_MIN_DEG, SHAKE_ROT_MAX_DEG)}deg`,
    '--chest-shake-scale': `${lerp(SHAKE_SCALE_MIN, SHAKE_SCALE_MAX)}`,
    animationIterationCount: cycles,
  } as CSSProperties;

  return (
    <div className="relative z-10 flex h-64 items-center justify-center">
      <img
        src={shaking ? '/assets/mascot-surprised.png' : '/assets/mascot-idle.png'}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[44%] -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 object-contain"
      />
      <img
        src="/assets/bottom_left.png"
        alt=""
        aria-hidden="true"
        className="h-56 w-56 -mr-36 shrink-0 object-contain"
      />
      <img
        id="reward-chest"
        src={isAllCompleted ? '/assets/chest-open.png' : '/assets/chest-locked.png'}
        alt={isAllCompleted ? 'Opened reward chest' : 'Reward chest'}
        style={shakeStyle}
        className={`h-56 w-72 shrink-0 translate-y-12 object-contain ${
          isAllCompleted ? (playPop ? 'animate-pop-in' : '') : shaking ? 'animate-chest-shake' : ''
        }`}
      />
      <img
        src="/assets/bottom_right.png"
        alt=""
        aria-hidden="true"
        className="h-56 w-56 -ml-36 shrink-0 object-contain"
      />
    </div>
  );
}
