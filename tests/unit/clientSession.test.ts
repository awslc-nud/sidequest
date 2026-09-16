// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionMirror, ensureSessionId, getSessionIdFromMirror, mirrorSessionId } from '../../src/client/session';

const SID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SID2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('client session module (§2.5)', () => {
  it('contacts the server and mirrors the canonical cookie-bound id', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ session_id: SID, created: true }), { status: 201 }));
    const id = await ensureSessionId(fetchMock as any);
    expect(id).toBe(SID);
    expect(getSessionIdFromMirror()).toBe(SID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('adopts a new server id, overwriting a stale mirror (cookie was reset)', async () => {
    mirrorSessionId(SID); // stale mirror from a lost cookie
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ session_id: SID2 }), { status: 200 }));
    const id = await ensureSessionId(fetchMock as any);
    expect(id).toBe(SID2);
    expect(getSessionIdFromMirror()).toBe(SID2);
  });

  it('falls back to the mirror when the network fails', async () => {
    mirrorSessionId(SID);
    const fetchMock = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(ensureSessionId(fetchMock as any)).resolves.toBe(SID);
  });

  it('throws when offline with no mirror', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(ensureSessionId(fetchMock as any)).rejects.toThrow();
  });

  it('clearSessionMirror resets', () => {
    mirrorSessionId(SID);
    clearSessionMirror();
    expect(getSessionIdFromMirror()).toBeNull();
  });
});
