import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUploadQueue } from '../../src/client/uploadQueue';
import { db, getLocalPhotosForPrompt } from '../../src/client/db/indexedDb';

const SID = '11111111-1111-4111-8111-111111111111';
const CID = '22222222-2222-4222-8222-222222222222';

async function clearTables(): Promise<void> {
  await db.transaction('rw', db.photos, db.uiCache, async () => {
    await db.photos.clear();
    await db.uiCache.clear();
  });
}

async function waitFor(pred: () => Promise<boolean>, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await pred()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('waitFor timed out');
}

beforeEach(clearTables);
afterEach(clearTables);

function record() {
  return {
    clientCaptureId: CID,
    promptId: 'prompt_1_arrival',
    blob: new Blob([new Uint8Array(32)], { type: 'image/webp' }),
    sizeBytes: 32,
    capturedAt: Date.now(),
  };
}

describe('upload queue lifecycle (terminal failure + retry)', () => {
  it('retries up to maxAttempts, then stops and reports a terminal failure', async () => {
    const terminalFlags: boolean[] = [];
    const queue = createUploadQueue({
      postUpload: async () => ({ status: 500, body: { error: { code: 'STORAGE_WRITE_FAILED' } } }),
      sessionIdProvider: () => SID,
      sleep: async () => undefined,
      rand: () => 0,
      maxAttempts: 3,
      onFailed: (_p, _e, info) => terminalFlags.push(info.terminal),
    });

    await queue.stage(record());

    await waitFor(async () => {
      const [p] = await getLocalPhotosForPrompt('prompt_1_arrival');
      return p?.status === 'failed' && p.attempts === 3;
    });

    expect(terminalFlags.filter(Boolean)).toHaveLength(1); // only the last failure is terminal
    expect(terminalFlags.filter((t) => !t)).toHaveLength(2);
  });

  it('retryPrompt resets a terminal failure and a later success syncs it', async () => {
    let mode: 'fail' | 'ok' = 'fail';
    const synced: string[] = [];
    const queue = createUploadQueue({
      postUpload: async () =>
        mode === 'fail' ? { status: 500, body: {} } : { status: 201, body: { accepted: true } },
      sessionIdProvider: () => SID,
      sleep: async () => undefined,
      rand: () => 0,
      maxAttempts: 2,
      onSynced: (promptId) => synced.push(promptId),
    });

    await queue.stage(record());
    await waitFor(async () => {
      const [p] = await getLocalPhotosForPrompt('prompt_1_arrival');
      return p?.status === 'failed' && p.attempts === 2;
    });

    mode = 'ok';
    await queue.retryPrompt('prompt_1_arrival');

    await waitFor(async () => {
      const [p] = await getLocalPhotosForPrompt('prompt_1_arrival');
      return p?.status === 'synced';
    });
    expect(synced).toContain('prompt_1_arrival');
  });
});
