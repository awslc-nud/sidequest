import { afterEach, describe, expect, it } from 'vitest';
import { rateLimit, resetRateLimits, clientIp } from '../../src/lib/rateLimit';

describe('rateLimit', () => {
  afterEach(() => {
    resetRateLimits();
    delete process.env.SIDEQUEST_RATE_LIMIT_DISABLED;
  });

  it('allows up to the limit then blocks with a retry-after', () => {
    expect(rateLimit('k', 2, 60_000, 1000).ok).toBe(true);
    expect(rateLimit('k', 2, 60_000, 1001).ok).toBe(true);
    const blocked = rateLimit('k', 2, 60_000, 1002);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets once the window elapses', () => {
    expect(rateLimit('k', 1, 1000, 0).ok).toBe(true);
    expect(rateLimit('k', 1, 1000, 500).ok).toBe(false);
    expect(rateLimit('k', 1, 1000, 1000).ok).toBe(true);
  });

  it('isolates buckets by key', () => {
    expect(rateLimit('a', 1, 1000, 0).ok).toBe(true);
    expect(rateLimit('b', 1, 1000, 0).ok).toBe(true);
    expect(rateLimit('a', 1, 1000, 1).ok).toBe(false);
  });

  it('derives the client IP from proxy headers', () => {
    const proxied = new Request('http://x/', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } });
    expect(clientIp(proxied)).toBe('1.2.3.4');
    const cf = new Request('http://x/', { headers: { 'cf-connecting-ip': '9.9.9.9' } });
    expect(clientIp(cf)).toBe('9.9.9.9');
  });

  it('falls back to the socket address so direct clients do not share one bucket', () => {
    const bare = new Request('http://x/');
    expect(clientIp(bare, '10.0.0.7')).toBe('10.0.0.7');
    // Proxy headers still win over the socket address.
    const proxied = new Request('http://x/', { headers: { 'x-forwarded-for': '1.2.3.4' } });
    expect(clientIp(proxied, '10.0.0.7')).toBe('1.2.3.4');
    expect(clientIp(bare)).toBe('unknown');
  });
});
