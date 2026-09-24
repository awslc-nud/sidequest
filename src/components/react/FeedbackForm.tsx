import { useState } from 'react';
import { ChevronRight, Loader2, Send } from 'lucide-react';
import type { PublicConfig, PublicFeedbackSection } from '../../client/types';
import type { TermsKind } from '../../client/terms';
import { postJson } from '../../client/http';
import { RATING_FACES } from '../../client/feedback';
import TermsGate from './TermsGate';

interface Props {
  cfg: PublicConfig;
  sessionId: string;
  onSubmitted: () => void;
  /** Acceptance scope — the standalone page and the reward modal agree separately. */
  termsKind?: TermsKind;
}

export default function FeedbackForm({ cfg, sessionId, onSubmitted, termsKind = 'survey' }: Props) {
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const questions = cfg.feedback_keystone.questions;
  // Fall back to the flat list (older/stale config response) as one untitled section.
  const sections: PublicFeedbackSection[] = cfg.feedback_keystone.sections?.length
    ? cfg.feedback_keystone.sections
    : [{ id: 'all', questions }];
  // One logical page per section — each step is validated before moving on.
  const total = sections.length;
  const current = sections[Math.min(step, total - 1)];
  const currentAnswered = current.questions.every((q) => answers[q.id] !== undefined);
  const set = (id: string, value: string | number | boolean) => setAnswers((a) => ({ ...a, [id]: value }));

  const goNext = () => {
    if (!currentAnswered) {
      setError('Please answer every question on this page.');
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, total - 1));
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const missing = questions.some((q) => answers[q.id] === undefined);
    if (missing) {
      setError('Please answer every question before submitting.');
      setBusy(false);
      return;
    }
    const { status, body } = await postJson<any>('/api/feedback', { session_id: sessionId, answers });
    if (status === 200) {
      onSubmitted();
    } else {
      setError(body?.error?.message ?? 'Could not submit feedback. Please try again.');
    }
    setBusy(false);
  };

  const hasHeading = Boolean(current.title || current.description);

  return (
    <TermsGate kind={termsKind} title="Survey Terms & Conditions" content={cfg.terms?.survey ?? ''}>
      <div className="flex w-full flex-col gap-5 rounded-2xl border border-brand-track bg-brand-white p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-medium uppercase tracking-widest text-brand-muted">
              One last thing…
            </h2>
            {total > 1 && (
              <span className="text-xs tabular-nums text-brand-muted">
                {step + 1} / {total}
              </span>
            )}
          </div>
          {total > 1 && (
            <div className="flex gap-1.5" aria-hidden="true">
              {sections.map((s, i) => (
                <span
                  key={s.id}
                  className={
                    'h-1 flex-1 rounded-full transition-colors ' +
                    (i <= step ? 'bg-brand-accent' : 'bg-brand-track/60')
                  }
                />
              ))}
            </div>
          )}
        </div>

        <section className="flex flex-col gap-4">
                {hasHeading && (
                  <header className="flex flex-col gap-0.5 border-b border-brand-track/60 pb-2">
                    {current.title && (
                      <h3 className="text-base font-semibold leading-snug text-brand-ink">
                        {current.title}
                      </h3>
                    )}
                    {current.description && (
                      <p className="text-xs leading-relaxed text-brand-muted">
                        {current.description}
                      </p>
                    )}
                  </header>
                )}

                <div className="flex flex-col gap-5">
                  {current.questions.map((q) => (
                    <div key={q.id} className="flex flex-col gap-2">
                      <p className="text-sm leading-snug text-brand-ink">{q.label}</p>

                      {q.type === 'rating_1_4' && (
                        <div role="group" aria-label={q.label} className="flex gap-2">
                          {RATING_FACES.map(({ value, emoji, label }) => {
                            const selected = answers[q.id] === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => set(q.id, value)}
                                aria-pressed={selected}
                                aria-label={label}
                                title={label}
                                className={
                                  'flex h-12 flex-1 items-center justify-center text-2xl leading-none transition duration-150 ' +
                                  (selected
                                    ? 'scale-110 grayscale-0'
                                    : 'opacity-60 grayscale hover:scale-105 hover:opacity-100 hover:grayscale-0')
                                }
                              >
                                {emoji}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'boolean' && (
                        <div role="group" aria-label={q.label} className="flex gap-2">
                          {(['Yes', 'No'] as const).map((b) => {
                            const selected = answers[q.id] === (b === 'Yes');
                            return (
                              <button
                                key={b}
                                type="button"
                                onClick={() => set(q.id, b === 'Yes')}
                                aria-pressed={selected}
                                className={
                                  'h-11 flex-1 rounded-xl text-sm font-medium transition ' +
                                  (selected
                                    ? 'bg-brand-deep text-brand-white'
                                    : 'bg-brand-bg text-brand-ink hover:bg-brand-track/40')
                                }
                              >
                                {b}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'text' && (
                        <textarea
                          value={(answers[q.id] as string) ?? ''}
                          onChange={(e) => set(q.id, e.target.value)}
                          placeholder={q.placeholder?.trim() || 'Enter your answer'}
                          aria-label={q.label}
                          rows={3}
                          className="w-full resize-y rounded-xl border border-brand-track bg-brand-bg/40 px-3 py-2 text-sm text-brand-ink placeholder:text-brand-muted focus:border-brand-accent focus:bg-brand-white focus:outline-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
        </section>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-brand-orange/50 bg-brand-orange-soft px-3 py-2 text-sm text-brand-ink"
          >
            {error}
          </p>
        )}

        <div className="sticky bottom-0 -mx-5 -mb-5 mt-1 rounded-b-2xl border-t border-brand-track/60 bg-brand-white/95 px-5 pb-5 pt-3 backdrop-blur">
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                disabled={busy}
                className="h-11 rounded-full border border-brand-track px-4 text-sm font-semibold text-brand-deep transition hover:bg-brand-track/40 disabled:opacity-60"
              >
                Back
              </button>
            )}
            {step < total - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={busy}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-deep px-4 text-sm font-semibold text-brand-white transition hover:bg-brand-ink disabled:opacity-60"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-deep px-4 text-sm font-semibold text-brand-white transition hover:bg-brand-ink disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit
                feedback
              </button>
            )}
          </div>
        </div>
      </div>
    </TermsGate>
  );
}
