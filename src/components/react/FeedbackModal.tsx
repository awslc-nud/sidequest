import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { PublicConfig } from '../../client/types';
import FeedbackForm from './FeedbackForm';

interface Props {
  cfg: PublicConfig;
  sessionId: string;
  /** Called after a successful submission (close + refresh). */
  onSubmitted: () => void;
  /** Dismiss without submitting; the attendee can reopen from the claim area. */
  onClose: () => void;
}

/**
 * Modal wrapper around the shared `FeedbackForm`.
 *
 * Pops automatically once every quest is complete (§ product decision — see
 * `docs/ui-build.md` #29). Dismissible so the attendee can claim later; the
 * standalone `/survey` page renders the same form outside the modal.
 */
export default function FeedbackModal({ cfg, sessionId, onSubmitted, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post-event survey"
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand-ink/40 p-3 sm:items-center sm:p-4"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close survey"
          className="absolute right-3 top-3 z-20 rounded-full border border-brand-track bg-brand-white/90 p-1.5 text-brand-muted shadow-sm backdrop-blur transition hover:bg-brand-bg hover:text-brand-ink"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <FeedbackForm cfg={cfg} sessionId={sessionId} onSubmitted={onSubmitted} termsKind="survey-modal" />
        </div>
      </div>
    </div>
  );
}
