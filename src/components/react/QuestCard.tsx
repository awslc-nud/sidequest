import { AlertTriangle, Camera, Check, Loader2, Lock, RotateCcw } from 'lucide-react';
import type { QuestStatus } from '../../client/types';
import { DEFAULT_MAX_ATTEMPTS } from '../../client/uploadQueue';

interface Quest {
  id: string;
  title: string;
  description: string;
}

export interface QuestFailure {
  attempts: number;
  terminal: boolean;
  message: string;
}

interface Props {
  quest: Quest;
  index: number;
  status: QuestStatus;
  chestUnlocked: boolean;
  failure?: QuestFailure;
  onStart: () => void;
  onRetry: () => void;
}

export default function QuestCard({ quest, index, status, chestUnlocked, failure, onStart, onRetry }: Props) {
  const disabled = chestUnlocked || (status !== 'todo' && status !== 'failed');
  const failed = status === 'failed';

  return (
    <li
      className={
        failed
          ? 'flex items-center gap-3 rounded-xl border border-red-900/60 bg-red-950/20 p-4'
          : 'flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4'
      }
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-400">
        {status === 'done' ? (
          <Check className="h-5 w-5 text-emerald-400" />
        ) : failed ? (
          <AlertTriangle className="h-5 w-5 text-red-400" />
        ) : (
          <Camera className="h-5 w-5" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className="truncate text-base font-medium">{quest.title}</h3>
        <p className="truncate text-sm text-zinc-400">{quest.description}</p>
        {failed && (
          <p className="text-xs text-red-300" role="alert">
            {failure?.message ?? 'Upload failed.'}
            {failure && !failure.terminal && failure.attempts > 0 && (
              <span className="text-red-400/70"> (attempt {failure.attempts}/{DEFAULT_MAX_ATTEMPTS})</span>
            )}
          </p>
        )}
      </div>
      {failed ? (
        <button
          type="button"
          onClick={onRetry}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Retry
        </button>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={disabled}
          className={
            disabled
              ? 'flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500'
              : 'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400'
          }
          title={`Quest #${index + 1}`}
        >
          {status === 'pending_sync' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing…
            </>
          ) : status === 'done' ? (
            <>Done</>
          ) : chestUnlocked ? (
            <>
              <Lock className="h-3.5 w-3.5" /> Locked
            </>
          ) : (
            'Capture'
          )}
        </button>
      )}
    </li>
  );
}
