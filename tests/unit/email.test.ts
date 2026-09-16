import { describe, expect, it } from 'vitest';
import { matchesEmailSyntax, normalizeEmail, validateEmail } from '../../src/lib/validation/email';

const DOMAIN = 'school.edu.ph';

describe('email validation (AC-04)', () => {
  it('rejects a gmail address against school.edu.ph', () => {
    expect(validateEmail('test.user@gmail.com', DOMAIN)).toEqual({ ok: false, code: 'EMAIL_DOMAIN_MISMATCH' });
  });

  it('normalizes mixed-case to lowercase', () => {
    const r = validateEmail('Student.Name@School.EDU.PH', DOMAIN);
    expect(r).toEqual({ ok: true, email: 'student.name@school.edu.ph' });
  });

  it('rejects malformed strings as INVALID_EMAIL_SYNTAX', () => {
    for (const bad of ['no-at-sign', 'a@b', '', '   ', 'x@.com', 'a@b@c.com']) {
      expect(matchesEmailSyntax(normalizeEmail(bad))).toBe(false);
    }
  });

  it('accepts a plain institutional email', () => {
    const r = validateEmail('  First.Last@School.Edu.Ph  ', DOMAIN);
    expect(r).toEqual({ ok: true, email: 'first.last@school.edu.ph' });
  });
});
