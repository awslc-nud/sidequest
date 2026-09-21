// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import MissionsScreen from '../../src/screens/MissionsScreen';

const cfg = {
  event_name: 'Test Summit',
  event_slug: 'test-summit',
  event_date: 'Aug 29, 2026',
  event_venue: 'Main Campus',
  allowed_email_domain: 'school.edu.ph',
  quests: [
    { id: 'prompt_1_arrival', title: 'Arrival Selfie', description: 'd1' },
    { id: 'prompt_2_stage', title: 'Stage Slide', description: 'd2' },
    { id: 'prompt_3_booth', title: 'Sponsor Booth', description: 'd3' },
  ],
  feedback_keystone: { enabled: true, questions: [] },
  total_tasks: 3,
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/session')) return jsonRes({ session_id: '11111111-1111-4111-8111-111111111111', created: true }, 201);
    if (url.endsWith('/api/config')) return jsonRes(cfg);
    if (url.includes('/api/progress/')) {
      return jsonRes({
        session_id: '11111111-1111-4111-8111-111111111111',
        completed_prompt_ids: [],
        feedback_done: false,
        completed: 0,
        total: 3,
        chest_unlocked: false,
        unlocked_at: null,
        claim: null,
      });
    }
    return jsonRes({ error: { code: 'NOT_FOUND', message: 'nope' } }, 404);
  });
}

describe('MissionsScreen (backend wiring smoke)', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders config quests and server progress once bootstrapped', async () => {
    vi.stubGlobal('fetch', mockFetch());

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<MissionsScreen />);
    });
    await act(async () => {
      await sleep(80);
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Test Summit');
    expect(text).toContain('Aug 29, 2026 • Main Campus');
    expect(text).toContain('Arrival Selfie');
    expect(text).toContain('Sponsor Booth');
    expect(text).toContain('0 / 3 completed');
  });
});
