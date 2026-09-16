import Dexie from 'dexie';
import type { Table } from 'dexie';

/**
 * Client-side durable state (§2.4).
 *
 * Two object stores under database `sidequest-client`:
 *  - `photos`: compressed WebP blobs + upload status (NOT a work queue — the
 *    retry ordering is derived live from `status` on each worker tick).
 *  - `uiCache`: a single cached COUNT row for instant "Syncing N photos…"
 *    rendering, refreshed after every photos.put()/delete().
 */

export const DB_NAME = 'sidequest-client';
export const MAX_UPLOAD_BYTES = 2_000_000;
export const WEBP_MIME = 'image/webp';

export type PhotoStatus = 'pending' | 'uploading' | 'synced' | 'failed';

export interface PhotoRecord {
  clientCaptureId: string; // UUIDv4, primary key
  promptId: string;
  blob: Blob; // compressed WebP, <= 2MB hard ceiling
  sizeBytes: number;
  capturedAt: number; // epoch ms
  status: PhotoStatus;
  attempts: number;
  lastAttemptAt: number | null;
}

export interface LocalUiCache {
  key: 'uiCache'; // singleton row
  sessionId: string;
  pendingCountCached: number; // derived; refreshed after every photos.put()/delete()
}

/** Allowed one-directional status transitions (§2.4 rule 4). */
const ALLOWED_TRANSITIONS: Record<PhotoStatus, PhotoStatus[]> = {
  pending: ['uploading'],
  uploading: ['synced', 'failed'],
  failed: ['pending', 'uploading'],
  synced: [],
};

export class PhotoValidationError extends Error {
  constructor(message: string, readonly code: 'TOO_LARGE' | 'WRONG_MIME' | 'BAD_TRANSITION' | 'NO_SESSION') {
    super(message);
    this.name = 'PhotoValidationError';
  }
}

class SideQuestDb extends Dexie {
  photos!: Table<PhotoRecord, string>;
  uiCache!: Table<LocalUiCache, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      photos: 'clientCaptureId, promptId, status',
      uiCache: 'key',
    });
  }
}

const db = new SideQuestDb();

/** Wipe and reopen (tests / signed-out reset). */
export async function resetClientDb(): Promise<void> {
  await db.delete();
}

/**
 * Store a confirmed capture. Enforces the §2.4 client-side rules:
 *  1. size <= 2MB,  2. MIME === image/webp,  3. one record per promptId —
 *     re-confirming an already-completed prompt REPLACES (delete + insert).
 */
export async function putPhoto(record: PhotoRecord, sessionId: string): Promise<PhotoRecord> {
  if (!sessionId) throw new PhotoValidationError('session required before staging photos', 'NO_SESSION');
  if (record.blob.size > MAX_UPLOAD_BYTES) {
    throw new PhotoValidationError('blob exceeds the 2MB ceiling', 'TOO_LARGE');
  }
  if (record.blob.type !== WEBP_MIME) {
    throw new PhotoValidationError('blob must be image/webp', 'WRONG_MIME');
  }
  if (record.status !== 'pending') {
    throw new PhotoValidationError('photos enter the store as pending', 'BAD_TRANSITION');
  }

  await db.transaction('rw', db.photos, db.uiCache, async () => {
    const existing = await db.photos.where('promptId').equals(record.promptId).first();
    if (existing && existing.clientCaptureId !== record.clientCaptureId) {
      await db.photos.delete(existing.clientCaptureId); // replace, not append
    }
    await db.photos.put(record);
    await refreshUiCache(sessionId);
  });
  return record;
}/** Transition a photo's status, enforcing the §2.4 state machine. */
export async function transitionPhotoStatus(
  clientCaptureId: string,
  next: PhotoStatus,
  patch: Partial<PhotoRecord> = {},
): Promise<void> {
  await db.transaction('rw', db.photos, db.uiCache, async () => {
    const current = await db.photos.get(clientCaptureId);
    if (!current) return;
    if (current.status === next) return;
    if (!ALLOWED_TRANSITIONS[current.status].includes(next)) {
      throw new PhotoValidationError(`illegal status transition ${current.status} -> ${next}`, 'BAD_TRANSITION');
    }
    await db.photos.update(clientCaptureId, { status: next, ...patch });
    const ui = await db.uiCache.get('uiCache');
    if (ui) await refreshUiCache(ui.sessionId);
  });
}

async function refreshUiCache(sessionId: string): Promise<void> {
  const pendingCountCached = await db.photos
    .where('status')
    .anyOf(['pending', 'uploading', 'failed'])
    .count();
  await db.uiCache.put({ key: 'uiCache', sessionId, pendingCountCached });
}

/**
 * Next record to attempt, in capture order (§4.2a). Records that exhausted
 * their retry budget (`attempts >= maxAttempts`) are skipped so a terminal
 * failure surfaces to the user for a manual Retry rather than looping forever.
 */
export async function getNextPendingPhoto(maxAttempts = Number.POSITIVE_INFINITY): Promise<PhotoRecord | null> {
  const recs = await db.photos.where('status').anyOf(['pending', 'failed']).sortBy('capturedAt');
  return recs.find((r) => r.status === 'pending' || r.attempts < maxAttempts) ?? null;
}

/**
 * Startup recovery: any record left in `uploading` means the tab closed or
 * crashed mid-flight. There is only ever one worker per device, so demote them
 * to `failed` so they become eligible for retry instead of being stuck.
 */
export async function resetStaleUploadingPhotos(): Promise<void> {
  const uploading = await db.photos.where('status').equals('uploading').toArray();
  for (const p of uploading) {
    await db.photos.update(p.clientCaptureId, { status: 'failed', lastAttemptAt: Date.now() });
  }
}

/** Manual Retry: reset all failed photos for a prompt back to pending (attempts cleared). */
export async function retryFailedForPrompt(promptId: string): Promise<number> {
  const failed = await db.photos
    .where('promptId')
    .equals(promptId)
    .and((p) => p.status === 'failed')
    .toArray();
  for (const p of failed) {
    await db.photos.update(p.clientCaptureId, { status: 'pending', attempts: 0, lastAttemptAt: null });
  }
  if (failed.length > 0) {
    const ui = await db.uiCache.get('uiCache');
    if (ui) await refreshUiCache(ui.sessionId);
  }
  return failed.length;
}

/** Pending/uploading/failed count (optimistic UI, §4.8). */
export async function countPendingPhotos(): Promise<number> {
  return db.photos.where('status').anyOf(['pending', 'uploading', 'failed']).count();
}

export async function getPhoto(clientCaptureId: string): Promise<PhotoRecord | undefined> {
  return db.photos.get(clientCaptureId);
}

/** Local (non-synced) records staged for a prompt — optimistic UI source. */
export async function getLocalPhotosForPrompt(promptId: string): Promise<PhotoRecord[]> {
  return db.photos.where('promptId').equals(promptId).toArray();
}

/** Any locally staged photo in a non-synced state for the prompt. */
export async function hasUnsynchronizedPhoto(promptId: string): Promise<boolean> {
  const photos = await getLocalPhotosForPrompt(promptId);
  return photos.some((p) => p.status !== 'synced');
}

export async function setUiSession(sessionId: string): Promise<void> {
  await db.uiCache.put({ key: 'uiCache', sessionId, pendingCountCached: await countPendingPhotos() });
}

export { db };
