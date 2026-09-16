import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import type { PrismaClient } from './db/client';
import { MARSHAL_COOKIE, cookieOptions, readMarshalToken } from './session';
import { sessionMaxAgeSeconds, marshalSecretKey } from './env';
import { nowMs, nowMsBigInt } from './time';
import type { MarshalSession } from './db/client';

/** Hash-then-compare so both sides always have equal length (constant-time). */
export function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}

/** Verify a submitted passphrase against MARSHAL_SECRET_KEY. Fails closed when unset. */
export function isMarshalSecret(passphrase: string): boolean {
  const secret = marshalSecretKey();
  if (secret === '') return false;
  return constantTimeEqual(secret, passphrase);
}

export interface MarshalIdentity {
  token: string;
  label: string | null;
  expiresAt: bigint;
}

/** Look up the sq_marshal cookie against marshal_sessions (exists AND not expired). */
export async function validateMarshal(cookies: AstroCookies, prisma: PrismaClient): Promise<MarshalIdentity | null> {
  const token = readMarshalToken(cookies);
  if (!token) return null;
  const row = await prisma.marshalSession.findUnique({ where: { token } });
  if (!row) return null;
  if (row.expiresAt <= nowMsBigInt()) return null;
  return { token: row.token, label: row.label, expiresAt: row.expiresAt };
}

/** Insert a marshal_sessions row and set the httpOnly cookie. */
export async function createMarshalSession(
  cookies: AstroCookies,
  prisma: PrismaClient,
  opts: { label?: string; secure?: boolean },
): Promise<MarshalSession> {
  const now = nowMs();
  const token = randomBytes(32).toString('hex');
  const row = await prisma.marshalSession.create({
    data: {
      token,
      createdAt: BigInt(now),
      expiresAt: BigInt(now + sessionMaxAgeSeconds() * 1000),
      label: opts.label?.trim() ? opts.label.trim() : null,
    },
  });
  cookies.set(MARSHAL_COOKIE, token, cookieOptions(sessionMaxAgeSeconds(), 'strict', opts.secure ?? true));
  return row;
}
