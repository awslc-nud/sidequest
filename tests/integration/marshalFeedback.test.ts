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

async function marshalClient(): Promise<ApiClient> {
  const c = new ApiClient(server.baseUrl);
  const res = await c.postForm('/marshal/auth', { passphrase: DEFAULT_SECRET });
  expect(res.status).toBe(302);
  return c;
}

/** Complete every quest then submit the keystone survey. */
async function submitFeedback(answers: Record<string, unknown>): Promise<void> {
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
  const fb = await client.postJson('/api/feedback', { session_id: sessionId, answers });
  expect(fb.status).toBe(200);
}

describe('marshal survey results (read-side of §3.5)', () => {
  it('rejects an unauthenticated request', async () => {
    const c = new ApiClient(server.baseUrl);
    const res = await c.get('/api/marshal/feedback');
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('MARSHAL_UNAUTHENTICATED');
  });

  it('aggregates ratings/text and exports the raw responses as CSV', async () => {
    await submitFeedback({ q1: 4, q2: 'Loved it' });
    await submitFeedback({ q1: 2, q2: 'More snacks' });

    const marshal = await marshalClient();

    const res = await marshal.get('/api/marshal/feedback');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);

    const q1 = body.questions.find((q: { id: string }) => q.id === 'q1');
    expect(q1.type).toBe('rating_1_4');
    expect(q1.tally['4']).toBe(1);
    expect(q1.tally['2']).toBe(1);
    expect(q1.average).toBe(3);

    const q2 = body.questions.find((q: { id: string }) => q.id === 'q2');
    expect(q2.type).toBe('text');
    expect(q2.text).toEqual(expect.arrayContaining(['Loved it', 'More snacks']));

    // Flat questions are grouped into one (untitled) section in the fixture.
    expect(body.sections).toHaveLength(1);
    expect(body.sections[0].id).toBe('s1');
    expect(body.sections[0].title).toBeNull();
    expect(body.sections[0].questions.map((q: { id: string }) => q.id)).toEqual(['q1', 'q2']);

    const csv = await marshal.get('/api/marshal/feedback?format=csv');
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-type')).toContain('text/csv');
    expect(csv.headers.get('content-disposition')).toContain('attachment');
    const text = await csv.text();
    expect(text).toContain('How was the event?');
    expect(text).toContain('Loved it');
    expect(text).toContain('More snacks');
  });

  it('neutralizes spreadsheet formulas in free-text answers (CSV injection)', async () => {
    await submitFeedback({ q1: 4, q2: '=HYPERLINK("http://evil.example")' });

    const marshal = await marshalClient();
    const csv = await (await marshal.get('/api/marshal/feedback?format=csv')).text();
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain(',=HYPERLINK');
  });
});
