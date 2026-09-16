import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { startServer } from '../helpers/server';
import { ApiClient, webpBlob } from '../helpers/api';
import { readCount } from '../helpers/db';

const PROMPTS = ['prompt_1_arrival', 'prompt_2_stage', 'prompt_3_booth'];

describe('burst load (§4.2b)', () => {
  it('50 concurrent uploads with UPLOAD_CONCURRENCY=4: all resolve 2xx/429, 429s carry Retry-After', async () => {
    const server = await startServer({ env: { UPLOAD_CONCURRENCY: '4', UPLOAD_QUEUE_DEPTH: '40' } });
    try {
      const sessions = await Promise.all(
        Array.from({ length: 50 }, () => ApiClient.newSession(server.baseUrl)),
      );

      const started = Date.now();
      const results = await Promise.all(
        sessions.map(({ client, sessionId }, i) =>
          client
            .postForm('/api/upload', {
              session_id: sessionId,
              prompt_id: PROMPTS[i % PROMPTS.length],
              client_capture_id: randomUUID(),
              file: webpBlob(2048),
            })
            .then(async (res) => ({ status: res.status, retryAfter: res.headers.get('retry-after') })),
        ),
      );
      const elapsed = Date.now() - started;

      expect(elapsed).toBeLessThan(20_000); // no request hangs
      const okStatuses = results.filter((r) => r.status === 201 || r.status === 200).length;
      const busy = results.filter((r) => r.status === 429);
      expect(okStatuses).toBeGreaterThan(0);
      expect(busy.length).toBeGreaterThan(0); // 50 > 4 active + 40 queued
      for (const r of results) {
        expect([200, 201, 429]).toContain(r.status);
        if (r.status === 429) {
          expect(r.retryAfter).toBeTruthy();
          expect(Number(r.retryAfter)).toBeGreaterThan(0);
        }
      }
      expect(readCount(server, 'submissions')).toBe(okStatuses);
    } finally {
      await server.stop();
    }
  }, 60_000);

  it('WAL smoke: 50 concurrent uploads with Admission Queue disabled all succeed (no SQLITE_BUSY)', async () => {
    const server = await startServer({ env: { SIDEQUEST_UPLOAD_QUEUE_DISABLED: '1' } });
    try {
      const sessions = await Promise.all(
        Array.from({ length: 50 }, () => ApiClient.newSession(server.baseUrl)),
      );
      const results = await Promise.all(
        sessions.map(({ client, sessionId }, i) =>
          client
            .postForm('/api/upload', {
              session_id: sessionId,
              prompt_id: PROMPTS[i % PROMPTS.length],
              client_capture_id: randomUUID(),
              file: webpBlob(4096),
            })
            .then(async (res) => res.status),
        ),
      );
      for (const status of results) expect(status).toBe(201);
      expect(readCount(server, 'submissions')).toBe(50);
    } finally {
      await server.stop();
    }
  }, 60_000);
});
