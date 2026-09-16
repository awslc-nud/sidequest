import type { PrismaClient } from '../db/client';
import type { Session } from '../db/client';
import { apiError } from './http';

export type SessionResult =
  | { ok: true; session: Session }
  | { ok: false; response: Response };

/**
 * Shared session gate for attendee-only endpoints (upload/feedback/claim).
 *
 * - The `session_id` in the request body must equal the session id bound to the
 *   `sq_session` cookie (locals.sessionId) → else 403 SESSION_MISMATCH.
 * - The session row must exist and belong to the current event → else 404.
 */
export async function requireValidSession(args: {
  bodySessionId: string | undefined;
  cookieSessionId: string | undefined;
  prisma: PrismaClient;
  eventSlug: string;
}): Promise<SessionResult> {
  const { bodySessionId, cookieSessionId, prisma, eventSlug } = args;

  if (!bodySessionId || bodySessionId !== cookieSessionId) {
    return {
      ok: false,
      response: apiError('SESSION_MISMATCH', 'session_id does not match the authenticated session', 403),
    };
  }

  const session = await prisma.session.findUnique({ where: { id: bodySessionId } });
  if (!session || session.eventSlug !== eventSlug) {
    return {
      ok: false,
      response: apiError('SESSION_NOT_FOUND', 'session not found', 404),
    };
  }

  return { ok: true, session };
}
