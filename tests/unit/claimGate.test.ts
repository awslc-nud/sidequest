import { describe, expect, it } from 'vitest';
import { canShowClaimModal } from '../../src/client/claimGate';

describe('premature claim gate (§4.8)', () => {
  it('returns false while photos are still pending even if server reads complete', () => {
    expect(canShowClaimModal({ pendingCount: 2, serverCompleted: 4, serverTotal: 4 })).toBe(false);
    expect(canShowClaimModal({ pendingCount: 1, serverCompleted: 4, serverTotal: 4 })).toBe(false);
  });

  it('returns false when server progress is not complete', () => {
    expect(canShowClaimModal({ pendingCount: 0, serverCompleted: 3, serverTotal: 4 })).toBe(false);
  });

  it('returns true only when both conditions hold', () => {
    expect(canShowClaimModal({ pendingCount: 0, serverCompleted: 4, serverTotal: 4 })).toBe(true);
  });
});
