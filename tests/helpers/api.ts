/** Minimal cookie-jarring fetch client for exercising the SSR server like a browser. */

const ORIGIN_HEADER = 'origin';

function parseSetCookies(res: Response): Array<[string, string]> {
  const headers: string[] =
    typeof (res.headers as Headers).getSetCookie === 'function'
      ? (res.headers as Headers).getSetCookie()
      : [res.headers.get('set-cookie') ?? ''].filter(Boolean);
  const out: Array<[string, string]> = [];
  for (const h of headers) {
    const [pair] = h.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) out.push([pair.slice(0, idx).trim(), pair.slice(idx + 1).trim()]);
  }
  return out;
}

export class ApiClient {
  private jar = new Map<string, string>();

  constructor(readonly baseUrl: string) {}

  /** POST /api/session to mint a fresh attendee session on this client. */
  static async newSession(baseUrl: string): Promise<{ client: ApiClient; sessionId: string }> {
    const client = new ApiClient(baseUrl);
    const res = await client.postJson('/api/session', {});
    if (!res.ok) throw new Error(`session mint failed: ${res.status}`);
    const body = await jsonOf(res);
    return { client, sessionId: body.session_id as string };
  }

  get cookieHeader(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  get sessionCookie(): string | undefined {
    return this.jar.get('sq_session');
  }

  get marshalCookie(): string | undefined {
    return this.jar.get('sq_marshal');
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (!headers.has(ORIGIN_HEADER)) headers.set(ORIGIN_HEADER, this.baseUrl);
    if (this.jar.size > 0) headers.set('cookie', this.cookieHeader);
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers, redirect: 'manual' });
    for (const [name, value] of parseSetCookies(res)) {
      if (value === '') this.jar.delete(name);
      else this.jar.set(name, value);
    }
    return res;
  }

  async get(path: string): Promise<Response> {
    return this.request(path, { method: 'GET' });
  }

  async postJson(path: string, body: unknown): Promise<Response> {
    return this.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async postForm(path: string, fields: Record<string, string | Blob>, filename?: string): Promise<Response> {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === 'string') form.set(key, value);
      else form.set(key, value, filename ?? `${key}.webp`);
    }
    return this.request(path, { method: 'POST', body: form });
  }
}

/**
 * Build an image/webp blob of an arbitrary byte size for fixture uploads. The
 * first 12 bytes carry a real `RIFF....WEBP` magic so the server's content
 * sniffing accepts it; the rest is zero padding.
 */
export function webpBlob(size: number): Blob {
  const bytes = new Uint8Array(size);
  const magic = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
  for (let i = 0; i < magic.length && i < bytes.length; i += 1) bytes[i] = magic[i];
  return new Blob([bytes], { type: 'image/webp' });
}

export function pngBlob(size = 1024): Blob {
  return new Blob([new Uint8Array(size)], { type: 'image/png' });
}

export async function jsonOf(res: Response): Promise<any> {
  return res.json();
}
