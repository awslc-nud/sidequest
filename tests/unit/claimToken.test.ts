import { describe, expect, it } from 'vitest';
import {
  generateShortCode,
  generateClaimToken,
  isUuidV4,
  SHORT_CODE_ALPHABET,
} from '../../src/lib/tokens/claimToken';

const FORBIDDEN = new Set(['0', 'O', '1', 'I', 'L']);
const N = 100_000;

describe('claim token + short code generation (§4.6 / AC-05)', () => {
  it('never emits 0/O/1/I/L and stays collision-light across 100k generations', () => {
    const seen = new Set<string>();
    for (let i = 0; i < N; i++) {
      const code = generateShortCode();
      expect(code).toHaveLength(4);
      for (const ch of code) {
        expect(FORBIDDEN.has(ch)).toBe(false);
        expect(SHORT_CODE_ALPHABET).toContain(ch);
      }
      seen.add(code);
    }
    // 32^4 ≈ 1.05M keyspace; birthday collisions (~5k) are expected at 100k
    // draws, so assert uniqueness stays very high rather than absolute.
    expect(seen.size).toBeGreaterThan(94_000);
  });

  it('claim token is a valid UUIDv4', () => {
    for (let i = 0; i < 100; i++) {
      expect(isUuidV4(generateClaimToken())).toBe(true);
    }
  });
});
