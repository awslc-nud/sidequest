/**
 * Premature-claim gate (§4.8). The "Generate Pass" CTA stays disabled until
 * the local retry list is drained AND the server reports N/N (photo quests) AND,
 * when a survey is enabled, the survey has been submitted. The server-side
 * CHEST_NOT_UNLOCKED / FEEDBACK_REQUIRED checks are the authoritative backstop.
 */

export interface ClaimGateInput {
  pendingCount: number; // IndexedDB photos in pending/uploading/failed
  serverCompleted: number;
  serverTotal: number;
  /** Whether an enabled feedback survey gates the claim. */
  feedbackRequired: boolean;
  /** Whether the survey has been submitted. */
  feedbackDone: boolean;
}

export function canShowClaimModal(input: ClaimGateInput): boolean {
  if (input.pendingCount !== 0) return false;
  if (input.serverCompleted !== input.serverTotal) return false;
  if (input.feedbackRequired && !input.feedbackDone) return false;
  return true;
}
