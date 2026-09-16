import {
  countPendingPhotos,
  db,
  getNextPendingPhoto,
  putPhoto,
  resetStaleUploadingPhotos,
  retryFailedForPrompt,
  transitionPhotoStatus,
  type PhotoRecord,
} from './db/indexedDb';
import { getSessionIdFromMirror } from './session';

/**
 * Client-side serial retry worker (§4.2a / §4.1).
 *
 * Concurrency is hard-capped at 1 per device. The first attempt of each photo
 * is jittered by 0–3000ms so many devices finishing compression at nearly the
 * same instant don't all fire their first request in the same window. Failures
 * back off exponentially (capped at 30s) or honor a server `Retry-After`, up to
 * `maxAttempts`; after that the record is left `failed` for an explicit Retry.
 */

export const MAX_BACKOFF_MS = 30_000;
export const JITTER_MS = 500;
export const DEFAULT_MAX_ATTEMPTS = 5;

export interface UploadErrorInfo {
  status: number;
  retryAfterSeconds?: number;
}

export class UploadError extends Error {
  constructor(readonly info: UploadErrorInfo) {
    super(`upload failed with status ${info.status}`);
    this.name = 'UploadError';
  }
}

/** Pure backoff computation (exported for deterministic tests). */
export function backoffDelayMs(
  attempts: number,
  retryAfterSeconds?: number,
  rand: () => number = Math.random,
): number {
  const base =
    retryAfterSeconds && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempts);
  return base + rand() * JITTER_MS;
}

export interface UploadQueueDeps {
  postUpload: (form: {
    session_id: string;
    prompt_id: string;
    client_capture_id: string;
    blob: Blob;
  }) => Promise<{ status: number; retryAfter?: number; body?: any }>;
  sessionIdProvider?: () => string | null;
  sleep?: (ms: number) => Promise<void>;
  rand?: () => number;
  isOnline?: () => boolean;
  maxAttempts?: number;
  /** Fired when a record reaches the server (2xx, or 409 CHEST_ALREADY_UNLOCKED). */
  onSynced?: (promptId: string, body: any) => void;
  /** Fired after every failed attempt, with the current attempt count + terminal flag. */
  onFailed?: (promptId: string, error: unknown, info: { attempts: number; terminal: boolean }) => void;
}

export interface FailureInfo {
  attempts: number;
  terminal: boolean;
}

/** Browser multipart POST to /api/upload (shared by the default + island workers). */
export async function postUploadMultipart(form: {
  session_id: string;
  prompt_id: string;
  client_capture_id: string;
  blob: Blob;
}): Promise<{ status: number; retryAfter?: number; body?: any }> {
  const body = new FormData();
  body.set('session_id', form.session_id);
  body.set('prompt_id', form.prompt_id);
  body.set('client_capture_id', form.client_capture_id);
  body.set('file', form.blob, `${form.client_capture_id}.webp`);
  const res = await fetch('/api/upload', { method: 'POST', body, credentials: 'same-origin' });
  const raw = res.headers.get('retry-after');
  const retryAfter = raw ? Number(raw) : undefined;
  let parsed: any = null;
  try {
    parsed = await res.json();
  } catch {
    // ignore non-JSON error bodies
  }
  return { status: res.status, retryAfter, body: parsed };
}

export interface UploadQueue {
  wake(): void;
  running(): boolean;
  /** Stage a confirmed capture locally and nudge the worker (§4.1). */
  stage(record: Omit<PhotoRecord, 'status' | 'attempts' | 'lastAttemptAt'>): Promise<PhotoRecord>;
  /** Manually retry all terminally-failed photos for a prompt. */
  retryPrompt(promptId: string): Promise<void>;
}

