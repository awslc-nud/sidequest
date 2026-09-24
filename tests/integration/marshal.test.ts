import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { startServer, DEFAULT_SECRET, type TestServer } from '../helpers/server';
import { ApiClient, webpBlob } from '../helpers/api';
import { insertMarshalSession } from '../helpers/db';

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

async function mintClaim(): Promise<{ claimToken: string; shortCode: string }> {
  const { client, sessionId } = await ApiClient.newSession(server.baseUrl);
  for (const prompt of ['prompt_1_arrival', 'prompt_2_stage', 'prompt_3_booth']) {
    const res = await client.postForm('/api/upload', {
      session_id: sessionId,
      prompt_id: prompt,
      client_capture_id: randomUUID(),
      file: webpBlob(1024),
    });
    expect([200, 201]).toContain(res.status);
  }
  await client.postJson('/api/feedback', { session_id: sessionId, answers: { q1: 4, q2: 'ok' } });
  const claim = await client.postJson('/api/claim', {
    session_id: sessionId,
    student_email: `${randomUUID().slice(0, 8)}@school.edu.ph`,
  });
  expect(claim.status).toBe(201);
  const body = await claim.json();
  return { claimToken: body.claim_token, shortCode: body.short_code };
}

async function marshalClient(): Promise<ApiClient> {
  const c = new ApiClient(server.baseUrl);
  const res = await c.postForm('/marshal/auth', { passphrase: DEFAULT_SECRET });
  expect(res.status).toBe(302);
  return c;
}

describe('marshal auth (§3.8) + redeem (§3.7/§4.7)', () => {
  it('redirects unauthenticated /marshal to /marshal/auth', async () => {
    const c = new ApiClient(server.baseUrl);
    const res = await c.get('/marshal');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/marshal/auth');
  });

  it('rejects a wrong passphrase with 403 and no cookie', async () => {
    const c = new ApiClient(server.baseUrl);
    const res = await c.postForm('/marshal/auth', { passphrase: 'definitely-wrong' });
    expect(res.status).toBe(403);
    expect(c.marshalCookie).toBeUndefined();
  });

  it('authenticates with the correct passphrase and sets sq_marshal', async () => {
    const c = new ApiClient(server.baseUrl);
    const res = await c.postForm('/marshal/auth', { passphrase: DEFAULT_SECRET, label: 'North Gate' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/marshal');
    expect(c.marshalCookie).toBeDefined();

    const page = await c.get('/marshal');
    expect(page.status).toBe(200);
  });

  it('returns 401 for redeem without a marshal cookie', async () => {
    const { client } = await ApiClient.newSession(server.baseUrl);
    const res = await client.postJson('/api/marshal/redeem', { claim_token: randomUUID() });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('MARSHAL_UNAUTHENTICATED');
  });

  it('redeems by claim_token and again via short_code', async () => {
    const { claimToken, shortCode } = await mintClaim();
    const marshal = await marshalClient();

    const byToken = await marshal.postJson('/api/marshal/redeem', { claim_token: claimToken });
    expect(byToken.status).toBe(200);
    const ok = await byToken.json();
    expect(ok.status).toBe('claimed');
    expect(ok.student_email).toMatch(/@school\.edu\.ph$/);
    expect(typeof ok.claimed_at).toBe('number');
    expect(Array.isArray(ok.loot)).toBe(true);

    const { claimToken: c2, shortCode: code2 } = await mintClaim();
    const byCode = await marshal.postJson('/api/marshal/redeem', { short_code: code2 });
    expect(byCode.status).toBe(200);
    expect((await byCode.json()).status).toBe('claimed');
    void claimToken;
    void shortCode;
    void c2;
  });

  it('double-scan of an already-claimed pass returns 409 with claimed_at', async () => {
    const { claimToken } = await mintClaim();
    const marshal = await marshalClient();
    const first = await marshal.postJson('/api/marshal/redeem', { claim_token: claimToken });
    expect(first.status).toBe(200);

    const again = await marshal.postJson('/api/marshal/redeem', { claim_token: claimToken });
    expect(again.status).toBe(409);
    const body = await again.json();
    expect(body.error.code).toBe('ALREADY_CLAIMED');
    expect(typeof body.error.claimed_at).toBe('number');
    expect(body.error.message).toMatch(/^ALREADY CLAIMED at /);
  });

  it('validates token presence and existence', async () => {
    const marshal = await marshalClient();
    const missing = await marshal.postJson('/api/marshal/redeem', {});
    expect(missing.status).toBe(400);
    expect((await missing.json()).error.code).toBe('MISSING_TOKEN');

    const unknown = await marshal.postJson('/api/marshal/redeem', { claim_token: randomUUID() });
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).error.code).toBe('TOKEN_NOT_FOUND');
  });

  it('treats an expired marshal session as unauthenticated', async () => {
    const expiredToken = 'e'.repeat(64);
    insertMarshalSession(server, { token: expiredToken, expiresAt: Date.now() - 60_000 });
    const raw = await fetch(`${server.baseUrl}/marshal`, {
      headers: { origin: server.baseUrl, cookie: `sq_marshal=${expiredToken}` },
      redirect: 'manual',
    });
    expect(raw.status).toBe(302);
    expect(raw.headers.get('location')).toBe('/marshal/auth');
  });
});
