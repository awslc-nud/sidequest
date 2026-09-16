import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PhotoValidationError,
  countPendingPhotos,
  db,
  getPhoto,
  getNextPendingPhoto,
  putPhoto,
  resetStaleUploadingPhotos,
  retryFailedForPrompt,
  setUiSession,
  transitionPhotoStatus,
  type PhotoRecord,
} from '../../src/client/db/indexedDb';

function record(id: string, prompt: string): PhotoRecord {
  return {
    clientCaptureId: id,
    promptId: prompt,
    blob: new Blob([new Uint8Array(100)], { type: 'image/webp' }),
    sizeBytes: 100,
    capturedAt: Date.now(),
    status: 'pending',
    attempts: 0,
    lastAttemptAt: null,
  };
}

const uuid = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;

async function clearTables(): Promise<void> {
  await db.transaction('rw', db.photos, db.uiCache, async () => {
    await db.photos.clear();
    await db.uiCache.clear();
  });
}

beforeEach(clearTables);
afterEach(clearTables);

describe('IndexedDB schema + client-side validation rules (§2.4)', () => {
  it('creates photos + uiCache stores with the expected indexes', () => {
    expect(db.photos.name).toBe('photos');
    expect(db.uiCache.name).toBe('uiCache');
    expect(db.verno).toBe(1);
  });

  it('rejects oversized / non-webp blobs', async () => {
    const tooBig = { ...record(uuid(1), 'p1'), blob: new Blob([new Uint8Array(2_000_001)], { type: 'image/webp' }) };
    await expect(putPhoto(tooBig, 'sess')).rejects.toThrow(PhotoValidationError);

    const wrongMime = { ...record(uuid(2), 'p1'), blob: new Blob([new Uint8Array(10)], { type: 'image/png' }) };
    await expect(putPhoto(wrongMime, 'sess')).rejects.toThrow(PhotoValidationError);
  });

  it('re-confirming a prompt replaces rather than appends', async () => {
    await putPhoto(record(uuid(1), 'prompt_2_stage'), 'sess');
    await putPhoto(record(uuid(2), 'prompt_2_stage'), 'sess');
    expect(await getPhoto(uuid(1))).toBeUndefined();
    expect(await getPhoto(uuid(2))).toBeDefined();
    const all = await db.photos.toArray();
    expect(all).toHaveLength(1);
  });

  it('enforces one-directional status transitions', async () => {
    await putPhoto(record(uuid(1), 'p1'), 'sess');
    // pending -> synced directly is illegal
    await expect(transitionPhotoStatus(uuid(1), 'synced')).rejects.toThrow(PhotoValidationError);
    // legal path
    await transitionPhotoStatus(uuid(1), 'uploading');
    await transitionPhotoStatus(uuid(1), 'failed');
    await transitionPhotoStatus(uuid(1), 'pending'); // retry allowed
    // synced is terminal
    await transitionPhotoStatus(uuid(1), 'uploading');
    await transitionPhotoStatus(uuid(1), 'synced');
    await expect(transitionPhotoStatus(uuid(1), 'pending')).rejects.toThrow(PhotoValidationError);
  });

  it('maintains uiCache pending count and next-pending ordering', async () => {
    await setUiSession('sess');
    await putPhoto(record(uuid(1), 'p1'), 'sess');
    await putPhoto(record(uuid(2), 'p2'), 'sess');
    expect(await countPendingPhotos()).toBe(2);
    const next = await getNextPendingPhoto();
    expect(next?.clientCaptureId).toBe(uuid(1)); // capturedAt order
    const ui = await db.uiCache.get('uiCache');
    expect(ui?.pendingCountCached).toBe(2);
  });

  it('skips records that exhausted retries, and retryFailedForPrompt recovers them', async () => {
    await setUiSession('sess');
    await putPhoto(record(uuid(1), 'p1'), 'sess');
    await transitionPhotoStatus(uuid(1), 'uploading');
    await transitionPhotoStatus(uuid(1), 'failed', { attempts: 5 });

    expect(await getNextPendingPhoto(5)).toBeNull();
    expect(await retryFailedForPrompt('p1')).toBe(1);
    const next = await getNextPendingPhoto(5);
    expect(next?.clientCaptureId).toBe(uuid(1));
    expect(next?.attempts).toBe(0);
  });

  it('recovers records stranded in uploading (tab closed mid-flight)', async () => {
    await setUiSession('sess');
    await putPhoto(record(uuid(1), 'p1'), 'sess');
    await transitionPhotoStatus(uuid(1), 'uploading');
    await resetStaleUploadingPhotos();
    expect((await getPhoto(uuid(1)))?.status).toBe('failed');
  });
});