export function createUploadQueue(deps: UploadQueueDeps): UploadQueue {
  const sessionIdProvider = deps.sessionIdProvider ?? getSessionIdFromMirror;
  const rand = deps.rand ?? Math.random;
  const isOnline = deps.isOnline ?? (() => (typeof navigator !== 'undefined' ? navigator.onLine !== false : true));
  const maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  let isRunning = false;
  let cancelSleep: (() => void) | null = null;

  // Backoff sleeps are cancellable so a manual Retry can proceed immediately
  // instead of waiting out the current exponential delay.
  const sleepMs =
    deps.sleep ??
    ((ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          cancelSleep = null;
          resolve();
        }, ms);
        cancelSleep = () => {
          clearTimeout(timer);
          cancelSleep = null;
          resolve();
        };
      }));

  async function processLoop(): Promise<void> {
    // Recover records stranded in `uploading` by a previous tab close/crash.
    await resetStaleUploadingPhotos();

    for (;;) {
      const record = await getNextPendingPhoto(maxAttempts);
      if (!record) return;

      if (!isOnline()) {
        // Wait for connectivity; the online event triggers a fresh wake().
        await sleepMs(2000);
        continue;
      }

      if (record.attempts === 0) {
        await sleepMs(rand() * 3000); // spread the initial burst across ~3s per device
      }

      try {
        await transitionPhotoStatus(record.clientCaptureId, 'uploading');
        const sessionId = sessionIdProvider();
        if (!sessionId) throw new Error('no session id mirrored yet');

        const res = await deps.postUpload({
          session_id: sessionId,
          prompt_id: record.promptId,
          client_capture_id: record.clientCaptureId,
          blob: record.blob,
        });

        if (res.status === 200 || res.status === 201) {
          await transitionPhotoStatus(record.clientCaptureId, 'synced');
          deps.onSynced?.(record.promptId, res.body);
        } else if (res.status === 409 && res.body?.error?.code === 'CHEST_ALREADY_UNLOCKED') {
          // Server is canonical; treat as terminal success — nothing more to send.
          await transitionPhotoStatus(record.clientCaptureId, 'synced');
          deps.onSynced?.(record.promptId, res.body);
        } else {
          throw new UploadError({ status: res.status, retryAfterSeconds: res.retryAfter });
        }
      } catch (error) {
        // Ensure a record never gets stuck in `uploading` if we got this far.
        const attempts = record.attempts + 1;
        const terminal = attempts >= maxAttempts;
        try {
          await transitionPhotoStatus(record.clientCaptureId, 'failed', {
            attempts,
            lastAttemptAt: Date.now(),
          });
        } catch {
          // last-resort: force back to failed so it can be retried
          await db.photos.update(record.clientCaptureId, { status: 'failed', lastAttemptAt: Date.now() });
        }
        deps.onFailed?.(record.promptId, error, { attempts, terminal });
        if (terminal) continue; // leave failed for manual Retry; move to the next record
        const retryAfterSeconds = error instanceof UploadError ? error.info.retryAfterSeconds : undefined;
        await sleepMs(backoffDelayMs(attempts, retryAfterSeconds, rand));
      }
    }
  }

  function wake(): void {
    if (isRunning) return;
    isRunning = true;
    void processLoop()
      .catch(() => undefined)
      .finally(() => {
        isRunning = false;
      });
  }

  return {
    wake,
    running(): boolean {
      return isRunning;
    },
    async stage(record): Promise<PhotoRecord> {
      const sessionId = sessionIdProvider();
      const stored = await putPhoto(
        { ...record, status: 'pending', attempts: 0, lastAttemptAt: null },
        sessionId ?? '',
      );
      await countPendingPhotos(); // keep cached count fresh after staging
      wake();
      return stored;
    },
    async retryPrompt(promptId: string): Promise<void> {
      cancelSleep?.(); // proceed immediately rather than waiting out the backoff
      await retryFailedForPrompt(promptId);
      wake();
    },
  };
}

/** Process-wide default worker (used by the attendee page in the feature pass). */
export const uploadQueue: UploadQueue = createUploadQueue({
  postUpload: postUploadMultipart,
});
