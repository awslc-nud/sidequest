import type { APIRoute } from 'astro';
import { getEventConfig } from '../../lib/config/loadEventConfig';
import type { EventConfig } from '../../lib/config/schema';
import { getPrisma } from '../../lib/db/client';
import { requireValidSession } from '../../lib/api/requireSession';
import { apiError, json, readJson, BodyTooLargeError } from '../../lib/api/http';
import { rateLimit } from '../../lib/rateLimit';
import { computeProgress } from '../../lib/progress/computeProgress';
import { nowMs } from '../../lib/time';
import { feedbackBodySchema } from '../../lib/validation/payloads';

/** Validate answer values against the question definitions in config. */
function validateAnswers(cfg: EventConfig, answers: Record<string, unknown>): { ok: true } | { ok: false; message: string } {
  const byId = new Map(cfg.feedback_keystone.questions.map((q) => [q.id, q]));
  for (const [id, value] of Object.entries(answers)) {
    const q = byId.get(id);
    if (!q) return { ok: false, message: `unknown question id: ${id}` };
    if (q.type === 'rating_1_4' && (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 4)) {
      return { ok: false, message: `question ${id} expects a rating from 1 to 4` };
    }
    if (q.type === 'text' && typeof value !== 'string') return { ok: false, message: `question ${id} expects text` };
    if (q.type === 'boolean' && typeof value !== 'boolean') return { ok: false, message: `question ${id} expects a boolean` };
  }
  return { ok: true };
}

/**
 * POST /api/feedback — submit the keystone survey (§3.5).
 * Accepted whenever feedback is enabled in config (the photo quests do **not**
 * have to be complete).
 *
 * The survey is recorded independently of quest progress: it gates the claim
 * (see `/api/claim`) but does not count towards progress or the chest unlock
 * (product decision — see `docs/ui-build.md` #29). This endpoint is shared by the
 * attendee modal and the standalone `/survey` form.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const cfg = getEventConfig();
  const prisma = await getPrisma();

  let body: unknown;
  try {
    body = await readJson(request);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return apiError('PAYLOAD_TOO_LARGE', 'request body too large', 413);
    throw e;
  }
  const parsed = feedbackBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError('INVALID_BODY', 'invalid feedback payload', 400);
  }
  const { session_id, answers } = parsed.data;

  if (!cfg.feedback_keystone.enabled) {
    return apiError('FEEDBACK_DISABLED', 'feedback is not enabled for this event', 400);
  }

  const sessionResult = await requireValidSession({
    bodySessionId: session_id,
    cookieSessionId: locals.sessionId,
    prisma,
    eventSlug: cfg.event_slug,
  });
  if (!sessionResult.ok) return sessionResult.response;
  const session = sessionResult.session;

  const limited = rateLimit(`feedback:${session.id}`, 10, 60_000);
  if (!limited.ok) {
    return apiError('RATE_LIMITED', 'too many attempts; please slow down', 429, {
      'retry-after': String(limited.retryAfterSeconds),
    });
  }

  if (session.feedbackDone) {
    return apiError('FEEDBACK_ALREADY_SUBMITTED', 'feedback has already been submitted', 409);
  }

  const answerCheck = validateAnswers(cfg, answers);
  if (!answerCheck.ok) {
    return apiError('INVALID_ANSWERS', answerCheck.message, 400);
  }

  const now = nowMs();
  const progress = await prisma.$transaction(async (tx) => {
    await tx.feedbackResponse.upsert({
      where: { sessionId: session.id },
      update: { answersJson: JSON.stringify(answers), submittedAt: BigInt(now) },
      create: {
        sessionId: session.id,
        eventSlug: cfg.event_slug,
        answersJson: JSON.stringify(answers),
        submittedAt: BigInt(now),
      },
    });
    await tx.session.update({ where: { id: session.id }, data: { feedbackDone: true } });

    return computeProgress(tx, session.id, cfg);
  });

  if (!progress) return apiError('SESSION_NOT_FOUND', 'session not found', 404);

  return json(
    {
      accepted: true,
      feedback_done: true,
      progress,
      chest_unlocked: progress.completed === progress.total,
    },
    200,
  );
};
