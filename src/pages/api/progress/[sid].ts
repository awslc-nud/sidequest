import type { APIRoute } from 'astro';
import { getEventConfig } from '../../../lib/config/loadEventConfig';
import { getPrisma } from '../../../lib/db/client';
import { computeProgress } from '../../../lib/progress/computeProgress';
import { apiError, json, num } from '../../../lib/api/http';

/**
 * GET /api/progress/:sid — polled by the attendee UI (§3.4 / §2.5).
 *
 * The server's submission list is canonical for the completed/K count. When a
 * claim already exists for the session it is embedded as a sub-object.
 */
export const GET: APIRoute = async ({ params }) => {
  const sid = params.sid as string | undefined;
  if (!sid) return apiError('SESSION_NOT_FOUND', 'session not found', 404);

  const cfg = getEventConfig();
  const prisma = await getPrisma();

  const session = await prisma.session.findUnique({ where: { id: sid } });
  if (!session || session.eventSlug !== cfg.event_slug) {
    return apiError('SESSION_NOT_FOUND', 'session not found', 404);
  }

  const progress = await computeProgress(prisma, sid, cfg);
  if (!progress) return apiError('SESSION_NOT_FOUND', 'session not found', 404);

  const claim = await prisma.claim.findUnique({ where: { sessionId: sid } });
  const claimSub = claim
    ? {
        claim_token: claim.claimToken,
        short_code: claim.shortCode,
        is_claimed: claim.isClaimed,
        claimed_at: num(claim.claimedAt),
      }
    : null;

  return json({
    session_id: session.id,
    completed_prompt_ids: progress.completed_prompt_ids,
    feedback_done: session.feedbackDone,
    completed: progress.completed,
    total: progress.total,
    chest_unlocked: session.unlockedAt !== null,
    unlocked_at: num(session.unlockedAt),
    claim: claimSub,
  });
};
