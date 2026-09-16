import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { startServer, DEFAULT_SECRET, type TestServer } from '../helpers/server';
import { ApiClient } from '../helpers/api';
import { insertClaim } from '../helpers/db';

const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function codeFromIndex(i: number): string {
  return (
    ALPHA[i % 32] +
    ALPHA[Math.floor(i / 32) % 32] +
    ALPHA[Math.floor(i / 1024) % 32] +
    ALPHA[Math.floor(i / 32768) % 32]
  );
}

let server: TestServer;
let marshal: ApiClient;

beforeAll(async () => {
  server = await startServer();
  marshal = new ApiClient(server.baseUrl);
  const auth = await marshal.postForm('/marshal/auth', { passphrase: DEFAULT_SECRET });
  expect(auth.status).toBe(302);
});

afterAll(async () => {
  await server.stop();
});

describe('concurrent redemption race (§4.7 / AC-05)', () => {
  it('exactly one of two parallel scans wins, 100 iterations, zero double-success', async () => {
    for (let i = 0; i < 100; i++) {
      const claimToken = randomUUID();
      insertClaim(server, {
        sessionId: randomUUID(),
        email: `race${i}@school.edu.ph`,
        claimToken,
        shortCode: codeFromIndex(i),
      });

      const [a, b] = await Promise.all([
        marshal.postJson('/api/marshal/redeem', { claim_token: claimToken }),
        marshal.postJson('/api/marshal/redeem', { claim_token: claimToken }),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([200, 409]);

      const winner = a.status === 200 ? a : b;
      const loser = a.status === 409 ? a : b;
      expect((await winner.json()).status).toBe('claimed');
      const loserBody = await loser.json();
      expect(loserBody.error.code).toBe('ALREADY_CLAIMED');
      expect(typeof loserBody.error.claimed_at).toBe('number');
    }
  }, 120_000);
});
