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
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">One last thing…</h2>
      {questions.map((q) => (
        <label key={q.id} className="flex flex-col gap-1.5 text-sm text-zinc-200">
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
                      ? 'h-9 w-9 rounded-lg bg-zinc-100 font-medium text-zinc-900'
                      : 'h-9 w-9 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
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
                      ? 'rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900'
                      : 'rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800'
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
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
          )}
        </label>
      ))}
      {error && <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit feedback
      </button>
    </div>
  );
}
