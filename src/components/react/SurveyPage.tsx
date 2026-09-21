import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';
import type { ProgressResponse, PublicConfig } from '../../client/types';
import { ensureSessionId } from '../../client/session';
import { getJson } from '../../client/http';
import FeedbackForm from './FeedbackForm';

type Phase = 'loading' | 'ready' | 'submitted' | 'disabled' | 'incomplete' | 'error';

/**
 * Standalone survey form (`/survey`).
 *
 * The same `FeedbackForm` + `POST /api/feedback` as the attendee modal, but at a
 * shareable URL — so the event can offer the survey as either a modal (auto-pops
 * once quests are done on `/`) or a standalone page. Server state is
 * authoritative: this page re-checks the session, config and progress before
 * rendering the form.
 */
export default function SurveyPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sid = await ensureSessionId();
        if (!alive) return;
        setSessionId(sid);

        const configRes = await getJson<PublicConfig>('/api/config');
        if (!alive) return;
        if (configRes.status !== 200) {
          setPhase('error');
          return;
        }
        setCfg(configRes.body);
        if (!configRes.body.feedback_keystone.enabled) {
          setPhase('disabled');
          return;
        }

        const progressRes = await getJson<ProgressResponse>(`/api/progress/${sid}`);
        if (!alive) return;
        if (progressRes.status !== 200) {
          setPhase('error');
          return;
        }
        const p = progressRes.body;
        if (p.feedback_done) setPhase('submitted');
        else if (p.completed_prompt_ids.length < configRes.body.quests.length) setPhase('incomplete');
        else setPhase('ready');
      } catch {
        if (alive) setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="relative z-10 flex flex-1 flex-col gap-4 px-4 pt-8 pb-12">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-brand-ink">{cfg?.event_name ?? 'Survey'}</h1>
        <p className="text-sm text-brand-muted">Tell us how it went</p>
      </header>

      {phase === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-12 text-brand-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      )}

      {phase === 'ready' && cfg && sessionId && (
        <FeedbackForm cfg={cfg} sessionId={sessionId} onSubmitted={() => setPhase('submitted')} />
      )}

      {phase === 'submitted' && (
        <StatusCard
          icon={<CheckCircle2 className="h-8 w-8 text-brand-accent" />}
          title="Thanks — you're all set!"
          body="Your answers have been recorded."
        />
      )}

      {phase === 'incomplete' && (
        <StatusCard
          icon={<ClipboardList className="h-8 w-8 text-brand-track" />}
          title="Finish your quests first"
          body="Complete every photo quest, then come back to fill this in."
          cta={{ href: '/', label: 'Back to quests' }}
        />
      )}

      {phase === 'disabled' && (
        <StatusCard
          icon={<ClipboardList className="h-8 w-8 text-brand-track" />}
          title="Survey unavailable"
          body="The survey isn't enabled for this event."
          cta={{ href: '/', label: 'Back to quests' }}
        />
      )}

      {phase === 'error' && (
        <StatusCard
          icon={<ClipboardList className="h-8 w-8 text-brand-orange" />}
          title="Couldn't load the survey"
          body="Please refresh the page to try again."
          cta={{ href: '/', label: 'Back to quests' }}
        />
      )}
    </main>
  );
}

function StatusCard({
  icon,
  title,
  body,
  cta,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-track bg-brand-white p-8 text-center shadow-sm">
      {icon}
      <h2 className="text-base font-semibold text-brand-ink">{title}</h2>
      <p className="text-sm text-brand-muted">{body}</p>
      {cta && (
        <a
          href={cta.href}
          className="mt-1 rounded-full bg-brand-deep px-4 py-2.5 text-sm font-semibold text-brand-white transition hover:bg-brand-deep/90"
        >
          {cta.label}
        </a>
      )}
    </div>
  );
}
