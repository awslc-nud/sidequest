import path from 'node:path';

let loaded = false;

/**
 * Load `.env` into process.env once, without overriding variables that are
 * already set (tests/containers set real env vars and must win).
 */
function ensureEnvLoaded(): void {
  if (loaded) return;
  loaded = true;
  try {
    process.loadEnvFile?.();
  } catch {
    // no .env present — env is expected to come from the shell/container
  }
}

export function envStr(name: string, fallback = ''): string {
  ensureEnvLoaded();
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export function envInt(name: string, fallback: number): number {
  const v = Number.parseInt(envStr(name, ''), 10);
  return Number.isFinite(v) ? v : fallback;
}

export function envBool(name: string): boolean {
  const v = envStr(name, '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

const DEFAULT_DATABASE_URL = 'file:./data/sidequest.db';

/** SQLite connection URL (used by the Prisma CLI). */
export function databaseUrl(): string {
  return envStr('DATABASE_URL', DEFAULT_DATABASE_URL);
}

/** Absolute filesystem path of the SQLite file, derived from DATABASE_URL. */
export function dbFilePath(): string {
  const raw = databaseUrl();
  let p = raw;
  if (p.startsWith('file://')) p = p.slice('file://'.length);
  else if (p.startsWith('file:')) p = p.slice('file:'.length);
  return path.resolve(process.cwd(), p);
}

/** Root directory for uploaded media (spec: single `data/` volume). */
export function dataDir(): string {
  return path.resolve(process.cwd(), envStr('SIDEQUEST_DATA_DIR', './data'));
}

/** Absolute path of the master event config JSON. */
export function eventConfigPath(): string {
  return path.resolve(process.cwd(), envStr('EVENT_CONFIG_PATH', 'event.config.json'));
}

/** Absolute path of the directory holding the editable terms text files. */
export function termsDir(): string {
  return path.resolve(process.cwd(), envStr('TERMS_DIR', 'terms'));
}

/** Marshal shared static passphrase (empty => marshal auth always fails closed). */
export function marshalSecretKey(): string {
  return envStr('MARSHAL_SECRET_KEY', '');
}

/** Server-side Upload Admission Queue tuning (§4.2b). */
export function uploadConcurrency(): number {
  return envInt('UPLOAD_CONCURRENCY', 4);
}

export function uploadQueueDepth(): number {
  return envInt('UPLOAD_QUEUE_DEPTH', 40);
}

/** Test-only override that bypasses the Admission Queue (see §5.2 WAL smoke test). */
export function uploadQueueDisabled(): boolean {
  return envBool('SIDEQUEST_UPLOAD_QUEUE_DISABLED');
}

/** Max bytes accepted on JSON API bodies (claim/feedback/redeem). */
export function jsonBodyLimitBytes(): number {
  return envInt('JSON_BODY_LIMIT_BYTES', 64 * 1024);
}

/** Test-only override that disables the in-process rate limiter. */
export function rateLimitDisabled(): boolean {
  return envBool('SIDEQUEST_RATE_LIMIT_DISABLED');
}

/** Attendee + marshal cookie lifetime in seconds. */
export function sessionMaxAgeSeconds(): number {
  return envInt('SESSION_MAX_AGE_SECONDS', 43200);
}

/** Hard reject ceiling for an uploaded photo, in bytes (§2.1). */
export const MAX_UPLOAD_BYTES = 2_000_000;

/** Multipart request body ceiling (defense in depth alongside the 2MB file check). */
export const MAX_REQUEST_BYTES = 8_000_000;
