/** Minimal browser fetch helpers for the island components. */

export async function postJson<T = any>(path: string, body: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as T };
}

export async function getJson<T = any>(path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(path, { method: 'GET', credentials: 'same-origin' });
  return { status: res.status, body: (await res.json().catch(() => null)) as T };
}

export interface ErrorBody {
  error?: { code?: string; message?: string };
}
