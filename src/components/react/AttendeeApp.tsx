import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, PartyPopper, WifiOff } from 'lucide-react';
import type { PublicConfig, ProgressResponse, QuestStatus } from '../../client/types';
import { ensureSessionId } from '../../client/session';
import { getJson, postJson } from '../../client/http';
import { countPendingPhotos, getLocalPhotosForPrompt } from '../../client/db/indexedDb';
import { createUploadQueue, postUploadMultipart, UploadError, DEFAULT_MAX_ATTEMPTS } from '../../client/uploadQueue';
import { clientUuid } from '../../client/uuid';
import Chest, { type ChestState } from './Chest';
import QuestCard, { type QuestFailure } from './QuestCard';
import CaptureReview from './CaptureReview';
import ClaimFlow from './ClaimFlow';

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

export default function AttendeeApp() {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [chest, setChest] = useState<ChestState>('locked');
  const [localPending, setLocalPending] = useState(0);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [failures, setFailures] = useState<Record<string, QuestFailure>>({});
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const [capturing, setCapturing] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sidRef = useRef<string | null>(null);
  const cfgRef = useRef<PublicConfig | null>(null);
  const wasUnlocked = useRef(false);

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
    // Merge: keep richer live messages from worker events, drop entries now synced.
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

  /**
   * Server refresh (§3.4). Called only on real events — boot, tab focus,
   * feedback/claim, and 404 recovery — never on a timer.
   */
  const refreshRemote = useCallback(async () => {
    let sid = sidRef.current;
    const activeCfg = cfgRef.current;
    if (!sid || !activeCfg) return;
    try {
      const load = async () => {
        const { status, body } = await getJson<ProgressResponse>(`/api/progress/${sid}`);
        if (status === 200) setProgress(body);
        return status;
      };

      let status = await load();
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

  const queue = useMemo(
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
        await refreshRemote();
        queue.wake();
      } catch {
        if (alive) setError('Could not reach the server. Refresh to try again.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [queue, refreshRemote]);

  // Re-check the server when the attendee returns, and resume sync.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        queue.wake();
        void refreshRemote();
      }
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [queue, refreshRemote]);

  // Connectivity: reflect it in the UI and resume syncing when back online.
  useEffect(() => {
    const set = () => setOnline(navigator.onLine !== false);
    const onOnline = () => {
      set();
      queue.wake();
      void refreshRemote();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', set);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', set);
    };
  }, [queue, refreshRemote]);

  // Chest unlock detection.
  useEffect(() => {
    if (!progress) return;
    if (progress.chest_unlocked) {
      if (!wasUnlocked.current) {
        wasUnlocked.current = true;
        setChest('burst');
        const t = setTimeout(() => setChest('unlocked'), 1700);
        return () => clearTimeout(t);
      }
      setChest('unlocked');
    } else {
      wasUnlocked.current = false;
      setChest('locked');
    }
  }, [progress?.chest_unlocked, progress?.unlocked_at]);

  if (error) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300">
        <AlertCircle className="h-4 w-4" /> {error}
      </div>
    );
  }

  if (!cfg || !progress) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading your quests…
      </div>
    );
  }

  const statusOf = (id: string): QuestStatus => {
    if (progress.completed_prompt_ids.includes(id)) return 'done';
    if (failures[id]) return 'failed';
    if (syncing.has(id)) return 'pending_sync';
    return 'todo';
  };

  const handleConfirm = async (blob: Blob) => {
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
  };

  const handleRetry = async (promptId: string) => {
    setFailures((prev) => {
      const next = { ...prev };
      delete next[promptId];
      return next;
    });
    setSyncing((s) => new Set(s).add(promptId));
    await queue.retryPrompt(promptId);
  };

  return (
    <div className="flex flex-col gap-6">
      {!online && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-800/60 bg-amber-950/30 p-3 text-sm text-amber-200">
          <WifiOff className="h-4 w-4" /> You're offline. Uploads will resume automatically.
        </div>
      )}

      {/* Progress */}
      <section aria-label="Quest progress" className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-zinc-400">Progress</p>
          <p className="text-sm text-zinc-300">
            <span className="text-lg font-semibold text-zinc-100">{progress.completed}</span>/{progress.total} tasks
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-amber-400 transition-all"
            style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }}
          />
        </div>
      </section>

      {/* Chest */}
      <Chest state={chest} />
      {chest === 'burst' && (
        <p className="-mt-3 flex items-center justify-center gap-1.5 text-sm text-amber-300">
          <PartyPopper className="h-4 w-4" /> Chest unlocked!
        </p>
      )}

      {/* Quests */}
      <section aria-label="Quests" className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">Quests</h2>
        <ul className="flex flex-col gap-3">
          {cfg.quests.map((quest, i) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              index={i}
              status={statusOf(quest.id)}
              chestUnlocked={progress.chest_unlocked}
              failure={failures[quest.id]}
              onStart={() => setCapturing(quest)}
              onRetry={() => void handleRetry(quest.id)}
            />
          ))}
        </ul>
      </section>

      {capturing && (
        <CaptureReview promptTitle={capturing.title} onCancel={() => setCapturing(null)} onConfirm={handleConfirm} />
      )}

      {progress.completed_prompt_ids.length === cfg.quests.length && (
        <ClaimFlow
          cfg={cfg}
          progress={progress}
          sessionId={progress.session_id}
          localPending={localPending}
          surveyPending={false}
          onOpenSurvey={() => undefined}
          onRefresh={refreshRemote}
        />
      )}
    </div>
  );
}
