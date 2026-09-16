/**
 * Client session module (§1.2 / §2.5 / §3.2).
 *
 * The real session id lives in an httpOnly `sq_session` cookie (server-minted
 * by middleware and `POST /api/session`). Because an httpOnly cookie is not
 * readable from JS, the id returned by `/api/session` is mirrored into
 * localStorage as the client-side key used to tag uploads / polls.
 */

const MIRROR_KEY = 'sq_session_id';

export function getSessionIdFromMirror(): string | null {
  try {
    return localStorage.getItem(MIRROR_KEY);
  } catch {
    return null;
  }
}

export function mirrorSessionId(id: string): void {
  try {
    localStorage.setItem(MIRROR_KEY, id);
  } catch {
    // private mode etc. — the httpOnly cookie still tracks the session server-side
  }
}

export function clearSessionMirror(): void {
  try {
    localStorage.removeItem(MIRROR_KEY);
  } catch {
    // ignore
  }
}

/**
 * Ensure we have the canonical session id: ask the server every time so the
 * returned id always matches the httpOnly `sq_session` cookie that the upload
 * endpoints validate against. (Trusting the localStorage mirror alone caused a
 * 403 SESSION_MISMATCH whenever the cookie was reset/evicted while the mirror
 * survived — e.g. reopening the tab after the cookie was cleared.)
 *
 * Falls back to the mirror only if the server is unreachable.
 */
export async function ensureSessionId(fetchImpl: typeof fetch = fetch): Promise<string> {
  try {
    const res = await fetchImpl('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      credentials: 'same-origin',
    });
    const body = (await res.json().catch(() => null)) as { session_id?: string } | null;
    if (res.ok && body?.session_id) {
      mirrorSessionId(body.session_id);
      return body.session_id;
    }
  } catch {
    // network error — fall through to the mirror
  }

  const mirrored = getSessionIdFromMirror();
  if (mirrored) return mirrored;
  throw new Error('unable to establish a session');
}
