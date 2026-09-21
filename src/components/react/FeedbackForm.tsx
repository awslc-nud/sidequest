import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import type { PublicConfig } from '../../client/types';
import { postJson } from '../../client/http';

interface Props {
  cfg: PublicConfig;
  sessionId: string;
  onSubmitted: () => void;
}

export default function FeedbackForm({ cfg, sessionId, onSubmitted }: Props) {
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questions = cfg.feedback_keystone.questions;
  const set = (id: string, value: string | number | boolean) => setAnswers((a) => ({ ...a, [id]: value }));

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

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-track bg-brand-white p-4 shadow-sm">
      <h2 className="text-xs font-medium uppercase tracking-widest text-brand-muted">One last thing…</h2>
      {questions.map((q) => (
        <label key={q.id} className="flex flex-col gap-1.5 text-sm text-brand-ink">
          {q.label}
          {q.type === 'rating_1_5' && (
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set(q.id, n)}
                  aria-pressed={answers[q.id] === n}
                  className={
                    answers[q.id] === n
                      ? 'h-9 w-9 rounded-lg bg-brand-deep font-medium text-brand-white'
                      : 'h-9 w-9 rounded-lg border border-brand-track text-brand-deep transition hover:bg-brand-track/40'
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {q.type === 'boolean' && (
            <div className="flex gap-2">
              {(['Yes', 'No'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => set(q.id, b === 'Yes')}
                  aria-pressed={answers[q.id] === (b === 'Yes')}
                  className={
                    answers[q.id] === (b === 'Yes')
                      ? 'rounded-lg bg-brand-deep px-3 py-1.5 text-sm font-medium text-brand-white'
                      : 'rounded-lg border border-brand-track px-3 py-1.5 text-sm text-brand-deep transition hover:bg-brand-track/40'
                  }
                >
                  {b}
                </button>
              ))}
            </div>
          )}
          {q.type === 'text' && (
            <textarea
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => set(q.id, e.target.value)}
              rows={2}
              className="rounded-lg border border-brand-track bg-brand-white px-3 py-2 text-sm text-brand-ink placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
            />
          )}
        </label>
      ))}
      {error && <p className="rounded-lg border border-brand-orange/50 bg-brand-orange-soft px-3 py-2 text-sm text-brand-ink">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="flex items-center justify-center gap-1.5 rounded-full bg-brand-deep px-4 py-2.5 text-sm font-semibold text-brand-white transition hover:bg-brand-ink disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit feedback
      </button>
    </div>
  );
}
