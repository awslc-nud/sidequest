import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ConfigError,
  getEventConfig,
  loadEventConfig,
  resetEventConfigCache,
} from '../../src/lib/config/loadEventConfig';

let tmp: string | null = null;

function writeConfig(obj: unknown): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-config-'));
  const file = path.join(tmp, 'event.config.json');
  fs.writeFileSync(file, JSON.stringify(obj), 'utf8');
  return file;
}

/** Base event config that references an external `survey.json`. */
function eventWithSurvey(surveyFile = 'survey.json') {
  return {
    event_name: 'E',
    event_slug: 'e-2026',
    allowed_email_domain: 'school.edu.ph',
    feedback_keystone: { enabled: true, survey_file: surveyFile },
    loot: [{ id: 'a', label: 'A', qty: 1 }],
    quests: [{ id: 'q', title: 'Q', description: 'd' }],
  };
}

afterEach(() => {
  if (tmp) {
    fs.rmSync(tmp, { recursive: true, force: true });
    tmp = null;
  }
  delete process.env.EVENT_CONFIG_PATH;
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

  it('loads questions from an external survey_file', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-config-'));
    fs.writeFileSync(
      path.join(tmp, 'survey.json'),
      JSON.stringify({ sections: [{ title: 'A', questions: [{ type: 'text', label: 'Why?' }] }] }),
      'utf8',
    );
    const file = path.join(tmp, 'event.config.json');
    fs.writeFileSync(file, JSON.stringify(eventWithSurvey()), 'utf8');

    const cfg = loadEventConfig(file);
    expect(cfg.feedback_keystone.sections).toHaveLength(1);
    expect(cfg.feedback_keystone.sections[0].title).toBe('A');
    expect(cfg.feedback_keystone.questions[0].label).toBe('Why?');
  });

  it('throws ConfigError when the referenced survey file is missing', () => {
    const file = writeConfig(eventWithSurvey('nope.json'));
    expect(() => loadEventConfig(file)).toThrow(ConfigError);
  });

  it('re-parses when only the survey file changes (hot reload)', async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-config-'));
    const survey = path.join(tmp, 'survey.json');
    fs.writeFileSync(
      survey,
      JSON.stringify({ sections: [{ questions: [{ type: 'text', label: 'Why?' }] }] }),
      'utf8',
    );
    const file = path.join(tmp, 'event.config.json');
    fs.writeFileSync(file, JSON.stringify(eventWithSurvey()), 'utf8');
    process.env.EVENT_CONFIG_PATH = file;

    expect(getEventConfig().feedback_keystone.questions[0].label).toBe('Why?');

    fs.writeFileSync(
      survey,
      JSON.stringify({ sections: [{ questions: [{ type: 'text', label: 'Changed?' }] }] }),
      'utf8',
    );
    expect(getEventConfig().feedback_keystone.questions[0].label).toBe('Changed?');
  });
});
