import { useEffect, useState } from 'react';
import { BadgeCheck, Loader2, Ticket } from 'lucide-react';
import QRCode from 'qrcode';
import type { ClaimResponse, PublicConfig, ProgressResponse } from '../../client/types';
import { postJson } from '../../client/http';
import { canShowClaimModal } from '../../client/claimGate';
import FeedbackForm from './FeedbackForm';

interface Props {
  cfg: PublicConfig;
  progress: ProgressResponse;
  sessionId: string;
  localPending: number;
  onRefresh: () => void;
}

export default function ClaimFlow({ cfg, progress, sessionId, localPending, onRefresh }: Props) {
  const allQuestsDone = progress.completed_prompt_ids.length === cfg.quests.length;
  const showFeedback = cfg.feedback_keystone.enabled && allQuestsDone && !progress.feedback_done;
  const claimReady = canShowClaimModal({ pendingCount: localPending, serverCompleted: progress.completed, serverTotal: progress.total });
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
      {showFeedback && <FeedbackForm cfg={cfg} sessionId={sessionId} onSubmitted={onRefresh} />}

      {claim ? (
        <ClaimPass claim={claim} domain={cfg.allowed_email_domain} />
      ) : alreadyMinted ? (
        <MintedSummary progress={progress} />
      ) : (
        <button
          type="button"
          disabled={!claimReady}
          onClick={() => setOpen(true)}
          className={
            claimReady
              ? 'flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-amber-300'
              : 'flex items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-500'
          }
        >
          {!claimReady && localPending > 0 ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Syncing {localPending} photo{localPending === 1 ? '' : 's'}…
            </>
          ) : !progress.chest_unlocked ? (
            <>
              <Ticket className="h-4 w-4" /> Complete all tasks to claim your pass
            </>
          ) : (
            <>
              <Ticket className="h-4 w-4" /> Claim your pass
            </>
          )}
        </button>
      )}

      {open && !claim && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
          <div className="flex w-full max-w-md flex-col gap-4 rounded-t-2xl border border-zinc-800 bg-zinc-950 p-6 sm:rounded-2xl">
            <h2 className="text-lg font-semibold">Claim your swag pass</h2>
            <p className="text-sm text-zinc-400">
              Use your school email ending in <span className="text-zinc-200">@{cfg.allowed_email_domain}</span>. You'll show the
              marshal at the exit table to collect your loot.
            </p>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-zinc-300">School email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`you@${cfg.allowed_email_domain}`}
                autoFocus
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
              />
            </label>
            {error && <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                className="flex-1 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !email.includes('@')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-amber-300 disabled:opacity-60"
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
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-500/30 bg-zinc-900/80 p-6">
      <h2 className="text-base font-semibold">{headline}</h2>
      <p className="text-center text-xs text-zinc-400">{hint}</p>
      {qr ? (
        <img src={qr} alt="Claim pass QR code" className="h-52 w-52 rounded-lg bg-white p-2" />
      ) : (
        <div className="flex h-52 w-52 items-center justify-center rounded-lg bg-zinc-800 text-zinc-500">QR</div>
      )}
      <p className="text-3xl font-bold tracking-[0.4em] text-zinc-100" aria-label={`Fallback code ${shortCode}`}>
        {shortCode}
      </p>
      {footer && <p className="text-sm text-zinc-400">{footer}</p>}
      {note && <p className="text-center text-xs text-zinc-500">{note}</p>}
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
