import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigError, loadEventConfig, resetEventConfigCache } from '../../src/lib/config/loadEventConfig';

let tmp: string | null = null;

function writeConfig(obj: unknown): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-config-'));
  const file = path.join(tmp, 'event.config.json');
  fs.writeFileSync(file, JSON.stringify(obj), 'utf8');
  return file;
}

afterEach(() => {
  if (tmp) {
    fs.rmSync(tmp, { recursive: true, force: true });
    tmp = null;
  }
  resetEventConfigCache();
});

describe('loadEventConfig', () => {
  it('loads a valid config file', () => {
    const cfg = loadEventConfig(
      writeConfig({
        event_name: 'E',
        event_slug: 'e-2026',
        allowed_email_domain: 'school.edu.ph',
        feedback_keystone: { enabled: false, questions: [] },
        loot: [{ id: 'a', label: 'A', qty: 1 }],
        quests: [{ id: 'q', title: 'Q', description: 'd' }],
      }),
    );
    expect(cfg.event_slug).toBe('e-2026');
  });

  it('throws ConfigError(validation) on missing quests / bad slug before server start', () => {
    const file = writeConfig({
      event_name: 'E',
      event_slug: 'BAD SLUG',
      allowed_email_domain: 'school.edu.ph',
      feedback_keystone: { enabled: false, questions: [] },
      loot: [{ id: 'a', label: 'A', qty: 1 }],
    });
    expect(() => loadEventConfig(file)).toThrow(ConfigError);
  });

  it('throws ConfigError(parse) on invalid JSON', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-config-'));
    const file = path.join(tmp, 'event.config.json');
    fs.writeFileSync(file, '{not json', 'utf8');
    expect(() => loadEventConfig(file)).toThrow(ConfigError);
  });

  it('throws ConfigError(read) when file missing', () => {
    expect(() => loadEventConfig(path.join(os.tmpdir(), 'does-not-exist.json'))).toThrow(ConfigError);
  });
});
