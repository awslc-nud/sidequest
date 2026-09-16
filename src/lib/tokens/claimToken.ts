import { randomBytes, randomUUID } from 'node:crypto';

/** 32 symbols; excludes visually ambiguous 0/O and 1/I/L (§4.6). */
export const SHORT_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const SHORT_CODE_LENGTH = 4;

export const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Crypto-random 4-char fallback code (256 % 32 === 0, so indexing is unbiased). */
export function generateShortCode(): string {
  const buf = randomBytes(SHORT_CODE_LENGTH);
  let out = '';
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
    out += SHORT_CODE_ALPHABET[buf[i] % SHORT_CODE_ALPHABET.length];
  }
  return out;
}

/** UUIDv4 claim token, encoded into the QR. */
export function generateClaimToken(): string {
  return randomUUID();
}

export function isUuidV4(value: string): boolean {
  return UUID_V4_RE.test(value);
}
