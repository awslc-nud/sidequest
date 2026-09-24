import fs from 'node:fs';
import path from 'node:path';
import { termsDir } from '../env';

/**
 * Editable terms & conditions, one file per surface. Drop your wording into
 * `<TERMS_DIR>/quest.md` and `<TERMS_DIR>/survey.md` (or `.txt`); the files are
 * served to the client verbatim and rendered as **Markdown** in a blocking
 * agreement modal.
 */
export interface TermsConfig {
  /** Shown before the attendee can take photos on the quest screen. */
  quest: string;
  /** Shared by the reward-modal survey and the standalone `/survey` page. */
  survey: string;
}

/** Read one terms file (`.md` preferred, `.txt` fallback); missing = no terms. */
function readTerm(dir: string, name: string): string {
  for (const ext of ['.md', '.txt']) {
    try {
      return fs.readFileSync(path.join(dir, name + ext), 'utf8').trim();
    } catch {
      // try the next extension
    }
  }
  return '';
}

const CANDIDATES: Record<keyof TermsConfig, string[]> = {
  quest: ['quest.md', 'quest.txt'],
  survey: ['survey.md', 'survey.txt'],
};

/**
 * Memoized terms. The text is deliberately unvalidated and may still be edited
 * live, so the cache is keyed by each candidate file's mtime+size: an edit is
 * picked up on the next call, while the common case (no change) does four cheap
 * `stat`s instead of two blocking file reads on every `/api/config` hit.
 */
let cache: { signature: string; terms: TermsConfig } | null = null;

function signatureFor(dir: string): string {
  const parts: string[] = [];
  for (const name of Object.keys(CANDIDATES) as (keyof TermsConfig)[]) {
    for (const file of CANDIDATES[name]) {
      try {
        const s = fs.statSync(path.join(dir, file));
        parts.push(`${file}:${s.mtimeMs}:${s.size}`);
      } catch {
        parts.push(`${file}:missing`);
      }
    }
  }
  return parts.join('|');
}

/** Load the terms text from disk (mtime-memoized so live edits still apply). */
export function getTerms(): TermsConfig {
  const dir = termsDir();
  const signature = `${dir}|${signatureFor(dir)}`;
  if (cache && cache.signature === signature) return cache.terms;
  const terms: TermsConfig = {
    quest: readTerm(dir, 'quest'),
    survey: readTerm(dir, 'survey'),
  };
  cache = { signature, terms };
  return terms;
}

/** Test hook: drop the memoized terms. */
export function resetTermsCache(): void {
  cache = null;
}
