import { afterEach, describe, expect, it } from 'vitest';
import { constantTimeEqual, isMarshalSecret } from '../../src/lib/marshal';

afterEach(() => {
  delete process.env.MARSHAL_SECRET_KEY;
});

describe('marshal passphrase compare (§3.8)', () => {
  it('constantTimeEqual matches equal strings and rejects differences', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe(false); // length-insensitive via hashing
    expect(constantTimeEqual('a'.repeat(100), 'a'.repeat(99) + 'b')).toBe(false);
  });

  it('isMarshalSecret accepts the right passphrase and rejects the wrong one', () => {
    process.env.MARSHAL_SECRET_KEY = 'event-passphrase-123';
    expect(isMarshalSecret('event-passphrase-123')).toBe(true);
    expect(isMarshalSecret('event-passphrase-124')).toBe(false);
  });

  it('fails closed when no secret is configured', () => {
    expect(isMarshalSecret('anything')).toBe(false);
  });
});
