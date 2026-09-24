import type { APIRoute } from 'astro';
import { getEventConfig } from '../../../lib/config/loadEventConfig';
import { getPrisma } from '../../../lib/db/client';
import { apiError, json, num } from '../../../lib/api/http';
import type { FeedbackQuestion } from '../../../lib/config/schema';

/** One aggregated question in the results payload. */
interface QuestionResult {
  id: string;
  type: FeedbackQuestion['type'];
  label: string;
  /** Rating/boolean answer counts, keyed by answer. */
  tally: Record<string, number>;
  /** Mean rating for `rating_1_4` (null when unanswered). */
  average: number | null;
  /** Free-text answers, newest first. */
  text: string[];
}

/**
 * Escape a value for a CSV cell (RFC 4180). Also neutralizes spreadsheet
 * formula injection: a leading `= + - @`, tab or CR is prefixed with a single
 * quote so Excel/Sheets treat attacker-supplied free text as literal.
 */
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/marshal/feedback — read-side of the keystone survey (§3.5).
 *
 * Marshal-guarded by the global middleware. Returns every response for the
 * event aggregated per question, or the raw response table as CSV when
 * `?format=csv` is set (browser download).
 */
export const GET: APIRoute = async ({ locals, url }) => {
  if (locals.isMarshal !== true) {
    return apiError('MARSHAL_UNAUTHENTICATED', 'Marshal session missing or expired', 401);
  }

  const cfg = getEventConfig();
  const prisma = await getPrisma();
  const rows = await prisma.feedbackResponse.findMany({
    where: { eventSlug: cfg.event_slug },
    orderBy: { submittedAt: 'desc' },
  });

  const responses = rows.map((row) => {
    let answers: Record<string, string | number | boolean> = {};
    try {
      answers = JSON.parse(row.answersJson) as Record<string, string | number | boolean>;
    } catch {
      // A malformed blob shouldn't take the whole results view down.
    }
    return { sessionId: row.sessionId, submittedAt: num(row.submittedAt) ?? 0, answers };
  });

  const questions = cfg.feedback_keystone.questions;

  if (url.searchParams.get('format') === 'csv') {
    // Prefix columns with their section title (when titled) for readability.
    const headers = cfg.feedback_keystone.sections.flatMap((s) =>
      s.questions.map((q) => (s.title ? `${s.title} — ${q.label}` : q.label)),
    );
    const lines = [['session_id', 'submitted_at', ...headers].map(csvCell).join(',')];
    for (const r of responses) {
      lines.push(
        [r.sessionId, new Date(r.submittedAt).toISOString(), ...questions.map((q) => r.answers[q.id] ?? '')]
          .map(csvCell)
          .join(','),
      );
    }
    // Leading BOM so Excel reads the UTF-8 text answers correctly.
    return new Response(`\uFEFF${lines.join('\r\n')}\r\n`, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${cfg.event_slug}-survey.csv"`,
      },
    });
  }

  const aggregate = (q: FeedbackQuestion): QuestionResult => {
    const tally: Record<string, number> = {};
    const text: string[] = [];
    let sum = 0;
    let rated = 0;
    for (const r of responses) {
      const value = r.answers[q.id];
      if (value === undefined || value === null || value === '') continue;
      if (q.type === 'rating_1_4') {
        const v = Number(value);
        if (!Number.isFinite(v)) continue;
        tally[String(v)] = (tally[String(v)] ?? 0) + 1;
        sum += v;
        rated += 1;
      } else if (q.type === 'boolean') {
        const key = value === true || value === 'true' ? 'Yes' : 'No';
        tally[key] = (tally[key] ?? 0) + 1;
      } else {
        const s = String(value).trim();
        if (s) text.push(s);
      }
    }
    return { id: q.id, type: q.type, label: q.label, tally, average: rated > 0 ? sum / rated : null, text };
  };

  const sections = cfg.feedback_keystone.sections.map((s) => ({
    id: s.id,
    title: s.title ?? null,
    description: s.description ?? null,
    questions: s.questions.map(aggregate),
  }));

  // `questions` is kept flat for API consumers that predate sections.
  return json({ total: responses.length, sections, questions: questions.map(aggregate) });
};
