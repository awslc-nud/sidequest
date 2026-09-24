import { defineMiddleware } from 'astro:middleware';
import { getPrisma } from './lib/db/client';
import { ensureSessionId, requestIsSecure } from './lib/session';
import { validateMarshal } from './lib/marshal';

const MARSHAL_AUTH_PATH = '/marshal/auth';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const FORM_CONTENT_TYPES = [
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
];

function isAllowedFormOrigin(request: Request, url: URL): boolean {
  const method = request.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return true;

  const contentType = request.headers.get('content-type')?.toLowerCase();
  const needsOriginCheck = !contentType || FORM_CONTENT_TYPES.some((type) => contentType.includes(type));
  if (!needsOriginCheck) return true;

  const requestOrigin = request.headers.get('origin');
  if (!requestOrigin) return false;

  const allowedOrigins = new Set([url.origin]);
  const configuredOrigin = process.env.ORIGIN;
  if (configuredOrigin) {
    try {
      allowedOrigins.add(new URL(configuredOrigin).origin);
    } catch {
      // Ignore an invalid optional ORIGIN value; the request URL remains the
      // only trusted origin in that case.
    }
  }

  return allowedOrigins.has(requestOrigin);
}

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

  // Cloudflare terminates HTTPS before forwarding plain HTTP to this server,
  // so Astro's built-in origin comparison sees the tunnel URL. Keep the same
  // form-CSRF protection while also accepting the public ORIGIN from Compose.
  if (!isAllowedFormOrigin(context.request, url)) {
    return new Response(`Cross-site ${context.request.method} form submissions are forbidden`, {
      status: 403,
    });
  }

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
