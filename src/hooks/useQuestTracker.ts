import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicConfig, ProgressResponse, QuestStatus } from '../client/types';
import { ensureSessionId } from '../client/session';
import { getJson, postJson } from '../client/http';
import { countPendingPhotos, getLocalPhotosForPrompt } from '../client/db/indexedDb';
import {
  createUploadQueue,
  postUploadMultipart,
  UploadError,
  DEFAULT_MAX_ATTEMPTS,
  type UploadQueue,
} from '../client/uploadQueue';
import { clientUuid } from '../client/uuid';
import type { Mission, MissionIcon } from '../components/missions/types';

/** How long the chest shake sequence runs (ui-spec §6). */
export const SHAKE_DURATION_MS = 500;

/**
 * Slightly longer shake for the **final** quest: after the last photo lands the
 * chest rattles at full strength for a beat longer to build suspense before it
 * pops open and the screen flashes to the reward reveal. Tune here.
 */
export const FINALE_SHAKE_DURATION_MS = 900;

/**
 * Exponent applied to the completion fraction to ease the shake in. Early
 * completions land near the bottom of the range and only later ones ramp up to
 * full strength. Because the fraction is `completed / total`, this shape adapts
 * to a dynamic quest count: more quests ⇒ smaller steps between shakes.
 */
export const SHAKE_INTENSITY_CURVE = 4;

export interface QuestFailure {
  attempts: number;
  terminal: boolean;
  message: string;
}

export interface CapturingQuest {
  id: string;
  title: string;
}

export interface QuestTracker {
  cfg: PublicConfig | null;
  progress: ProgressResponse | null;
  missions: Mission[];
  isLoading: boolean;
  error: string | null;
  online: boolean;
  localPending: number;
  failures: Record<string, QuestFailure>;
  capturing: CapturingQuest | null;
  isShaking: boolean;
  shakeIntensity: number;
  /** Chest fully unlocked on the server (final state — drives the open chest). */
  isAllCompleted: boolean;
  /** Every quest has a synced photo (feedback may still be outstanding). */
  allQuestsDone: boolean;
  /** Re-fetch server progress (also retried on focus/online). */
  refresh: () => Promise<void>;
  startCapture: (quest: CapturingQuest) => void;
  cancelCapture: () => void;
  confirmCapture: (blob: Blob) => Promise<void>;
  retry: (promptId: string) => Promise<void>;
}

/** Turn a transport/server error into a short, human message. */
function uploadErrorMessage(error: unknown, terminal: boolean): string {
  const retry = terminal ? 'Tap Retry to try again.' : 'Retrying automatically…';
  if (error instanceof UploadError) {
    const s = error.info.status;
    if (s === 413) return 'Photo is too large to upload.';
    if (s === 400) return 'The server rejected this photo — try retaking it.';
    if (s === 403) return 'Your session expired — please refresh the page.';
    if (s === 404) return 'Session not found — please refresh the page.';
    if (s === 409) return 'This quest is already complete.';
    if (s === 429) return `The server is busy. ${retry}`;
    if (s >= 500) return `The server hit an error saving your photo. ${retry}`;
  }
  if (error instanceof Error && /no session/i.test(error.message)) return `Getting your session ready… ${retry}`;
  return navigator.onLine ? `Upload failed. ${retry}` : "You're offline. We'll retry when you're back online.";
}

/** Config quests carry no icon; pick one from the copy so rows stay meaningful. */
function iconForQuest(quest: { title: string; description: string }): MissionIcon {
  return /\b(friend|friends|people|group|team|together)\b/i.test(`${quest.title} ${quest.description}`)
    ? 'users'
    : 'camera';
}

/**
 * Backend-driven state for the attendee mission tracker.
 *
 * Owns the full lifecycle the old mock didn't: anonymous session, public
 * config, server progress, offline-first photo staging + retry queue, and the
 * chest-shake escalation. The screen is a pure consumer of this hook.
 *
 * Concurrency/refresh contract (spec §3.4): the server is canonical. We refresh
 * on boot, tab focus, connectivity restore, and after feedback/claim — never on
 * a timer.
 */
