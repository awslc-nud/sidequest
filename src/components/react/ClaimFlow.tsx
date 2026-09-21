import { useEffect, useState } from 'react';
import { BadgeCheck, ClipboardList, Loader2, Ticket } from 'lucide-react';
import QRCode from 'qrcode';
import type { ClaimResponse, PublicConfig, ProgressResponse } from '../../client/types';
import { postJson } from '../../client/http';
import { canShowClaimModal } from '../../client/claimGate';

interface Props {
  cfg: PublicConfig;
  progress: ProgressResponse;
  sessionId: string;
  localPending: number;
  /** True when the survey is enabled, quests are done, and it isn't submitted. */
  surveyPending: boolean;
  /** Open the survey modal (attendee chose "later" earlier, or wants to redo). */
  onOpenSurvey: () => void;
  onRefresh: () => void;
}

export default function ClaimFlow({ cfg, progress, sessionId, localPending, surveyPending, onOpenSurvey, onRefresh }: Props) {
  const claimReady = canShowClaimModal({
    pendingCount: localPending,
    serverCompleted: progress.completed,
    serverTotal: progress.total,
    feedbackRequired: cfg.feedback_keystone.enabled,
    feedbackDone: progress.feedback_done,
  });
  const alreadyMinted = progress.claim !== null;

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claim, setClaim] = useState<ClaimResponse | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { status, body } = await postJson<ClaimResponse & { error?: { message?: string } }>('/api/claim', {
      session_id: sessionId,
      student_email: email,
    });
    if (status === 201 && body.claim_token) {
      setClaim(body);
      onRefresh();
    } else {
      setError(body?.error?.message ?? 'Could not mint your pass. Please try again.');
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {claim ? (
        <ClaimPass claim={claim} domain={cfg.allowed_email_domain} />
      ) : alreadyMinted ? (
        <MintedSummary progress={progress} />
      ) : (
        <>
          {surveyPending && (
            <button
              type="button"
              onClick={onOpenSurvey}
              className="flex items-center justify-center gap-2 rounded-full bg-brand-deep px-4 py-3 text-sm font-semibold text-brand-white transition hover:bg-brand-ink"
            >
              <ClipboardList className="h-4 w-4" /> Take the survey
            </button>
          )}
          <button
            type="button"
            disabled={!claimReady}
            onClick={() => setOpen(true)}
            className={
              claimReady
                ? 'flex items-center justify-center gap-2 rounded-full bg-brand-deep px-4 py-3 text-sm font-semibold text-brand-white transition hover:bg-brand-ink'
                : 'flex items-center justify-center gap-2 rounded-full border border-brand-track bg-brand-track/30 px-4 py-3 text-sm text-brand-muted'
            }
          >
            {!claimReady && localPending > 0 ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Syncing {localPending} photo{localPending === 1 ? '' : 's'}…
              </>
            ) : surveyPending ? (
              <>
                <ClipboardList className="h-4 w-4" /> Finish the survey to claim your pass
              </>
            ) : !progress.chest_unlocked ? (
              <>
                <Ticket className="h-4 w-4" /> Complete all quests to claim your pass
              </>
            ) : (
              <>
                <Ticket className="h-4 w-4" /> Claim your pass
              </>
            )}
          </button>
        </>
      )}

      {open && !claim && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-ink/40 sm:items-center">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl border border-brand-track bg-brand-white p-6 text-brand-ink shadow-xl sm:rounded-3xl">
            <h2 className="text-lg font-semibold">Claim your swag pass</h2>
            <p className="text-sm text-brand-muted">
              Use your school email ending in <span className="text-brand-ink">@{cfg.allowed_email_domain}</span>. You'll show
              the marshal at the exit table to collect your loot.
            </p>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-brand-muted">School email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`you@${cfg.allowed_email_domain}`}
                autoFocus
                className="rounded-lg border border-brand-track bg-brand-white px-3 py-2 text-brand-ink placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
              />
            </label>
            {error && <p className="rounded-lg border border-brand-orange/50 bg-brand-orange-soft px-3 py-2 text-sm text-brand-ink">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                className="flex-1 rounded-full border border-brand-track px-4 py-2.5 text-sm font-medium text-brand-deep transition hover:bg-brand-track/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !email.includes('@')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-deep px-4 py-2.5 text-sm font-semibold text-brand-white transition hover:bg-brand-ink disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Mint pass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PassCard({
  claimToken,
  shortCode,
  headline,
  hint,
  footer,
  note,
}: {
  claimToken: string;
  shortCode: string;
  headline: string;
  hint: string;
  footer?: string;
  note?: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(claimToken, { width: 320, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [claimToken]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-brand-accent/40 bg-brand-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-brand-ink">{headline}</h2>
      <p className="text-center text-xs text-brand-muted">{hint}</p>
      {qr ? (
        <img src={qr} alt="Claim pass QR code" className="h-52 w-52 rounded-xl bg-brand-white p-2" />
      ) : (
        <div className="flex h-52 w-52 items-center justify-center rounded-xl bg-brand-bg text-brand-muted">QR</div>
      )}
      <p className="text-3xl font-bold tracking-[0.4em] text-brand-ink" aria-label={`Fallback code ${shortCode}`}>
        {shortCode}
      </p>
      {footer && <p className="text-sm text-brand-muted">{footer}</p>}
      {note && <p className="text-center text-xs text-brand-muted">{note}</p>}
    </div>
  );
}

function ClaimPass({ claim, domain }: { claim: ClaimResponse; domain: string }) {
  return (
    <PassCard
      claimToken={claim.claim_token}
      shortCode={claim.short_code}
      headline="Your claim pass is ready"
      hint="Show this QR (or the code) to a marshal to collect your loot."
      footer={claim.student_email}
      note={`Loot: ${claim.loot.map((l) => l.label).join(' · ')} · ${domain}`}
    />
  );
}

/** Shown after a reload when a pass was already minted this session. */
function MintedSummary({ progress }: { progress: ProgressResponse }) {
  if (!progress.claim) return null;
  return (
    <PassCard
      claimToken={progress.claim.claim_token}
      shortCode={progress.claim.short_code}
      headline="Pass already minted"
      hint="This pass is linked to your session."
      note={
        progress.claim.is_claimed
          ? `Collected at ${new Date(progress.claim.claimed_at!).toLocaleString()}`
          : 'Not yet collected — show it to a marshal.'
      }
    />
  );
}
