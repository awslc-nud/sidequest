import { defineMiddleware } from 'astro:middleware';
import { getPrisma } from './lib/db/client';
import { ensureSessionId, requestIsSecure } from './lib/session';
import { validateMarshal } from './lib/marshal';
import { MAX_REQUEST_BYTES } from './lib/env';

const MARSHAL_AUTH_PATH = '/marshal/auth';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const FORM_CONTENT_TYPES = [
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
];

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Defense-in-depth headers for every response (HTML and API alike). */
function withSecurityHeaders(response: Response, secure: boolean): Response {
  const headers = response.headers;
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('permissions-policy', 'camera=(self), microphone=(), geolocation=()');
  headers.set('content-security-policy', CSP);
  if (secure) headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  return response;
}

function isAllowedFormOrigin(request: Request, url: URL): boolean {
  const method = request.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return true;

  const contentType = request.headers.get('content-type')?.toLowerCase();
  const needsOriginCheck = !contentType || FORM_CONTENT_TYPES.some((type) => contentType.includes(type));
  if (!needsOriginCheck) return true;

  // `Sec-Fetch-Site` is the most reliable CSRF signal: every current browser
  // (Chromium/Firefox/Safari 16.4+) sends it, crucially including on same-origin
  // form POSTs where older iOS Safari omits `Origin`. A forged cross-site form
  // submission is always tagged `cross-site`.
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') return false;
  if (fetchSite === 'same-origin' || fetchSite === 'none') return true;

  // Fall back to `Origin` for older browsers. Accept the public `ORIGIN`
  // configured for the tunnel as well as the request's own origin.
  const requestOrigin = request.headers.get('origin');
  if (!requestOrigin) {
    // No signal at all (very old browser). State-changing requests remain
    // protected by SameSite cookies (Lax for attendees, Strict for marshals),
    // so allow rather than break legitimate form posts.
    return true;
  }

  const allowedOrigins = new Set<string>([url.origin]);
  const configuredOrigin = process.env.ORIGIN;
  if (configuredOrigin) {
    try {
      allowedOrigins.add(new URL(configuredOrigin).origin);
    } catch {
      // Ignore an invalid optional ORIGIN value; the request URL remains trusted.
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
  const secure = requestIsSecure(url, context.request.headers);

  // Coarse ceiling on every mutating request, including endpoints that never
  // read a body (e.g. /api/session). Fine-grained limits are enforced per route.
  if (!SAFE_METHODS.has(context.request.method.toUpperCase())) {
    const declared = Number(context.request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
      return withSecurityHeaders(
        new Response(JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'request body too large' } }), {
          status: 413,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        }),
        secure,
      );
    }
  }

  // Cloudflare terminates HTTPS before forwarding plain HTTP to this server,
  // so Astro's built-in origin comparison sees the tunnel URL. Keep the same
  // form-CSRF protection while also accepting the public ORIGIN from Compose.
  if (!isAllowedFormOrigin(context.request, url)) {
    return withSecurityHeaders(
      new Response(`Cross-site ${context.request.method} form submissions are forbidden`, { status: 403 }),
      secure,
    );
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
          return withSecurityHeaders(
            new Response(
              JSON.stringify({
                error: { code: 'MARSHAL_UNAUTHENTICATED', message: 'Marshal session missing or expired' },
              }),
              { status: 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
            ),
            secure,
          );
        }
        return withSecurityHeaders(context.redirect(MARSHAL_AUTH_PATH, 302), secure);
      }
      locals.isMarshal = true;
      locals.marshalLabel = identity.label;
    } else {
      locals.isMarshal = false;
    }
  }

  // Attendee session cookie: present on every page/endpoint response.
  locals.sessionId = ensureSessionId(cookies, secure);

  return withSecurityHeaders(await next(), secure);
});
