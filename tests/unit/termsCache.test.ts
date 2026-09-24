import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getTerms, resetTermsCache } from '../../src/lib/config/loadTerms';

describe('getTerms memoization', () => {
  let dir: string;
  const prevDir = process.env.TERMS_DIR;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'terms-'));
    process.env.TERMS_DIR = dir;
    resetTermsCache();
  });

  afterEach(() => {
    resetTermsCache();
    if (prevDir === undefined) delete process.env.TERMS_DIR;
    else process.env.TERMS_DIR = prevDir;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads terms and picks up live edits without a restart', () => {
    fs.writeFileSync(path.join(dir, 'quest.md'), 'quest v1');
    expect(getTerms().quest).toBe('quest v1');

    // Served from the memoized copy.
    expect(getTerms().quest).toBe('quest v1');

    // An edit changes the file signature and is picked up.
    fs.writeFileSync(path.join(dir, 'quest.md'), 'quest v2 (edited)');
    expect(getTerms().quest).toBe('quest v2 (edited)');
  });

  it('returns empty strings when no terms files exist', () => {
    expect(getTerms()).toEqual({ quest: '', survey: '' });
  });
});
