// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import RewardPage from '../../src/components/react/RewardPage';
import { acceptTerms } from '../../src/client/terms';

const SID = '11111111-1111-4111-8111-111111111111';

const cfg = {
  event_name: 'Test Summit',
  event_slug: 'test-summit',
  event_date: null,
  event_venue: null,
  allowed_email_domain: 'school.edu.ph',
  quests: [
    { id: 'prompt_1_arrival', title: 'A', description: 'a' },
    { id: 'prompt_2_stage', title: 'B', description: 'b' },
    { id: 'prompt_3_booth', title: 'C', description: 'c' },
  ],
  feedback_keystone: { enabled: true, questions: [{ id: 'q1', type: 'text', label: 'Any suggestions?' }] },
  terms: { quest: 'Quest rules', survey: 'Survey rules' },
  total_tasks: 3,
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/api/session')) return jsonRes({ session_id: SID, created: true }, 201);
    if (url.endsWith('/api/config')) return jsonRes(cfg);
    if (url.includes('/api/progress/')) {
      return jsonRes({
        session_id: SID,
        completed_prompt_ids: ['prompt_1_arrival', 'prompt_2_stage', 'prompt_3_booth'],
        feedback_done: false,
        completed: 3,
        total: 3,
        chest_unlocked: true,
        unlocked_at: 1,
        claim: null,
      });
    }
    return jsonRes({ error: { code: 'NOT_FOUND', message: 'nope' } }, 404);
  });
}

describe('RewardPage survey modal terms', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('shows survey terms when the post-quest survey modal opens', async () => {
    vi.stubGlobal('fetch', mockFetch());

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<RewardPage loot={[]} />);
    });
    await act(async () => {
      await sleep(80);
    });

    const surveyButton = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Take the survey'),
    );
    expect(surveyButton).toBeTruthy();
    await act(async () => {
      surveyButton!.click();
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain('Survey rules');
  });

  it('still shows terms after the standalone survey terms were accepted', async () => {
    // Pre-accept the standalone surface; the reward modal has its own scope.
    acceptTerms('survey', cfg.terms.survey);
    vi.stubGlobal('fetch', mockFetch());

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<RewardPage loot={[]} />);
    });
    await act(async () => {
      await sleep(80);
    });
    const surveyButton = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Take the survey'),
    );
    await act(async () => {
      surveyButton!.click();
    });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
