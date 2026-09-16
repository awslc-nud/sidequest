import { describe, expect, it } from 'vitest';
import { createUploadAdmissionQueue } from '../../src/lib/uploadAdmission/admissionQueue';

describe('Upload Admission Queue (§4.2b)', () => {
  it('MAX_CONCURRENT=2: 2 admitted immediately, 3 queued; each release admits exactly one more', async () => {
    const q = createUploadAdmissionQueue({ maxConcurrent: 2, maxQueueDepth: 40 });

    const a = await q.tryEnqueue();
    const b = await q.tryEnqueue();
    expect(a.admitted).toBe(true);
    expect(b.admitted).toBe(true);
    expect(q.stats().active).toBe(2);
    expect(q.stats().queued).toBe(0);

    // These stay pending until a slot frees up — do NOT await them yet.
    const waiters = [q.tryEnqueue(), q.tryEnqueue(), q.tryEnqueue()];
    expect(q.stats().queued).toBe(3);

    const releaseOf = (r: { admitted: true; release: () => void }) => r.release;
    const admittedOf = async (p: Promise<unknown>) =>
      (await p) as { admitted: true; release: () => void };

    // release slot A -> admits exactly one more (first waiter)
    releaseOf(a as any)();
    const c = await admittedOf(waiters[0]);
    expect(q.stats().active).toBe(2);
    expect(q.stats().queued).toBe(2);

    releaseOf(b as any)();
    const d = await admittedOf(waiters[1]);
    expect(q.stats().active).toBe(2);
    expect(q.stats().queued).toBe(1);

    releaseOf(c)();
    const e = await admittedOf(waiters[2]);
    expect(q.stats().active).toBe(2);
    expect(q.stats().queued).toBe(0);

    // drain remaining slots
    releaseOf(d)();
    releaseOf(e)();
    expect(q.stats().active).toBe(0);
  });

  it('MAX_QUEUE_DEPTH=2 rejects callers beyond capacity without waiting', async () => {
    const q = createUploadAdmissionQueue({ maxConcurrent: 1, maxQueueDepth: 2 });

    const first = await q.tryEnqueue();
    expect(first.admitted).toBe(true);

    const w1 = q.tryEnqueue();
    const w2 = q.tryEnqueue();
    expect(q.stats().queued).toBe(2);

    // beyond depth -> rejected immediately, without waiting
    const rejected = await q.tryEnqueue();
    expect(rejected.admitted).toBe(false);

    const releaseFirst = (first as { admitted: true; release: () => void }).release;
    releaseFirst();
    expect((await w1).admitted).toBe(true);
    releaseFirst();
    expect((await w2).admitted).toBe(true);
    expect(q.stats().queued).toBe(0);
    expect(q.stats().active).toBe(1);
    releaseFirst();
    expect(q.stats().active).toBe(0);
  });

  it('reports live stats for the burst test hook', async () => {
    const q = createUploadAdmissionQueue({ maxConcurrent: 4 });
    const admitted = await Promise.all([q.tryEnqueue(), q.tryEnqueue()]);
    expect(q.stats().active).toBe(2);
    expect(q.stats().maxConcurrent).toBe(4);
    for (const r of admitted) (r as { admitted: true; release: () => void }).release();
  });
});
