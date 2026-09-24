import { useEffect, useRef, useState } from 'react';
import { ScrollText } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';

/** Markdown is operator-authored, but force outbound links to open safely. */
const markdownComponents: Components = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

interface Props {
  title: string;
  /** Operator-authored terms as Markdown. */
  content: string;
  onAccept: () => void;
}

/**
 * Blocking terms & conditions modal. There is no dismiss action — the only way
 * past it is the explicit "agree" checkbox + button (the caller decides what to
 * gate). Rendered for both the quest screen and the surveys via `TermsGate`.
 */
export default function TermsModal({ title, content, onAccept }: Props) {
  const [agreed, setAgreed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-ink/50 p-4"
    >
      <div className="flex max-h-[88vh] w-full max-w-md flex-col gap-4 rounded-2xl border border-brand-track bg-brand-white p-5 shadow-xl">
        <header className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-deep text-brand-white">
            <ScrollText className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-bold leading-tight text-brand-ink">{title}</h2>
            <p className="text-xs text-brand-muted">Please read and agree before continuing.</p>
          </div>
        </header>

        <div className="terms-markdown min-h-0 flex-1 overflow-y-auto rounded-lg border border-brand-track bg-brand-bg/60 p-3 text-sm leading-relaxed text-brand-ink">
          <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-brand-ink">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-deep"
          />
          <span>
            I have read and agree to the {title.toLowerCase()}.
          </span>
        </label>

        <button
          ref={buttonRef}
          type="button"
          disabled={!agreed}
          onClick={onAccept}
          className="flex items-center justify-center rounded-full bg-brand-deep px-4 py-2.5 text-sm font-semibold text-brand-white transition hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          Agree &amp; continue
        </button>
      </div>
    </div>
  );
}
