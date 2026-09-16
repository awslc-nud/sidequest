/**
 * Email normalization + validation (§3.6/AC-04).
 *
 * Domain checking is deliberately separate from syntax checking so callers can
 * return the two distinct 422 error codes the API contract requires.
 */

// RFC-lite local/domain syntax: something@domain.tld with a real dot-TLD.
const SYNTAX_RE =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export type EmailValidation =
  | { ok: true; email: string }
  | { ok: false; code: 'INVALID_EMAIL_SYNTAX' }
  | { ok: false; code: 'EMAIL_DOMAIN_MISMATCH' };

/** trim + lowercase. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Loose RFC-lite syntax check. */
export function matchesEmailSyntax(email: string): boolean {
  return SYNTAX_RE.test(email);
}

/**
 * Validate an arbitrary email against the event's allowed institutional domain.
 * Returns the normalized email on success, or the specific 422 code.
 */
export function validateEmail(raw: string, allowedDomain: string): EmailValidation {
  const email = normalizeEmail(raw);
  if (!matchesEmailSyntax(email)) {
    return { ok: false, code: 'INVALID_EMAIL_SYNTAX' };
  }
  const domain = email.split('@')[1];
  if (domain !== allowedDomain.toLowerCase()) {
    return { ok: false, code: 'EMAIL_DOMAIN_MISMATCH' };
  }
  return { ok: true, email };
}
