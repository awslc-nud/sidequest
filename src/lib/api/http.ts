/** Shared JSON helpers for API route modules (§3). */

export function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
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

/** Parse a JSON request body; returns undefined if the body is not valid JSON. */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
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
