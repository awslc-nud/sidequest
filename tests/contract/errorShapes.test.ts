import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { startServer, DEFAULT_SECRET, type TestServer } from '../helpers/server';
import { ApiClient, webpBlob } from '../helpers/api';

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe('contract: GET /api/config (§3.1)', () => {
  it('returns the public config subset with computed total_tasks', async () => {
    const client = new ApiClient(server.baseUrl);
    const res = await client.get('/api/config');
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.event_name).toBe('Tech Summit 2026');
    expect(body.event_slug).toBe('tech-summit-2026');
    expect(body.allowed_email_domain).toBe('school.edu.ph');
    expect(body.total_tasks).toBe(3); // photo quests only — survey excluded
    expect(Array.isArray(body.quests)).toBe(true);
    for (const q of body.quests) {
      expect(typeof q.id).toBe('string');
      expect(typeof q.title).toBe('string');
      expect(typeof q.description).toBe('string');
    }
    expect(body.feedback_keystone.enabled).toBe(true);
    expect(Array.isArray(body.feedback_keystone.questions)).toBe(true);

    const text = JSON.stringify(body);
    expect(text).not.toContain('MARSHAL_SECRET_KEY');
    expect(text).not.toContain('MARSHAL');
    expect(body.loot).toBeUndefined(); // loot/cost internals never leak
  });
});

describe('contract: error shape {error:{code,message}} (§3)', () => {
  const expectErrorShape = async (res: Response) => {
    const body = await res.json();
    expect(typeof body.error?.code).toBe('string');
    expect(body.error.code.length).toBeGreaterThan(0);
    expect(typeof body.error.message).toBe('string');
    return body;
  };

  it('404 progress for an unknown session', async () => {
    const client = new ApiClient(server.baseUrl);
    const res = await client.get(`/api/progress/${randomUUID()}`);
    expect(res.status).toBe(404);
    await expectErrorShape(res);
  });

  it('401 redeem without a marshal cookie', async () => {
    const { client } = await ApiClient.newSession(server.baseUrl);
    const res = await client.postJson('/api/marshal/redeem', { claim_token: randomUUID() });
    expect(res.status).toBe(401);
    await expectErrorShape(res);
  });

  it('400 redeem with neither token', async () => {
    const marshal = new ApiClient(server.baseUrl);
    await marshal.postForm('/marshal/auth', { passphrase: DEFAULT_SECRET });
    const res = await marshal.postJson('/api/marshal/redeem', {});
    expect(res.status).toBe(400);
    await expectErrorShape(res);
  });

  it('403 upload with a mismatched session', async () => {
    const { sessionId } = await ApiClient.newSession(server.baseUrl);
    const other = await ApiClient.newSession(server.baseUrl);
    const res = await other.client.postForm('/api/upload', {
      session_id: sessionId,
      prompt_id: 'prompt_1_arrival',
      client_capture_id: randomUUID(),
      file: webpBlob(1024),
    });
    expect(res.status).toBe(403);
    await expectErrorShape(res);
  });

  it('429 SERVER_BUSY carries Retry-After and the shared error shape', async () => {
    const throttled = await startServer({ env: { UPLOAD_CONCURRENCY: '1', UPLOAD_QUEUE_DEPTH: '0' } });
    try {
      const sessions = await Promise.all(
        Array.from({ length: 4 }, () => ApiClient.newSession(throttled.baseUrl)),
      );
      const results = await Promise.all(
        sessions.map(({ client, sessionId }) =>
          client.postForm('/api/upload', {
            session_id: sessionId,
            prompt_id: 'prompt_1_arrival',
            client_capture_id: randomUUID(),
            file: webpBlob(1024),
          }),
        ),
      );
      const busy = results.filter((r) => r.status === 429);
      expect(busy.length).toBeGreaterThan(0);
      for (const res of busy) {
        expect(res.headers.get('retry-after')).toBeTruthy();
        const body = await expectErrorShape(res);
        expect(body.error.code).toBe('SERVER_BUSY');
      }
    } finally {
      await throttled.stop();
    }
  }, 60_000);
});
