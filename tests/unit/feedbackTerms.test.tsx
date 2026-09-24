// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import FeedbackForm from '../../src/components/react/FeedbackForm';
import type { PublicConfig } from '../../src/client/types';

const cfg = {
  event_name: 'Test',
  event_slug: 'test',
  event_date: null,
  event_venue: null,
  allowed_email_domain: 'school.edu.ph',
  quests: [],
  feedback_keystone: { enabled: true, questions: [{ id: 'q1', type: 'text', label: 'Any suggestions?' }] },
  terms: { quest: 'Quest rules', survey: 'Survey rules' },
  total_tasks: 0,
} as unknown as PublicConfig;

describe('FeedbackForm terms gate', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
  });

  it('shows the survey terms before the form', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<FeedbackForm cfg={cfg} sessionId="sid" onSubmitted={() => undefined} />));

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain('Survey rules');
    expect(container.textContent).not.toContain('One last thing');
  });
});
