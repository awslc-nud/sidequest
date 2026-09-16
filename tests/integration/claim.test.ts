import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { startServer, type TestServer } from '../helpers/server';
import { ApiClient, webpBlob } from '../helpers/api';
import { readCount } from '../helpers/db';

const PROMPTS = ['prompt_1_arrival', 'prompt_2_stage', 'prompt_3_booth'];

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

async function unlock(): Promise<{ client: ApiClient; sessionId: string }> {
  const { client, sessionId } = await ApiClient.newSession(server.baseUrl);
  for (const prompt of PROMPTS) {
    const res = await client.postForm('/api/upload', {
      session_id: sessionId,
      prompt_id: prompt,
      client_capture_id: randomUUID(),
      file: webpBlob(2048),
    });
    expect([200, 201]).toContain(res.status);
  }
  const fb = await client.postJson('/api/feedback', { session_id: sessionId, answers: { q1: 5, q2: 'ok' } });
  expect(fb.status).toBe(200);
  return { client, sessionId };
}

describe('POST /api/claim (§3.6/§4.5)', () => {
  it('rejects a claim before the chest is unlocked', async () => {
    const { client, sessionId } = await ApiClient.newSession(server.baseUrl);
    const res = await client.postJson('/api/claim', { session_id: sessionId, student_email: 'a@school.edu.ph' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('CHEST_NOT_UNLOCKED');
  });

  it('mints a pass with a normalized email and echoes loot', async () => {
    const { client, sessionId } = await unlock();
    const res = await client.postJson('/api/claim', {
      session_id: sessionId,
      student_email: 'Student.Name@School.EDU.PH',
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.student_email).toBe('student.name@school.edu.ph');
    expect(body.claim_token).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.short_code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
    expect(body.loot.length).toBeGreaterThan(0);

    const progress = await (await client.get(`/api/progress/${sessionId}`)).json();
    expect(progress.claim).not.toBeNull();
    expect(progress.claim.claim_token).toBe(body.claim_token);
    expect(progress.claim.is_claimed).toBe(false);
  });

  it('rejects a second claim from the same session (different email)', async () => {
    const { client, sessionId } = await unlock();
    await client.postJson('/api/claim', { session_id: sessionId, student_email: 'first@school.edu.ph' });
    const second = await client.postJson('/api/claim', { session_id: sessionId, student_email: 'second@school.edu.ph' });
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe('SESSION_ALREADY_CLAIMED');
  });

  it('rejects a duplicate email claimed by another session', async () => {
    const email = `dup.${randomUUID().slice(0, 8)}@school.edu.ph`;
    const a = await unlock();
    const first = await a.client.postJson('/api/claim', { session_id: a.sessionId, student_email: email });
    expect(first.status).toBe(201);

    const b = await unlock();
    const second = await b.client.postJson('/api/claim', { session_id: b.sessionId, student_email: email });
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe('EMAIL_ALREADY_CLAIMED');
  });

  it('rejects non-institutional domains and bad syntax server-side', async () => {
    const { client, sessionId } = await unlock();

    const mismatch = await client.postJson('/api/claim', { session_id: sessionId, student_email: 'x@gmail.com' });
    expect(mismatch.status).toBe(422);
    expect((await mismatch.json()).error.code).toBe('EMAIL_DOMAIN_MISMATCH');

    const badSyntax = await client.postJson('/api/claim', { session_id: sessionId, student_email: 'not-an-email' });
    expect(badSyntax.status).toBe(422);
    expect((await badSyntax.json()).error.code).toBe('INVALID_EMAIL_SYNTAX');

    expect(readCount(server, 'claims', `session_id = '${sessionId}'`)).toBe(0);
  });
});
