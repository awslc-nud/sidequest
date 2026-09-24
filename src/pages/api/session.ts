import type { APIRoute } from 'astro';
import { getEventConfig } from '../../lib/config/loadEventConfig';
import { getPrisma } from '../../lib/db/client';
import { mintSessionCookie, readSessionId, requestIsSecure, setSessionCookie } from '../../lib/session';
import { nowMs } from '../../lib/time';
import { json, apiError } from '../../lib/api/http';
import { rateLimit, clientIp } from '../../lib/rateLimit';

/**
 * POST /api/session — idempotent anonymous session mint/resume (§3.2).
 *
 * No request body. The response's session id is always the one bound to the
 * `sq_session` cookie, so the client can mirror it and subsequent authenticated
 * requests (upload/feedback/claim) match. If the cookie references an existing
 * row for this event it is resumed (`200`); otherwise a fresh row is created
 * and the cookie (re)set (`201`).
 */
export const POST: APIRoute = async ({ cookies, url, request, clientAddress }) => {
  const limited = rateLimit(`session:${clientIp(request, clientAddress)}`, 30, 60_000);
  if (!limited.ok) {
    return apiError('RATE_LIMITED', 'too many session requests; please slow down', 429, {
      'retry-after': String(limited.retryAfterSeconds),
    });
  }

  const cfg = getEventConfig();
  const prisma = await getPrisma();
  const secure = requestIsSecure(url, request.headers);
  const cookieId = readSessionId(cookies);
  const now = nowMs();

  if (cookieId) {
    const existing = await prisma.session.findUnique({ where: { id: cookieId } });
    if (existing && existing.eventSlug === cfg.event_slug) {
      await prisma.session.update({
        where: { id: existing.id },
        data: { lastSeenAt: BigInt(now) },
      });
      setSessionCookie(cookies, existing.id, secure); // refresh expiry
      return json({ session_id: existing.id, created: false }, 200);
    }
  }

  // No cookie, unknown cookie, or cookie for another event → mint a fresh row.
  // (Middleware normally pre-mints a cookie, so `cookieId` is almost always set here.)
  const id = cookieId ?? mintSessionCookie(cookies, secure);
  setSessionCookie(cookies, id, secure);
  await prisma.session.create({
    data: {
      id,
      eventSlug: cfg.event_slug,
      createdAt: BigInt(now),
      lastSeenAt: BigInt(now),
    },
  });
  return json({ session_id: id, created: true }, 201);
};
