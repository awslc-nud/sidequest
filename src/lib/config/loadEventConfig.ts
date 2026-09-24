import fs from 'node:fs';
import path from 'node:path';
import type { EventConfig } from './schema';
import { EventConfigSchema } from './schema';
import { eventConfigPath } from '../env';

export class ConfigError extends Error {
  readonly kind: 'read' | 'parse' | 'validation';
  readonly issues?: unknown;

  constructor(kind: ConfigError['kind'], message: string, issues?: unknown) {
    super(message);
    this.name = 'ConfigError';
    this.kind = kind;
    this.issues = issues;
  }
}

export interface LoadedEventConfig {
  config: EventConfig;
  /** Absolute path of the referenced survey file, or null when inline. */
  surveyPath: string | null;
  surveyMtimeMs: number;
  surveySize: number;
}

/** Parse the JSON of a referenced survey file (throws ConfigError). */
function readSurveyFile(surveyPath: string): { sections?: unknown; questions?: unknown } {
  let text: string;
  try {
    text = fs.readFileSync(surveyPath, 'utf8');
  } catch (e) {
    throw new ConfigError('read', `Cannot read survey file at ${surveyPath}: ${(e as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new ConfigError('parse', `survey file is not valid JSON: ${(e as Error).message}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ConfigError('validation', 'survey file must be a JSON object with "sections" or "questions"');
  }
  return parsed as { sections?: unknown; questions?: unknown };
}

/**
 * Parse + Zod-validate an event config file, resolving `feedback_keystone.survey_file`
 * (relative to the config file) into the survey's `sections`/`questions` when set.
 * Throws ConfigError on any failure. Use `getEventConfig()` for the cached read.
 */
export function loadEventConfigWithMeta(filePath = eventConfigPath()): LoadedEventConfig {
  let text: string;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    throw new ConfigError('read', `Cannot read event config at ${filePath}: ${(e as Error).message}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new ConfigError('parse', `event.config.json is not valid JSON: ${(e as Error).message}`);
  }

  // Optional external survey file: keeps the event config small while letting the
  // survey grow on its own. Paths resolve relative to the event config.
  let surveyPath: string | null = null;
  let surveyMtimeMs = 0;
  let surveySize = 0;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const fk = (raw as Record<string, unknown>).feedback_keystone;
    if (fk && typeof fk === 'object' && !Array.isArray(fk)) {
      const feedback = fk as Record<string, unknown>;
      const surveyFile = feedback.survey_file;
      if (typeof surveyFile === 'string' && surveyFile.trim()) {
        surveyPath = path.resolve(path.dirname(filePath), surveyFile.trim());
        const survey = readSurveyFile(surveyPath);
        if (survey.sections !== undefined) feedback.sections = survey.sections;
        if (survey.questions !== undefined) feedback.questions = survey.questions;
        delete feedback.survey_file;
        const stat = fs.statSync(surveyPath);
        surveyMtimeMs = stat.mtimeMs;
        surveySize = stat.size;
      }
    }
  }

  const result = EventConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError('validation', `event.config.json failed schema validation`, result.error.issues);
  }
  return { config: result.data, surveyPath, surveyMtimeMs, surveySize };
}

/** Parse + validate an event config file (discarding file-tracking metadata). */
export function loadEventConfig(filePath = eventConfigPath()): EventConfig {
  return loadEventConfigWithMeta(filePath).config;
}

interface CacheEntry {
  absPath: string;
  mtimeMs: number;
  size: number;
  config: EventConfig;
  surveyPath: string | null;
  surveyMtimeMs: number;
  surveySize: number;
}

let cache: CacheEntry | null = null;

/** True when the referenced survey file changed since it was cached. */
function surveyChanged(entry: CacheEntry): boolean {
  if (!entry.surveyPath) return false;
  try {
    const stat = fs.statSync(entry.surveyPath);
    return stat.mtimeMs !== entry.surveyMtimeMs || stat.size !== entry.surveySize;
  } catch {
    return true; // deleted/broken → reload and surface the error
  }
}

/**
 * Load the event config once per process, transparently re-parsing when the
 * event config **or** its referenced survey file changes on disk (dev
 * hot-reload). Throws if the config is invalid — the server must refuse to serve
 * traffic with a broken config (§2.3/§3.1).
 */
export function getEventConfig(): EventConfig {
  const abs = eventConfigPath();
  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    // file may not exist yet — fall through and let loadEventConfig throw
    if (cache?.absPath === abs) return cache.config;
    return loadEventConfig(abs);
  }

  const fresh =
    cache &&
    cache.absPath === abs &&
    cache.mtimeMs === stat.mtimeMs &&
    cache.size === stat.size &&
    !surveyChanged(cache);
  if (fresh && cache) return cache.config;

  const loaded = loadEventConfigWithMeta(abs);
  cache = {
    absPath: abs,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    config: loaded.config,
    surveyPath: loaded.surveyPath,
    surveyMtimeMs: loaded.surveyMtimeMs,
    surveySize: loaded.surveySize,
  };
  return cache.config;
}

/** Clear the cached config (mainly for tests). */
export function resetEventConfigCache(): void {
  cache = null;
}
