/** Shared JSON helpers for API route modules (§3). */

import { jsonBodyLimitBytes } from '../env';

export function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extraHeaders },
  });
}

export interface ApiError {
  code: string;
  message: string;
}

/** All 4xx/5xx bodies share `{ error: { code, message } }` (§3). */
export function apiError(code: string, message: string, status: number, extraHeaders?: Record<string, string>): Response {
  return json({ error: { code, message } }, status, extraHeaders);
}

/** Thrown by `readJson` when a body exceeds its ceiling. */
export class BodyTooLargeError extends Error {
  constructor() {
    super('request body exceeds the configured limit');
    this.name = 'BodyTooLargeError';
  }
}

/**
 * Read a request body into memory, refusing anything over `maxBytes`. Works
 * regardless of `Content-Length` (chunked bodies included), so it closes the
 * "no/forged length header" bypass. Returns `null` when the limit is exceeded.
 */
export async function readBodyBytes(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Parse a JSON request body under a byte ceiling; returns undefined if the body
 * is not valid JSON. Throws `BodyTooLargeError` when the ceiling is exceeded so
 * callers can return a `413` distinct from an ordinary `400`.
 */
export async function readJson(request: Request, maxBytes = jsonBodyLimitBytes()): Promise<unknown> {
  const bytes = await readBodyBytes(request, maxBytes);
  if (bytes === null) throw new BodyTooLargeError();
  const text = new TextDecoder().decode(bytes);
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Serialize a BigInt value as a JSON-safe number (epoch-ms fits in Number). */
export function num(v: bigint | number | null | undefined): number | null {
  return v === null || v === undefined ? null : Number(v);
}
