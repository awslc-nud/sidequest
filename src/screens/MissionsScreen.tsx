import { useEffect, useState } from 'react';
import { AlertCircle, WifiOff } from 'lucide-react';
import AppShell from '../components/shell/AppShell';
import UnderwaterBackdrop from '../components/shell/UnderwaterBackdrop';
import EventHeader from '../components/shell/EventHeader';
import MainPanel from '../components/shell/MainPanel';
import MascotChestHero from '../components/hero/MascotChestHero';
import ProgressTracker from '../components/missions/ProgressTracker';
import MissionList from '../components/missions/MissionList';
import CaptureReview from '../components/react/CaptureReview';
import TermsGate from '../components/react/TermsGate';
import { FINALE_SHAKE_DURATION_MS, useQuestTracker } from '../hooks/useQuestTracker';

/** End-of-run sequence once the final quest lands. */
type Finale = 'none' | 'shaking' | 'opening' | 'flash';

/** How long the opened chest is shown while the star blooms inside it. */
const FINALE_OPEN_HOLD_MS = 700;
/** How long the star takes to flood the screen before navigating. */
const FINALE_FLASH_MS = 600;
/** Flags `/reward` to keep the accent cover and suck it into the prize. */
const REWARD_INTRO_KEY = 'sq-reward-intro';

/** Navigate to the reward, signalling the accent hand-off cover. */
function goToReward() {
  try {
    sessionStorage.setItem(REWARD_INTRO_KEY, '1');
  } catch {
    // sessionStorage can throw in private mode — the cover is non-essential.
  }
  window.location.assign('/reward');
}

/**
 * Top-level attendee screen: the polished mission tracker driven by the real
 * config/progress/upload backend.
 *
 * `useQuestTracker` owns the session, config, progress and offline upload queue;
 * this component is purely presentational composition (`ui-spec.md` §2 layout
 * skeleton). Completion hands off entirely to `/reward`: the final quest runs a
 * suspense shake + flash transition, and revisiting an already-complete session
 * redirects there directly.
 */
export default function MissionsScreen() {
  const {
    cfg,
    progress,
    missions,
    isLoading,
    error,
    online,
    failures,
    capturing,
    isShaking,
    shakeIntensity,
    shakeDurationMs,
    startCapture,
    cancelCapture,
    confirmCapture,
    retry,
  } = useQuestTracker();

  // ── End-of-run finale ───────────────────────────────────────────────────
  // When the final quest lands we hold the chest shut for a longer, full-
  // strength shake, then let it pop open, then flash-navigate to /reward.
  const [finale, setFinale] = useState<Finale>('none');
  const [trackedComplete, setTrackedComplete] = useState<boolean | null>(null);
  const [redirect, setRedirect] = useState(false);
  const [flashOrigin, setFlashOrigin] = useState<{ x: number; y: number } | null>(null);
  const serverComplete = progress?.chest_unlocked ?? false;

  // Derive the completion transition during render (not in an effect) so the
  // chest never paints open for a frame before the suspense shake starts. This
  // is React's "adjust state when a prop changes" pattern: the re-render is
  // committed atomically, so effects only ever see the `shaking` phase.
  if (progress && trackedComplete !== serverComplete) {
    const initialRead = trackedComplete === null;
    const transitionedToComplete = trackedComplete === false && serverComplete;
    setTrackedComplete(serverComplete);
    if (transitionedToComplete) setFinale('shaking');
    // Already complete on load (revisit) → nothing left here; go to the reward.
    if (initialRead && serverComplete) setRedirect(true);
  }

  useEffect(() => {
    if (redirect) window.location.replace('/reward');
  }, [redirect]);

  useEffect(() => {
    if (finale !== 'opening') return;
    const chest = document.getElementById('reward-chest');
    if (!chest) return;
    const rect = chest.getBoundingClientRect();
    setFlashOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }, [finale]);

  useEffect(() => {
    if (finale === 'shaking') {
      const t = setTimeout(() => setFinale('opening'), FINALE_SHAKE_DURATION_MS);
      return () => clearTimeout(t);
    }
    if (finale === 'opening') {
      const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        goToReward();
        return;
      }
      const t = setTimeout(() => setFinale('flash'), FINALE_OPEN_HOLD_MS);
      return () => clearTimeout(t);
    }
    if (finale === 'flash') {
      const t = setTimeout(goToReward, FINALE_FLASH_MS);
      return () => clearTimeout(t);
    }
  }, [finale]);

  const finaleShaking = finale === 'shaking';
  const heroAllCompleted = serverComplete && !finaleShaking;
  const heroShaking = finaleShaking || isShaking;
  const heroIntensity = finaleShaking ? 1 : shakeIntensity;

  if (error) {
    return (
      <AppShell>
        <UnderwaterBackdrop />
        <div
          role="alert"
          className="relative z-10 mx-4 mt-10 flex items-center gap-2 rounded-2xl border border-brand-orange/50 bg-brand-orange-soft p-4 text-sm text-brand-ink"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-brand-orange" /> {error}
        </div>
      </AppShell>
    );
  }

  // Already complete on load — don't flash the tracker before the hand-off.
  if (redirect) return null;

  const subtitle = cfg ? [cfg.event_date, cfg.event_venue].filter(Boolean).join(' • ') : '';
  const failureMessages = Object.fromEntries(Object.entries(failures).map(([id, f]) => [id, f.message]));

  return (
    <TermsGate kind="quest" title="Quest Terms & Conditions" content={cfg?.terms?.quest ?? ''}>
    <AppShell>
      <UnderwaterBackdrop />
      <EventHeader title={cfg?.event_name ?? 'Loading…'} subtitle={subtitle || undefined} />
      <MascotChestHero
        isShaking={heroShaking}
        shakeIntensity={heroIntensity}
        shakeDurationMs={finaleShaking ? FINALE_SHAKE_DURATION_MS : shakeDurationMs}
        isAllCompleted={heroAllCompleted}
      />
      <MainPanel>
        {!online && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-xl border border-brand-orange/50 bg-brand-orange-soft p-3 text-sm text-brand-ink"
          >
            <WifiOff className="h-4 w-4 shrink-0 text-brand-orange" /> You're offline. Uploads will resume automatically.
          </div>
        )}

        {isLoading || !progress ? (
          <MissionList missions={[]} onStart={() => undefined} onRetry={() => undefined} isLoading />
        ) : (
          <>
            <ProgressTracker completed={progress.completed} total={progress.total} />
            <MissionList
              missions={missions}
              onStart={(mission) => startCapture({ id: mission.id, title: mission.title })}
              onRetry={retry}
              failures={failureMessages}
            />
          </>
        )}
      </MainPanel>

      {capturing && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-brand-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-md">
            <CaptureReview promptTitle={capturing.title} onCancel={cancelCapture} onConfirm={confirmCapture} />
          </div>
        </div>
      )}

      {flashOrigin && (finale === 'opening' || finale === 'flash') && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-1/2"
          style={{ left: flashOrigin.x, top: flashOrigin.y }}
        >
          <div
            className="h-56 w-56"
            style={{
              clipPath:
                'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
              background: 'radial-gradient(circle, #64CCC3 0 60%, rgba(100,204,195,0) 100%)',
              animation: `reward-flash ${FINALE_OPEN_HOLD_MS + FINALE_FLASH_MS}ms cubic-bezier(0.12, 0.8, 0.2, 1) forwards`,
            }}
          />
        </div>
      )}
    </AppShell>
    </TermsGate>
  );
}
