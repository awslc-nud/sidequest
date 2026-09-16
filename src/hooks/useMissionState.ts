import { useCallback, useEffect, useRef, useState } from 'react';
import { SEED_MISSIONS } from '../components/missions/seed';
import type { Mission } from '../components/missions/types';

/** How long the chest/mascot shake sequence runs (ui-spec §6). */
export const SHAKE_DURATION_MS = 500;

export interface MissionState {
  /** Current mission list (immutably updated). */
  missions: Mission[];
  /** True for `SHAKE_DURATION_MS` after a non-final mission is completed. */
  isShaking: boolean;
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
 * The permanent `isAllCompleted` latch never resets, even if a mission is later
 * un-checked (`ui-spec.md` §6).
 */
export function useMissionState(): MissionState {
  const [missions, setMissions] = useState<Mission[]>(() => SEED_MISSIONS.map((m) => ({ ...m })));
  const [isShaking, setIsShaking] = useState(false);
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
        // A single, non-final completion triggers the brief shake.
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

  return { missions, isShaking, isAllCompleted, completedCount, progressPercent, toggleMission };
}
