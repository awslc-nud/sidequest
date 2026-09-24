/**
 * Which terms a gate is showing. Acceptance is tracked per kind so each surface
 * is agreed to on its own — e.g. accepting on the standalone `/survey` page
 * does not skip the terms in the reward-modal survey, and vice-versa.
 */
export type TermsKind = 'quest' | 'survey' | 'survey-modal';

const STORAGE_PREFIX = 'sq-terms-agreed:';

/**
 * Cheap content fingerprint (djb2 + length). Stored alongside acceptance so
 * that editing the terms file re-prompts everyone instead of silently keeping
 * their old agreement.
 */
function fingerprint(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i += 1) hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
  return `${(hash >>> 0).toString(36)}.${content.length.toString(36)}`;
}

/** True when the user already agreed to this exact version of the terms. */
export function hasAcceptedTerms(kind: TermsKind, content: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + kind) === fingerprint(content);
  } catch {
    return false;
  }
}

/** Record agreement to the current version of the terms. */
export function acceptTerms(kind: TermsKind, content: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + kind, fingerprint(content));
  } catch {
    // Private mode / storage disabled — the gate stays up for this session only.
  }
}
