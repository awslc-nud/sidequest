import { describe, expect, it } from 'vitest';
import { canShowClaimModal } from '../../src/client/claimGate';

const base = { pendingCount: 0, serverCompleted: 3, serverTotal: 3, feedbackRequired: false, feedbackDone: false };

describe('premature claim gate (§4.8)', () => {
  it('returns false while photos are still pending even if server reads complete', () => {
    expect(canShowClaimModal({ ...base, pendingCount: 2, feedbackRequired: true, feedbackDone: true })).toBe(false);
    expect(canShowClaimModal({ ...base, pendingCount: 1, feedbackRequired: true, feedbackDone: true })).toBe(false);
  });

  it('returns false when server progress is not complete', () => {
    expect(canShowClaimModal({ ...base, serverCompleted: 2 })).toBe(false);
  });

  it('returns true only when photos are synced and server progress is complete', () => {
    expect(canShowClaimModal(base)).toBe(true);
  });

  it('returns false when a required survey is still outstanding', () => {
    expect(canShowClaimModal({ ...base, feedbackRequired: true, feedbackDone: false })).toBe(false);
  });

  it('returns true once the required survey is submitted', () => {
    expect(canShowClaimModal({ ...base, feedbackRequired: true, feedbackDone: true })).toBe(true);
  });

  it('ignores survey state when no survey is required', () => {
    expect(canShowClaimModal({ ...base, feedbackRequired: false, feedbackDone: false })).toBe(true);
  });
});
