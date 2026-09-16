import { defineMiddleware } from 'astro:middleware';
import { getPrisma } from './lib/db/client';
import { ensureSessionId, requestIsSecure } from './lib/session';
import { validateMarshal } from './lib/marshal';

const MARSHAL_AUTH_PATH = '/marshal/auth';

/**
 * Global request middleware (§1.2 / §3.8 / T022 + T035):
 *
 * 1. Attendee half — ensure an `sq_session` cookie exists on every response and
 *    expose the id on `locals.sessionId`. No DB write happens here; minting a
 *    real Session row is done by `POST /api/session`.
 *
 * 2. Marshal half — guard every `/marshal/*` page and `/api/marshal/*` route:
 *    the `sq_marshal` cookie must reference a live marshal_sessions row.
 *    Pages redirect to `/marshal/auth`; API routes get a `401` JSON body.
 *    `/marshal/auth` itself is always reachable.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, locals } = context;
  const { pathname } = new URL(url);

  const isMarshalArea = pathname === '/marshal' || pathname.startsWith('/marshal/');
  const isMarshalAuth = pathname === MARSHAL_AUTH_PATH || pathname.startsWith(MARSHAL_AUTH_PATH + '/');
  const isMarshalApi = pathname.startsWith('/api/marshal/');

  if (isMarshalArea || isMarshalApi) {
    if (!isMarshalAuth) {
      const prisma = await getPrisma();
      const identity = await validateMarshal(cookies, prisma);
      if (!identity) {
        locals.isMarshal = false;
        if (isMarshalApi) {
          return new Response(
            JSON.stringify({
              error: { code: 'MARSHAL_UNAUTHENTICATED', message: 'Marshal session missing or expired' },
            }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          );
        }
        return context.redirect(MARSHAL_AUTH_PATH, 302);
      }
      locals.isMarshal = true;
      locals.marshalLabel = identity.label;
    } else {
      locals.isMarshal = false;
    }
  }

  // Attendee session cookie: present on every page/endpoint response.
  locals.sessionId = ensureSessionId(cookies, requestIsSecure(url, context.request.headers));

  return next();
});
