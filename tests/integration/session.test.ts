import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer, type TestServer } from '../helpers/server';
import { ApiClient } from '../helpers/api';

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe('POST /api/session (§3.2)', () => {
  it('mints a session on first call and resumes it on the second', async () => {
    const client = new ApiClient(server.baseUrl);
    const first = await client.postJson('/api/session', {});
    expect(first.status).toBe(201);
    const b1 = await first.json();
    expect(b1.created).toBe(true);

    const second = await client.postJson('/api/session', {});
    expect(second.status).toBe(200);
    const b2 = await second.json();
    expect(b2.created).toBe(false);
    expect(b2.session_id).toBe(b1.session_id);
  });

  it('sets an httpOnly sq_session cookie', async () => {
    const client = new ApiClient(server.baseUrl);
    await client.postJson('/api/session', {});
    expect(client.sessionCookie).toBeDefined();
  });

  it('mints a distinct session for a different (cookie-less) client', async () => {
    const a = await ApiClient.newSession(server.baseUrl);
    const b = await ApiClient.newSession(server.baseUrl);
    expect(a.sessionId).not.toBe(b.sessionId);
  });
});
