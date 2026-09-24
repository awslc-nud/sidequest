import { rateLimitDisabled } from './env';

export interface RateLimitResult {
  ok: boolean;
  /** Seconds the caller should wait before retrying (0 when allowed). */
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Process-wide fixed-window rate limiter (§ defense against brute force,
 * session/upload flooding and other abuse). In-memory and single-instance by
 * design — this app runs as one Node process. Callers must supply a meaningful
 * key (client IP, or a validated session id where available).
 */
const buckets = new Map<string, Bucket>();
const PRUNE_THRESHOLD = 10_000;

function prune(now: number): void {
  if (buckets.size < PRUNE_THRESHOLD) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/** Consume one token for `key`. Never throws. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  if (rateLimitDisabled()) return { ok: true, retryAfterSeconds: 0 };

  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Best-effort client IP for rate-limit keys. Cloudflare sets
 * `CF-Connecting-IP` (and `X-Forwarded-For`) on requests delivered through a
 * Tunnel, so every attendee gets their own bucket. Fall back to the first
 * `X-Forwarded-For` hop, then the adapter-provided socket address
 * (`Astro.clientAddress`) for direct/LAN access — without that, every client
 * with no proxy in front shares the single `unknown` bucket and the venue-wide
 * limit trips falsely.
 */
export function clientIp(request: Request, socketAddress?: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return request.headers.get('cf-connecting-ip') ?? (first || socketAddress || 'unknown');
}

/** Test hook. */
export function resetRateLimits(): void {
  buckets.clear();
}
