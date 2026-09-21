import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer, type TestServer } from '../helpers/server';
import { ApiClient, pngBlob, webpBlob } from '../helpers/api';
import { filesIn, readCount, uploadDir } from '../helpers/db';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const PROMPTS = ['prompt_1_arrival', 'prompt_2_stage', 'prompt_3_booth'];

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

async function upload(
  client: ApiClient,
  sessionId: string,
  promptId: string,
  captureId: string,
  blob: Blob,
): Promise<Response> {
  return client.postForm('/api/upload', {
    session_id: sessionId,
    prompt_id: promptId,
    client_capture_id: captureId,
    file: blob,
  });
}

function filesForSession(sessionId: string, promptId: string): string[] {
  return filesIn(uploadDir(server, promptId)).filter((f) => f.startsWith(`${sessionId}_`));
}

function submissionsFor(sessionId: string): number {
  return readCount(server, 'submissions', `session_id = '${sessionId}'`);
}

/** Complete every photo quest on a fresh session; the chest unlocks at N/N (feedback excluded). */
async function unlockSession(): Promise<{ client: ApiClient; sessionId: string }> {
  const { client, sessionId } = await ApiClient.newSession(server.baseUrl);
  for (const prompt of PROMPTS) {
    const res = await upload(client, sessionId, prompt, randomUUID(), webpBlob(4096));
    expect([200, 201]).toContain(res.status);
  }
  return { client, sessionId };
}

describe('POST /api/upload (§3.3/§4.3)', () => {
  it('happy path: 201, file on disk at the expected path, submission recorded', async () => {
    const { client, sessionId } = await ApiClient.newSession(server.baseUrl);
    const captureId = randomUUID();
    const res = await upload(client, sessionId, 'prompt_1_arrival', captureId, webpBlob(2048));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.accepted).toBe(true);
    expect(body.progress.completed).toBe(1);
    expect(body.progress.total).toBe(3);

    const files = filesForSession(sessionId, 'prompt_1_arrival');
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^[0-9a-f-]+_\d+\.webp$/);
    expect(submissionsFor(sessionId)).toBe(1);
  });

  it('idempotent replay: same client_capture_id → 200, still one row', async () => {
    const { client, sessionId } = await ApiClient.newSession(server.baseUrl);
    const captureId = randomUUID();
    const first = await upload(client, sessionId, 'prompt_2_stage', captureId, webpBlob(2048));
    expect(first.status).toBe(201);
    expect(submissionsFor(sessionId)).toBe(1);
    const second = await upload(client, sessionId, 'prompt_2_stage', captureId, webpBlob(2048));
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.accepted).toBe(true);
    expect(submissionsFor(sessionId)).toBe(1);
    expect(filesForSession(sessionId, 'prompt_2_stage')).toHaveLength(1);
  });

  it('rejects an oversized file (2.5MB) with no file or row written; accepts 1.8MB', async () => {
    const { client, sessionId } = await ApiClient.newSession(server.baseUrl);
    const big = await upload(client, sessionId, 'prompt_1_arrival', randomUUID(), webpBlob(2_500_000));
    expect(big.status).toBe(400);
    expect((await big.json()).error.code).toBe('FILE_TOO_LARGE');
    expect(filesForSession(sessionId, 'prompt_1_arrival')).toHaveLength(0);
    expect(submissionsFor(sessionId)).toBe(0);

    const ok = await upload(client, sessionId, 'prompt_1_arrival', randomUUID(), webpBlob(1_800_000));
    expect(ok.status).toBe(201);
    expect(submissionsFor(sessionId)).toBe(1);
  });

  it('rejects a non-webp payload with INVALID_CONTENT_TYPE', async () => {
    const { client, sessionId } = await ApiClient.newSession(server.baseUrl);
    const res = await upload(client, sessionId, 'prompt_1_arrival', randomUUID(), pngBlob());
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_CONTENT_TYPE');
  });

  it('rejects an unknown prompt_id and a mismatched session', async () => {
    const { client, sessionId } = await ApiClient.newSession(server.baseUrl);
    const badPrompt = await upload(client, sessionId, 'prompt_nope', randomUUID(), webpBlob(1024));
    expect(badPrompt.status).toBe(400);
    expect((await badPrompt.json()).error.code).toBe('INVALID_PROMPT_ID');

    // body session_id ≠ the cookie session of this client → 403 SESSION_MISMATCH
    const other = await ApiClient.newSession(server.baseUrl);
    const res = await other.client.postForm('/api/upload', {
      session_id: sessionId, // belongs to a different client
      prompt_id: 'prompt_1_arrival',
      client_capture_id: randomUUID(),
      file: webpBlob(1024),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('SESSION_MISMATCH');
  });

  it('partitions uploads into distinct subfolders under the event root', async () => {
    const { client, sessionId } = await ApiClient.newSession(server.baseUrl);
    await upload(client, sessionId, 'prompt_1_arrival', randomUUID(), webpBlob(1024));
    await upload(client, sessionId, 'prompt_2_stage', randomUUID(), webpBlob(1024));

    const d1 = uploadDir(server, 'prompt_1_arrival');
    const d2 = uploadDir(server, 'prompt_2_stage');
    expect(d1).not.toBe(d2);
    expect(filesForSession(sessionId, 'prompt_1_arrival')).toHaveLength(1);
    expect(filesForSession(sessionId, 'prompt_2_stage')).toHaveLength(1);
    expect(filesForSession(sessionId, 'prompt_1_arrival')[0]).toMatch(new RegExp(`^${sessionId}_\\d+\\.webp$`));
    // dirs are under the event slug root
    expect(path.relative(uploadDir(server, '..'), d1)).toContain('tech-summit-2026');
  });

  it('rejects uploads after the chest is unlocked with 409 CHEST_ALREADY_UNLOCKED', async () => {
    const { client, sessionId } = await unlockSession();
    const res = await upload(client, sessionId, 'prompt_1_arrival', randomUUID(), webpBlob(1024));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('CHEST_ALREADY_UNLOCKED');
  });
});
