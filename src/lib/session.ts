import { randomUUID } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { isUuidV4 } from './tokens/claimToken';
import { sessionMaxAgeSeconds } from './env';

export const SESSION_COOKIE = 'sq_session';
export const MARSHAL_COOKIE = 'sq_marshal';

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  maxAge?: number;
}

/**
 * Whether the cookie should carry the `Secure` flag. `Secure` cookies are
 * rejected by browsers on plain-HTTP non-localhost origins (e.g. a LAN IP),
 * which previously broke anonymous sessions in dev. Default to secure only on
 * actual HTTPS (directly, or via a TLS-terminating proxy's X-Forwarded-Proto).
 */
export function requestIsSecure(url: URL, headers: Headers): boolean {
  const forwarded = headers.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim().toLowerCase() === 'https';
  return url.protocol === 'https:';
}

/** Shared cookie flags from §3.2 (attendee) and §3.8 (marshal, Strict). */
export function cookieOptions(
  maxAgeSeconds: number,
  sameSite: 'lax' | 'strict' = 'lax',
  secure = true,
): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/** Read the attendee session id from the cookie, if present and well-formed. */
export function readSessionId(cookies: AstroCookies): string | undefined {
  const value = cookies.get(SESSION_COOKIE)?.value;
  return value && isUuidV4(value) ? value : undefined;
}

/** Set the attendee session cookie to a specific id. */
export function setSessionCookie(cookies: AstroCookies, id: string, secure = true): void {
  cookies.set(SESSION_COOKIE, id, cookieOptions(sessionMaxAgeSeconds(), 'lax', secure));
}

/** Mint a new attendee session cookie and return its id. */
export function mintSessionCookie(cookies: AstroCookies, secure = true): string {
  const id = randomUUID();
  setSessionCookie(cookies, id, secure);
  return id;
}

/** Return the existing session id, minting a cookie if absent. */
export function ensureSessionId(cookies: AstroCookies, secure = true): string {
  return readSessionId(cookies) ?? mintSessionCookie(cookies, secure);
}

/** Read the marshal session token from its cookie. */
export function readMarshalToken(cookies: AstroCookies): string | undefined {
  const value = cookies.get(MARSHAL_COOKIE)?.value;
  return value && /^[0-9a-f]{64}$/.test(value) ? value : undefined;
}
