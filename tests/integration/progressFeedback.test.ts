import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { startServer, type TestServer } from '../helpers/server';
import { ApiClient, webpBlob } from '../helpers/api';
import { readCount } from '../helpers/db';

const PROMPTS = ['prompt_1_arrival', 'prompt_2_stage', 'prompt_3_booth'];
const FIXTURE_DIR = path.resolve(import.meta.dirname, '..', 'fixtures');

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

async function uploadAll(client: ApiClient, sessionId: string): Promise<void> {
  for (const prompt of PROMPTS) {
    const res = await client.postForm('/api/upload', {
      session_id: sessionId,
      prompt_id: prompt,
      client_capture_id: randomUUID(),
      file: webpBlob(2048),
    });
    expect([200, 201]).toContain(res.status);
  }
}

describe('progress + feedback (§3.4/§3.5/AC-03)', () => {
  it('unknown sid returns 404 SESSION_NOT_FOUND', async () => {
    const res = await serverRequest().get(`/api/progress/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('SESSION_NOT_FOUND');
  });

  it("refuses to read another browser's session by id (object-level auth)", async () => {
    const { sessionId } = await ApiClient.newSession(server.baseUrl);
    // A cookie-less client that merely knows the id must not see the session.
    const res = await serverRequest().get(`/api/progress/${sessionId}`);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('SESSION_NOT_FOUND');
  });

  it('feedback disabled fixture: N excludes feedback and the final upload unlocks', async () => {
    const off = await startServer({ configFile: path.join(FIXTURE_DIR, 'config.feedback-off.json') });
    try {
      const { client, sessionId } = await ApiClient.newSession(off.baseUrl);

      const pre = await client.get(`/api/progress/${sessionId}`);
      const preBody = await pre.json();
      expect(preBody.total).toBe(2); // feedback excluded from N
      expect(preBody.chest_unlocked).toBe(false);

      const first = await client.postForm('/api/upload', {
        session_id: sessionId,
        prompt_id: 'prompt_1_arrival',
        client_capture_id: randomUUID(),
        file: webpBlob(2048),
      });
      expect((await first.json()).chest_unlocked).toBe(false);

      const last = await client.postForm('/api/upload', {
        session_id: sessionId,
        prompt_id: 'prompt_2_stage',
        client_capture_id: randomUUID(),
        file: webpBlob(2048),
      });
      const lastBody = await last.json();
      expect(last.status).toBe(201);
      // chest flips in the SAME response that completes the Nth task
      expect(lastBody.progress.completed).toBe(2);
      expect(lastBody.progress.total).toBe(2);
      expect(lastBody.chest_unlocked).toBe(true);

      const post = await (await client.get(`/api/progress/${sessionId}`)).json();
      expect(post.completed).toBe(2);
      expect(post.chest_unlocked).toBe(true);
      expect(post.unlocked_at).not.toBeNull();
    } finally {
      await off.stop();
    }
  });

  it('survey is independent of quests, excluded from N, and does not change progress', async () => {
    const { client, sessionId } = await ApiClient.newSession(server.baseUrl);

    // The survey no longer requires the photo quests to be complete.
    const early = await client.postJson('/api/feedback', {
      session_id: sessionId,
      answers: { q1: 4, q2: 'x' },
    });
    expect(early.status).toBe(200);
    expect((await early.json()).feedback_done).toBe(true);

    // The progress ledger is untouched: still 0/3 and the chest stays locked.
    const pre = await (await client.get(`/api/progress/${sessionId}`)).json();
    expect(pre.completed).toBe(0);
    expect(pre.total).toBe(3); // survey excluded from N
    expect(pre.feedback_done).toBe(true);
    expect(pre.chest_unlocked).toBe(false);

    // Completing the 3 photo quests still unlocks the chest on the final upload.
    await uploadAll(client, sessionId);
    const after = await (await client.get(`/api/progress/${sessionId}`)).json();
    expect(after.completed).toBe(3);
    expect(after.total).toBe(3);
    expect(after.chest_unlocked).toBe(true);
    expect(after.feedback_done).toBe(true);

    // duplicate feedback is rejected
    const dup = await client.postJson('/api/feedback', { session_id: sessionId, answers: { q1: 1, q2: 'x' } });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error.code).toBe('FEEDBACK_ALREADY_SUBMITTED');

    expect(readCount(server, 'feedback_responses')).toBe(1);
  });

  it('rejects feedback when disabled by config', async () => {
    const off = await startServer({ configFile: path.join(FIXTURE_DIR, 'config.feedback-off.json') });
    try {
      const { client, sessionId } = await ApiClient.newSession(off.baseUrl);
      const res = await client.postJson('/api/feedback', { session_id: sessionId, answers: {} });
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('FEEDBACK_DISABLED');
    } finally {
      await off.stop();
    }
  });
});

function serverRequest(): ApiClient {
  return new ApiClient(server.baseUrl);
}
