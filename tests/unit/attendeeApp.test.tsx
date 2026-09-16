// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import AttendeeApp from '../../src/components/react/AttendeeApp';

const cfg = {
  event_name: 'Test Event',
  event_slug: 'test-event',
  allowed_email_domain: 'school.edu.ph',
  quests: [
    { id: 'prompt_1_arrival', title: 'Arrival Selfie', description: 'd1' },
    { id: 'prompt_2_stage', title: 'Stage Slide', description: 'd2' },
  ],
  feedback_keystone: { enabled: true, questions: [] },
  total_tasks: 2,
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('AttendeeApp boot (smoke)', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('loads quests + progress once session/config/progress resolve', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/session')) return jsonRes({ session_id: '11111111-1111-4111-8111-111111111111', created: true }, 201);
      if (url.endsWith('/api/config')) return jsonRes(cfg);
      if (url.includes('/api/progress/')) {
        return jsonRes({
          session_id: '11111111-1111-4111-8111-111111111111',
          completed_prompt_ids: [],
          feedback_done: false,
          completed: 0,
          total: 2,
          chest_unlocked: false,
          unlocked_at: null,
          claim: null,
        });
      }
      return jsonRes({ error: { code: 'NOT_FOUND', message: 'nope' } }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<AttendeeApp />);
    });
    await act(async () => {
      await sleep(80);
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Arrival Selfie');
    expect(text).toContain('Stage Slide');
    expect(text).toContain('0/2');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('shows an error alert when config cannot load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/session')) return jsonRes({ session_id: '22222222-2222-4222-8222-222222222222' }, 201);
        return jsonRes({ error: { code: 'CONFIG_LOAD_FAILED', message: 'x' } }, 500);
      }),
    );

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<AttendeeApp />);
    });
    await act(async () => {
      await sleep(80);
    });
    expect(container.textContent).toContain('Event config could not be loaded');
  });
});