export function useQuestTracker(): QuestTracker {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [localPending, setLocalPending] = useState(0);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [failures, setFailures] = useState<Record<string, QuestFailure>>({});
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [capturing, setCapturing] = useState<CapturingQuest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [shakeIntensity, setShakeIntensity] = useState(0);

  const sidRef = useRef<string | null>(null);
  const cfgRef = useRef<PublicConfig | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Previous server completion count, so we only shake on a real increment.
  const prevCompleted = useRef<number | null>(null);

  /** Local-only refresh: reads IndexedDB, makes no network calls. */
  const refreshLocal = useCallback(async () => {
    const activeCfg = cfgRef.current;
    if (!activeCfg) return;
    setLocalPending(await countPendingPhotos());

    const busy = new Set<string>();
    const derived: Record<string, QuestFailure> = {};
    for (const q of activeCfg.quests) {
      const photos = await getLocalPhotosForPrompt(q.id);
      const unsynced = photos.filter((p) => p.status !== 'synced');
      if (unsynced.length === 0) continue;
      const failedPhoto = unsynced.find((p) => p.status === 'failed');
      if (failedPhoto) {
        derived[q.id] = {
          attempts: failedPhoto.attempts,
          terminal: failedPhoto.attempts >= DEFAULT_MAX_ATTEMPTS,
          message: 'Upload failed.',
        };
      } else {
        busy.add(q.id);
      }
    }
    setSyncing(busy);
    setFailures((prev) => {
      const next: Record<string, QuestFailure> = {};
      for (const [id, live] of Object.entries(prev)) {
        if (derived[id]) next[id] = { ...derived[id], ...live };
      }
      for (const [id, d] of Object.entries(derived)) {
        if (!next[id]) next[id] = d;
      }
      return next;
    });
  }, []);

  /** Server refresh (§3.4). Called on boot, focus, feedback/claim and 404 recovery. */
  const refresh = useCallback(async () => {
    let sid = sidRef.current;
    const activeCfg = cfgRef.current;
    if (!sid || !activeCfg) return;
    try {
      const load = async () => {
        const { status, body } = await getJson<ProgressResponse>(`/api/progress/${sid}`);
        if (status === 200) setProgress(body);
        return status;
      };

      const status = await load();
      if (status === 404) {
        const m = await postJson<{ session_id: string }>('/api/session', {});
        if (m.body?.session_id) {
          sidRef.current = m.body.session_id;
          sid = m.body.session_id;
          await load();
        }
      }
    } catch {
      // transient; a later focus/action will retry
    }
    await refreshLocal();
  }, [refreshLocal]);

  const queue: UploadQueue = useMemo(
    () =>
      createUploadQueue({
        postUpload: postUploadMultipart,
        sessionIdProvider: () => sidRef.current,
        onSynced: (promptId, body) => {
          setFailures((prev) => {
            if (!prev[promptId]) return prev;
            const next = { ...prev };
            delete next[promptId];
            return next;
          });
          if (body?.progress) {
            setProgress((prev) =>
              prev
                ? {
                    ...prev,
                    completed: body.progress.completed,
                    total: body.progress.total,
                    completed_prompt_ids: body.progress.completed_prompt_ids,
                    chest_unlocked: body.chest_unlocked ?? prev.chest_unlocked,
                  }
                : prev,
            );
          }
          void refreshLocal();
        },
        onFailed: (promptId, err, info) => {
          setFailures((prev) => ({
            ...prev,
            [promptId]: { attempts: info.attempts, terminal: info.terminal, message: uploadErrorMessage(err, info.terminal) },
          }));
          void refreshLocal();
        },
      }),
    [refreshLocal],
  );

  // Bootstrap: session + config + one progress fetch. No polling.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sid = await ensureSessionId();
        if (!alive) return;
        sidRef.current = sid;
        const configRes = await getJson<PublicConfig>('/api/config');
        if (configRes.status !== 200) {
          setError('Event config could not be loaded.');
          return;
        }
        cfgRef.current = configRes.body;
        if (alive) setCfg(configRes.body);
        await refresh();
        queue.wake();
      } catch {
        if (alive) setError('Could not reach the server. Refresh to try again.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [queue, refresh]);

  // Re-check the server when the attendee returns, and resume sync.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        queue.wake();
        void refresh();
      }
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [queue, refresh]);

  // Connectivity: reflect it in the UI and resume syncing when back online.
  useEffect(() => {
    const set = () => setOnline(navigator.onLine !== false);
    const onOnline = () => {
      set();
      queue.wake();
      void refresh();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', set);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', set);
    };
  }, [queue, refresh]);

  // Chest shake escalation: fire when the server completion count increases.
  // The final quest uses a longer, full-strength shake (the reward reveal is
  // orchestrated by the screen, which holds the chest shut until it finishes).
  useEffect(() => {
    if (!progress) return;
    const prev = prevCompleted.current;
    prevCompleted.current = progress.completed;
    if (prev === null || progress.completed <= prev) return;

    const isFinal = progress.chest_unlocked;
    const fraction = progress.total > 0 ? progress.completed / progress.total : 1;
    setShakeIntensity(isFinal ? 1 : fraction ** SHAKE_INTENSITY_CURVE);
    setIsShaking(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setIsShaking(false), isFinal ? FINALE_SHAKE_DURATION_MS : SHAKE_DURATION_MS);
  }, [progress]);

  // Clear any pending shake timer on unmount.
  useEffect(
    () => () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    },
    [],
  );

  const statusOf = useCallback(
    (id: string): QuestStatus => {
      if (progress?.completed_prompt_ids.includes(id)) return 'done';
      if (failures[id]) return 'failed';
      if (syncing.has(id)) return 'pending_sync';
      return 'todo';
    },
    [progress, failures, syncing],
  );

  const missions = useMemo<Mission[]>(
    () =>
      (cfg?.quests ?? []).map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        icon: iconForQuest(q),
        status: statusOf(q.id),
      })),
    [cfg, statusOf],
  );

  const confirmCapture = useCallback(
    async (blob: Blob) => {
      if (!capturing) return;
      const promptId = capturing.id;
      await queue.stage({
        clientCaptureId: clientUuid(),
        promptId,
        blob,
        sizeBytes: blob.size,
        capturedAt: Date.now(),
      });
      setSyncing((s) => new Set(s).add(promptId));
      setCapturing(null);
      await refreshLocal();
    },
    [capturing, queue, refreshLocal],
  );

  const retry = useCallback(
    async (promptId: string) => {
      setFailures((prev) => {
        const next = { ...prev };
        delete next[promptId];
        return next;
      });
      setSyncing((s) => new Set(s).add(promptId));
      await queue.retryPrompt(promptId);
    },
    [queue],
  );

  const isLoading = !error && (!cfg || !progress);

  return {
    cfg,
    progress,
    missions,
    isLoading,
    error,
    online,
    localPending,
    failures,
    capturing,
    isShaking,
    shakeIntensity,
    isAllCompleted: progress?.chest_unlocked ?? false,
    allQuestsDone: !!cfg && !!progress && progress.completed_prompt_ids.length >= cfg.quests.length,
    refresh,
    startCapture: setCapturing,
    cancelCapture: () => setCapturing(null),
    confirmCapture,
    retry,
  };
}
