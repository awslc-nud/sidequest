import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer, DEFAULT_SECRET, type TestServer } from '../helpers/server';

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

/** POST a form to /api/session with fully controlled CSRF headers. */
async function formPost(headers: Record<string, string>): Promise<Response> {
  return fetch(`${server.baseUrl}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: '',
    redirect: 'manual',
  });
}

describe('form CSRF / origin checks', () => {
  it('allows a same-origin form post when Origin is absent (Sec-Fetch-Site present)', async () => {
    const res = await formPost({ 'sec-fetch-site': 'same-origin' });
    expect(res.status).not.toBe(403);
    expect([200, 201]).toContain(res.status);
  });

  it('allows a top-level user navigation (Sec-Fetch-Site: none)', async () => {
    const res = await formPost({ 'sec-fetch-site': 'none' });
    expect([200, 201]).toContain(res.status);
  });

  it('rejects a cross-site form post', async () => {
    const res = await formPost({ 'sec-fetch-site': 'cross-site', origin: 'http://evil.example' });
    expect(res.status).toBe(403);
    expect(await res.text()).toContain('Cross-site');
  });

  it('rejects a mismatched Origin when Sec-Fetch-Site is unavailable', async () => {
    const res = await formPost({ origin: 'http://evil.example' });
    expect(res.status).toBe(403);
  });

  it('allows a matching Origin when Sec-Fetch-Site is unavailable', async () => {
    const res = await formPost({ origin: server.baseUrl });
    expect([200, 201]).toContain(res.status);
  });

  it('allows a form post with no CSRF headers at all (legacy browsers)', async () => {
    const res = await formPost({});
    expect([200, 201]).toContain(res.status);
  });

  it('accepts a Cloudflare-Tunnel request: internal host, public Origin, XFP https', async () => {
    const res = await fetch(`${server.baseUrl}/api/session`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://sidequest.awslcnud.org', // public origin, not url.origin
        'sec-fetch-site': 'same-origin',
        'x-forwarded-proto': 'https',
        'cf-connecting-ip': '203.0.113.7',
      },
      body: '{}',
      redirect: 'manual',
    });
    expect([200, 201]).toContain(res.status);
    // XFP https → cookies are flagged Secure even though origin sees plain HTTP.
    expect((res.headers.get('set-cookie') ?? '').toLowerCase()).toContain('secure');
  });

  it('lets a same-origin marshal sign-in through without an Origin header', async () => {
    const res = await fetch(`${server.baseUrl}/marshal/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'sec-fetch-site': 'same-origin' },
      body: new URLSearchParams({ passphrase: DEFAULT_SECRET }),
      redirect: 'manual',
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/marshal');
  });
});
