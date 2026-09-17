import { useCallback, useEffect, useRef, useState } from 'react';
import { SEED_MISSIONS } from '../components/missions/seed';
import type { Mission } from '../components/missions/types';

/** How long the chest/mascot shake sequence runs (ui-spec §6). */
export const SHAKE_DURATION_MS = 500;

/**
 * Exponent applied to the completion fraction to ease the shake in. Early
 * completions land near the bottom of the range and only later ones ramp up to
 * full strength, so the wobble feels gradual instead of starting at full tilt.
 * Because the fraction is `completedCount / total`, this shape automatically
 * adapts to a dynamic quest count: more quests ⇒ smaller steps between shakes.
 */
export const SHAKE_INTENSITY_CURVE = 4;

export interface MissionState {
  /** Current mission list (immutably updated). */
  missions: Mission[];
  /** True for `SHAKE_DURATION_MS` after a non-final mission is completed. */
  isShaking: boolean;
  /**
   * Shake strength for the current shake, in 0–1 — the completion fraction
   * (`completedCount / total`) at the moment of the shake, eased in by
   * `SHAKE_INTENSITY_CURVE` so early completions stay mild. Derived from the
   * mission total, so the escalation adapts to a dynamic mission count.
   */
  shakeIntensity: number;
  /** Latched true once every mission is complete (never resets — ui-spec §6). */
  isAllCompleted: boolean;
  /** Number of completed missions. */
  completedCount: number;
  /** `completedCount / missions.length` as a 0–100 percentage. */
  progressPercent: number;
  /** Toggle a mission's completed state by id. */
  toggleMission: (id: string) => void;
}

/**
 * Mission completion state for the tracker screen.
 *
 * Contract from `spec.md` / `ui-spec.md` §5–6:
 * - toggling a mission completion (false → true) triggers a 500ms shake,
 *   **unless** it is the final mission (that paths straight to all-complete);
 * - un-checking never shakes;
 * - updates are immutable.
 *
 * The shake strength escalates with progress: each completion sets
 * `shakeIntensity` to the new completion fraction raised to
 * `SHAKE_INTENSITY_CURVE`, so the more missions done (relative to the dynamic
 * total) the stronger the wobble — but the ramp stays gentle for early
 * completions instead of starting near full strength.
 *
 * The permanent `isAllCompleted` latch never resets, even if a mission is later
 * un-checked (`ui-spec.md` §6).
 */
export function useMissionState(): MissionState {
  const [missions, setMissions] = useState<Mission[]>(() => SEED_MISSIONS.map((m) => ({ ...m })));
  const [isShaking, setIsShaking] = useState(false);
  const [shakeIntensity, setShakeIntensity] = useState(0);
  // Latched (one-way) flag: set true when the list first becomes fully complete.
  const [isAllCompleted, setIsAllCompleted] = useState<boolean>(
    () => SEED_MISSIONS.length > 0 && SEED_MISSIONS.every((m) => m.completed),
  );
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const completedCount = missions.filter((m) => m.completed).length;
  const progressPercent = missions.length > 0 ? (completedCount / missions.length) * 100 : 0;

  const toggleMission = useCallback(
    (id: string) => {
      const target = missions.find((m) => m.id === id);
      if (!target) return;

      // Build the next list immutably: new array + new object for the toggled row.
      const next = missions.map((m) => (m.id === id ? { ...m, completed: !m.completed } : m));
      setMissions(next);

      const wasCompletion = !target.completed;
      const nowAllCompleted = next.every((m) => m.completed);

      if (nowAllCompleted) {
        // Final mission: latch permanently and skip the shake path entirely.
        setIsAllCompleted(true);
      } else if (wasCompletion) {
        // Strength scales with the new completion fraction of the (dynamic)
        // total, eased in so early completions are gentle (see the constant).
        const fraction = next.filter((m) => m.completed).length / next.length;
        setShakeIntensity(fraction ** SHAKE_INTENSITY_CURVE);
        setIsShaking(true);
        if (shakeTimer.current) clearTimeout(shakeTimer.current);
        shakeTimer.current = setTimeout(() => setIsShaking(false), SHAKE_DURATION_MS);
      }
    },
    [missions],
  );

  // Clear any pending timer on unmount.
  useEffect(
    () => () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    },
    [],
  );

  return {
    missions,
    isShaking,
    shakeIntensity,
    isAllCompleted,
    completedCount,
    progressPercent,
    toggleMission,
  };
}
