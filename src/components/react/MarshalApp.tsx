import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { postJson, type ErrorBody } from '../../client/http';
import QrScanner from './QrScanner';

interface Result {
  kind: 'ok' | 'conflict' | 'error';
  headline: string;
  detail?: string;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export default function MarshalApp() {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const showResult = (r: Result) => {
    setResult(r);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setResult(null);
      setValue('');
    }, 3500);
  };

  const redeem = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setBusy(true);
    const isToken = UUID_RE.test(trimmed);
    const payload = isToken ? { claim_token: trimmed.toLowerCase() } : { short_code: trimmed.toUpperCase() };
    const { status, body } = await postJson<any & ErrorBody>('/api/marshal/redeem', payload);
    setBusy(false);

    if (status === 200) {
      showResult({
        kind: 'ok',
        headline: 'Claimed',
        detail: `${body.student_email} — ${Array.isArray(body.loot) ? body.loot.map((l: { label: string }) => l.label).join(' · ') : ''}`,
      });
    } else if (status === 409) {
      const claimedAt = body?.error?.claimed_at ? new Date(Number(body.error.claimed_at)).toLocaleString() : '';
      showResult({
        kind: 'conflict',
        headline: 'Already claimed',
        detail: `This pass was collected${claimedAt ? ` at ${claimedAt}` : ''}.`,
      });
    } else {
      showResult({ kind: 'error', headline: body?.error?.message ?? 'Could not redeem this pass' });
    }
  };

  const submit = () => {
    if (!busy && value.trim()) void redeem(value);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Live camera viewfinder — scanning is paused while a redeem is in flight */}
      <QrScanner paused={busy} onScan={(data) => void redeem(data)} />

      {/* Manual fallback entry */}
      <section aria-label="Manual entry" className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-300">Code or token</span>
          <span className="text-xs text-zinc-500">
            Type the 4-character code (e.g. K4T9) shown on the attendee's pass, or paste the full token.
          </span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 40))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder="K4T9"
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-center text-xl font-semibold tracking-widest text-zinc-100 placeholder:text-zinc-700 focus:border-zinc-500 focus:outline-none"
            aria-label="Claim code or token"
          />
        </label>
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={submit}
          className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          Redeem
        </button>
      </section>

      {/* Result screen */}
      {result && (
        <div
          role="status"
          className={
            result.kind === 'ok'
              ? 'flex items-center gap-3 rounded-xl border border-emerald-700/50 bg-emerald-950/40 p-4 text-emerald-200'
              : result.kind === 'conflict'
                ? 'flex items-center gap-3 rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-red-200'
                : 'flex items-center gap-3 rounded-xl border border-amber-800/60 bg-amber-950/30 p-4 text-amber-200'
          }
        >
          {result.kind === 'ok' ? <CheckCircle2 className="h-6 w-6 shrink-0" /> : <XCircle className="h-6 w-6 shrink-0" />}
          <div className="min-w-0">
            <p className="font-medium">{result.headline}</p>
            {result.detail && <p className="truncate text-sm opacity-90">{result.detail}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
