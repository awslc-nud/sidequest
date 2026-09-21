import { useEffect, useState } from 'react';
import { Gift, Loader2, PartyPopper } from 'lucide-react';
import type { ProgressResponse, PublicConfig } from '../../client/types';
import type { LootItem } from '../../lib/config/schema';
import { ensureSessionId } from '../../client/session';
import { getJson } from '../../client/http';
import ClaimFlow from './ClaimFlow';
import FeedbackModal from './FeedbackModal';

type Phase = 'loading' | 'ready' | 'incomplete' | 'error';

interface Props {
  /** Loot from the event config, injected server-side by `/reward`. */
  loot: LootItem[];
}

/**
 * Reward reveal (`/reward`), reached when the final quest's chest pops open on
 * the tracker and the screen flash-navigates here.
 *
 * Shows what the attendee earned and hosts the shared claim + survey actions
 * (`ClaimFlow` / `FeedbackModal`). Re-checks session/config/progress so a direct
 * visit before finishing (or after claiming) renders the right state.
 */
export default function RewardPage({ loot }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [surveyOpen, setSurveyOpen] = useState(false);

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

        const progressRes = await getJson<ProgressResponse>(`/api/progress/${sid}`);
        if (!alive) return;
        if (progressRes.status !== 200) {
          setPhase('error');
          return;
        }
        setProgress(progressRes.body);
        const done = progressRes.body.completed_prompt_ids.length >= configRes.body.quests.length;
        setPhase(done ? 'ready' : 'incomplete');
      } catch {
        if (alive) setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refresh = async () => {
    if (!sessionId) return;
    const res = await getJson<ProgressResponse>(`/api/progress/${sessionId}`);
    if (res.status === 200) setProgress(res.body);
  };

  return (
    <main className="relative z-10 flex flex-1 flex-col gap-4 px-4 pt-8 pb-12">
      {phase === 'loading' && (
        <div className="flex flex-1 items-center justify-center gap-2 text-brand-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      )}

      {phase === 'incomplete' && (
        <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-brand-track bg-brand-white p-8 text-center shadow-sm">
          <PartyPopper className="h-8 w-8 text-brand-track" />
          <h1 className="text-base font-semibold text-brand-ink">Your reward isn't ready yet</h1>
          <p className="text-sm text-brand-muted">Finish every quest to unlock the chest.</p>
          <a
            href="/"
            className="mt-1 rounded-full bg-brand-deep px-4 py-2.5 text-sm font-semibold text-brand-white transition hover:bg-brand-ink"
          >
            Back to quests
          </a>
        </div>
      )}

      {phase === 'error' && (
        <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-brand-orange/50 bg-brand-orange-soft p-8 text-center">
          <PartyPopper className="h-8 w-8 text-brand-orange" />
          <h1 className="text-base font-semibold text-brand-ink">Couldn't load your reward</h1>
          <p className="text-sm text-brand-ink">Please refresh the page to try again.</p>
        </div>
      )}

      {phase === 'ready' && (
        <>
          <header className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold text-brand-ink">Chest unlocked!</h1>
            <p className="text-sm text-brand-muted">Here's your prize</p>
          </header>

          {loot[0] && <PrizeArt item={loot[0]} />}

          {cfg && progress && (
            <ClaimFlow
              cfg={cfg}
              progress={progress}
              sessionId={progress.session_id}
              localPending={0}
              surveyPending={
                cfg.feedback_keystone.enabled &&
                !progress.feedback_done &&
                progress.completed_prompt_ids.length >= cfg.quests.length
              }
              onOpenSurvey={() => setSurveyOpen(true)}
              onRefresh={() => void refresh()}
            />
          )}
        </>
      )}

      {surveyOpen && cfg && progress && (
        <FeedbackModal
          cfg={cfg}
          sessionId={progress.session_id}
          onSubmitted={() => {
            setSurveyOpen(false);
            void refresh();
          }}
          onClose={() => setSurveyOpen(false)}
        />
      )}
    </main>
  );
}

/** The single prize: its artwork from config, with a graceful icon fallback. */
function PrizeArt({ item }: { item: LootItem }) {
  const [broken, setBroken] = useState(false);

  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl bg-brand-white p-6 text-center shadow-sm ring-1 ring-brand-track/50">
      <div className="relative flex h-48 w-full max-w-xs items-center justify-center">
        {/* Soft halo so the prize reads as glowing rather than pasted on. */}
        <span aria-hidden="true" className="absolute h-40 w-40 rounded-full bg-brand-accent/25 blur-2xl" />
        {item.image && !broken ? (
          <img
            src={item.image}
            alt={item.label}
            onError={() => setBroken(true)}
            className="relative h-48 w-full object-contain"
          />
        ) : (
          <span className="relative flex h-32 w-32 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-deep to-brand-deep/85 text-brand-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
            <Gift className="h-12 w-12" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="text-lg font-bold text-brand-ink">{item.label}</p>
      {item.qty > 1 && <p className="text-sm text-brand-muted">Quantity: {item.qty}</p>}
    </div>
  );
}
