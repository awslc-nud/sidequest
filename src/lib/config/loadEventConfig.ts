import fs from 'node:fs';
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

/** Parse + Zod-validate an event config file. Throws ConfigError on any failure. */
export function loadEventConfig(filePath = eventConfigPath()): EventConfig {
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

  const result = EventConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError('validation', `event.config.json failed schema validation`, result.error.issues);
  }
  return result.data;
}

interface CacheEntry {
  absPath: string;
  mtimeMs: number;
  size: number;
  config: EventConfig;
}

let cache: CacheEntry | null = null;

/**
 * Load the event config once per process, transparently re-parsing when the
 * file changes on disk (dev hot-reload). Throws if the config is invalid — the
 * server must refuse to serve traffic with a broken config (§2.3/§3.1).
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

  if (cache && cache.absPath === abs && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) {
    return cache.config;
  }

  const config = loadEventConfig(abs);
  cache = { absPath: abs, mtimeMs: stat.mtimeMs, size: stat.size, config };
  return config;
}

/** Clear the cached config (mainly for tests). */
export function resetEventConfigCache(): void {
  cache = null;
}
