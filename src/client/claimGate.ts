/**
 * Premature-claim gate (§4.8). The "Generate Pass" CTA stays disabled until
 * the local retry list is drained AND the server reports N/N. The server-side
 * CHEST_NOT_UNLOCKED check (§4.5) is the authoritative backstop.
 */

export interface ClaimGateInput {
  pendingCount: number; // IndexedDB photos in pending/uploading/failed
  serverCompleted: number;
  serverTotal: number;
}

export function canShowClaimModal(input: ClaimGateInput): boolean {
  return input.pendingCount === 0 && input.serverCompleted === input.serverTotal;
}
