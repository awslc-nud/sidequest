import { useState, type ReactNode } from 'react';
import { acceptTerms, hasAcceptedTerms, type TermsKind } from '../../client/terms';
import TermsModal from './TermsModal';

interface Props {
  kind: TermsKind;
  title: string;
  /** Terms text from config; an empty string disables the gate. */
  content: string;
  children: ReactNode;
}

/**
 * Blocks its children behind a terms modal until the current version is agreed
 * to (acceptance is remembered per `kind` and re-prompts if the text changes).
 * With no terms configured it renders the children untouched.
 */
export default function TermsGate({ kind, title, content, children }: Props) {
  const [acceptedContent, setAcceptedContent] = useState<string | null>(null);

  if (content.trim().length === 0 || acceptedContent === content || hasAcceptedTerms(kind, content)) {
    return <>{children}</>;
  }

  return (
    <TermsModal
      title={title}
      content={content}
      onAccept={() => {
        acceptTerms(kind, content);
        setAcceptedContent(content);
      }}
    />
  );
}
