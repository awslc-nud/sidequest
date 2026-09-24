// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactNode } from 'react';
import TermsGate from '../../src/components/react/TermsGate';

describe('TermsGate', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    localStorage.clear();
  });

  function mount(ui: ReactNode) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(ui));
  }

  function agree() {
    act(() => (container.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    act(() => (container.querySelector('button') as HTMLButtonElement).click());
  }

  it('renders children untouched when no terms are configured', () => {
    mount(
      <TermsGate kind="quest" title="Quest Terms" content="">
        <p>App</p>
      </TermsGate>,
    );
    expect(container.textContent).toContain('App');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('blocks children until agreed, then remembers acceptance', () => {
    mount(
      <TermsGate kind="quest" title="Quest Terms" content="Be nice.">
        <p>App</p>
      </TermsGate>,
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).not.toContain('App');
    expect((container.querySelector('button') as HTMLButtonElement).disabled).toBe(true);

    agree();
    expect(container.textContent).toContain('App');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('re-prompts when the terms text changes', () => {
    mount(
      <TermsGate kind="survey" title="Survey Terms" content="v1">
        <p>Form</p>
      </TermsGate>,
    );
    agree();
    expect(container.textContent).toContain('Form');

    act(() =>
      root.render(
        <TermsGate kind="survey" title="Survey Terms" content="v2">
          <p>Form</p>
        </TermsGate>,
      ),
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('renders markdown and externalizes links', () => {
    mount(
      <TermsGate kind="quest" title="Quest Terms" content={'## Rules\n\n**bold** and [site](https://example.com)'}>
        <p>App</p>
      </TermsGate>,
    );
    const body = container.querySelector('.terms-markdown')!;
    expect(body.querySelector('h2')?.textContent).toContain('Rules');
    expect(body.querySelector('strong')?.textContent).toBe('bold');
    const link = body.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('ignores raw HTML in the terms', () => {
    mount(
      <TermsGate kind="quest" title="Quest Terms" content={'<img src=x onerror="alert(1)">'} >
        <p>App</p>
      </TermsGate>,
    );
    expect(container.querySelector('img')).toBeNull();
  });
});
