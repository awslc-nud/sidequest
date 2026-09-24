// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import FeedbackForm from '../../src/components/react/FeedbackForm';
import type { PublicConfig } from '../../src/client/types';

function cfgWith(question: { id: string; type: 'text'; label: string; placeholder?: string }): PublicConfig {
  return {
    event_name: 'Test',
    event_slug: 'test',
    event_date: null,
    event_venue: null,
    allowed_email_domain: 'school.edu.ph',
    quests: [],
    feedback_keystone: { enabled: true, questions: [question] },
    terms: { quest: '', survey: '' },
    total_tasks: 0,
  } as unknown as PublicConfig;
}

describe('FeedbackForm placeholder', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(cfg: PublicConfig) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<FeedbackForm cfg={cfg} sessionId="sid" onSubmitted={() => undefined} />));
  }

  it('uses the configured placeholder', () => {
    render(cfgWith({ id: 'q1', type: 'text', label: 'Any suggestions?', placeholder: 'Say hi' }));
    expect((container.querySelector('textarea') as HTMLTextAreaElement).placeholder).toBe('Say hi');
  });

  it('defaults the placeholder to "Enter your answer"', () => {
    render(cfgWith({ id: 'q1', type: 'text', label: 'Any suggestions?' }));
    expect((container.querySelector('textarea') as HTMLTextAreaElement).placeholder).toBe('Enter your answer');
  });

  it('paginates sections and validates each page before advancing', () => {
    const cfg = {
      event_name: 'Test',
      event_slug: 'test',
      event_date: null,
      event_venue: null,
      allowed_email_domain: 'school.edu.ph',
      quests: [],
      feedback_keystone: {
        enabled: true,
        sections: [
          {
            id: 's1',
            title: 'Event',
            description: 'About the event itself',
            questions: [{ id: 'q1', type: 'rating_1_4', label: 'Rate it' }],
          },
          { id: 's2', title: 'Food', questions: [{ id: 'q2', type: 'text', label: 'Favorite snack?' }] },
        ],
        questions: [
          { id: 'q1', type: 'rating_1_4', label: 'Rate it' },
          { id: 'q2', type: 'text', label: 'Favorite snack?' },
        ],
      },
      terms: { quest: '', survey: '' },
      total_tasks: 0,
    } as unknown as PublicConfig;
    render(cfg);

    const next = () =>
      [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Next')) as HTMLButtonElement;

    // First page: only section 1 is visible.
    expect(container.textContent).toContain('Event');
    expect(container.textContent).toContain('About the event itself');
    expect(container.textContent).not.toContain('Food');
    expect(container.querySelectorAll('textarea')).toHaveLength(0);

    // Required questions block navigation.
    act(() => next().click());
    expect(container.textContent).toContain('Event');
    expect(container.textContent).toContain('Please answer every question on this page.');

    // Answer, then advance to section 2.
    act(() => {
      (container.querySelector('button[aria-label="Absolutely Yes"]') as HTMLButtonElement).click();
    });
    act(() => next().click());
    expect(container.textContent).toContain('Food');
    expect(container.textContent).not.toContain('About the event itself');
    expect(container.querySelectorAll('textarea')).toHaveLength(1);
  });
});
