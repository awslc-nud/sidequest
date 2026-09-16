import { describe, expect, it } from 'vitest';
import { backoffDelayMs, MAX_BACKOFF_MS, JITTER_MS } from '../../src/client/uploadQueue';

const zeroRand = () => 0;

describe('client upload worker backoff (§4.2a)', () => {
  it('is monotonically non-decreasing and capped at 30s + jitter without Retry-After', () => {
    const delays: number[] = [];
    for (let attempts = 1; attempts <= 10; attempts++) {
      delays.push(backoffDelayMs(attempts, undefined, zeroRand));
    }
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
    }
    for (const d of delays) {
      expect(d).toBeLessThanOrEqual(MAX_BACKOFF_MS + JITTER_MS);
    }
    expect(delays[delays.length - 1]).toBe(MAX_BACKOFF_MS); // capped, not unbounded
  });

  it('honors a server Retry-After over the default curve', () => {
    // attempt 5 would otherwise wait 30s; Retry-After: 2 must win.
    const d = backoffDelayMs(5, 2, zeroRand);
    expect(d).toBe(2000);
  });

  it('jitter adds up to 500ms', () => {
    const d = backoffDelayMs(1, 2, () => 1);
    expect(d).toBe(2500);
  });
});
