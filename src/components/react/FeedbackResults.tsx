import { useEffect, useState } from 'react';
import { ChevronDown, Download, Loader2 } from 'lucide-react';
import { getJson } from '../../client/http';
import { RATING_FACES } from '../../client/feedback';

interface QuestionResult {
  id: string;
  type: 'rating_1_4' | 'text' | 'boolean';
  label: string;
  tally: Record<string, number>;
  average: number | null;
  text: string[];
}

interface SectionResult {
  id: string;
  title: string | null;
  description: string | null;
  questions: QuestionResult[];
}

interface Results {
  total: number;
  sections?: SectionResult[];
  /** Flat fallback for older API responses. */
  questions?: QuestionResult[];
}

const maxCount = (q: QuestionResult) => Math.max(1, ...Object.values(q.tally));

const barsFor = (q: QuestionResult) =>
  q.type === 'rating_1_4'
    ? RATING_FACES.map((f) => ({ key: String(f.value), glyph: f.emoji, title: f.label }))
    : [
        { key: 'Yes', glyph: 'Yes', title: 'Yes' },
        { key: 'No', glyph: 'No', title: 'No' },
      ];

function QuestionCard({ q }: { q: QuestionResult }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-zinc-200">{q.label}</h3>
        {q.type === 'rating_1_4' && q.average !== null && (
          <span className="shrink-0 text-xs text-zinc-400">{q.average.toFixed(1)} avg</span>
        )}
      </div>

      {(q.type === 'rating_1_4' || q.type === 'boolean') && (
        <div className="flex flex-col gap-2">
          {barsFor(q).map((row) => {
            const count = q.tally[row.key] ?? 0;
            return (
              <div key={row.key} className="flex items-center gap-3 text-sm">
                <span className="w-9 shrink-0 text-center text-lg" title={row.title}>
                  {row.glyph}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-brand-accent/70"
                    style={{ width: `${(count / maxCount(q)) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right tabular-nums text-zinc-400">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {q.type === 'text' &&
        (q.text.length === 0 ? (
          <p className="text-sm text-zinc-500">No responses.</p>
        ) : (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100">
              <span>
                {q.text.length} {q.text.length === 1 ? 'response' : 'responses'}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
              {q.text.map((answer, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300"
                >
                  {answer}
                </li>
              ))}
            </ul>
          </details>
        ))}
    </section>
  );
}

/**
 * Marshal-facing survey results (`/marshal/results`): per-section groups of
 * questions, with tallies for emoji/yes-no questions, free-text answer lists,
 * and a CSV export of the raw responses.
 */
export default function FeedbackResults() {
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await getJson<Results>('/api/marshal/feedback');
      if (!alive) return;
      if (res.status === 200 && res.body) setData(res.body);
      else setError('Could not load survey results.');
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
        {error}
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const sections: SectionResult[] =
    data.sections ?? [{ id: 'all', title: null, description: null, questions: data.questions ?? [] }];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div>
          <p className="text-2xl font-semibold text-zinc-100">{data.total}</p>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Responses</p>
        </div>
        {data.total > 0 && (
          <a
            href="/api/marshal/feedback?format=csv"
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
        )}
      </div>

      {data.total === 0 && (
        <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
          No survey responses yet.
        </p>
      )}

      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-4">
          {(section.title || section.description) && (
            <div className="flex flex-col gap-0.5 border-b border-zinc-800 pb-2">
              {section.title && <h2 className="text-base font-semibold text-zinc-100">{section.title}</h2>}
              {section.description && <p className="text-sm text-zinc-400">{section.description}</p>}
            </div>
          )}
          {section.questions.map((q) => (
            <QuestionCard key={q.id} q={q} />
          ))}
        </div>
      ))}
    </div>
  );
}
