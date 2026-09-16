import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { TestServer } from './server';

/** Run a read against the server's SQLite file (WAL allows concurrent readers). */
export function readDb<T = any>(server: TestServer, sql: string, params: unknown[] = []): T[] {
  const db = new Database(path.join(server.tmpRoot, 'data', 'sidequest.db'), { readonly: true });
  try {
    return db.prepare(sql).all(...params) as T[];
  } finally {
    db.close();
  }
}

export function readCount(server: TestServer, table: string, where = ''): number {
  const sql = `SELECT COUNT(*) AS c FROM ${table}${where ? ` WHERE ${where}` : ''}`;
  return (readDb(server, sql)[0] as { c: number }).c;
}

/** Absolute upload root for the default (tech-summit-2026) fixture. */
export function uploadDir(server: TestServer, promptId: string): string {
  return path.join(server.tmpRoot, 'data', 'uploads', 'tech-summit-2026', promptId);
}

export function filesIn(dir: string): string[] {
  return fs.readdirSync(dir).filter((f) => !f.endsWith('.part'));
}

/** Insert a marshal session row directly (expiry control for guard tests). */
export function insertMarshalSession(
  server: TestServer,
  opts: { token: string; expiresAt: number; label?: string | null },
): void {
  const db = new Database(path.join(server.tmpRoot, 'data', 'sidequest.db'));
  try {
    db.prepare(
      `INSERT INTO marshal_sessions (token, created_at, expires_at, label)
       VALUES (@token, @createdAt, @expiresAt, @label)`,
    ).run({ token: opts.token, createdAt: Date.now(), expiresAt: opts.expiresAt, label: opts.label ?? null });
  } finally {
    db.close();
  }
}

/** Insert a minimal session row (satisfies the claims FK for direct inserts). */
export function insertSessionRow(server: TestServer, sessionId: string, eventSlug = 'tech-summit-2026'): void {
  const db = new Database(path.join(server.tmpRoot, 'data', 'sidequest.db'));
  try {
    db.prepare(
      `INSERT OR IGNORE INTO sessions (id, event_slug, created_at, last_seen_at, feedback_done)
       VALUES (?, ?, ?, ?, 0)`,
    ).run(sessionId, eventSlug, Date.now(), Date.now());
  } finally {
    db.close();
  }
}

/** Insert a directly-mintable claim row (used to race redemption cheaply). */
export function insertClaim(
  server: TestServer,
  opts: {
    sessionId: string;
    email: string;
    claimToken: string;
    shortCode: string;
    isClaimed?: boolean;
    eventSlug?: string;
  },
): void {
  insertSessionRow(server, opts.sessionId, opts.eventSlug);
  const db = new Database(path.join(server.tmpRoot, 'data', 'sidequest.db'));
  try {
    db.prepare(
      `INSERT INTO claims
        (event_slug, session_id, student_email, claim_token, short_code, loot_snapshot, is_claimed, claimed_at, created_at)
       VALUES (@eventSlug, @sessionId, @email, @claimToken, @shortCode, @loot, @isClaimed, NULL, @createdAt)`,
    ).run({
      eventSlug: opts.eventSlug ?? 'tech-summit-2026',
      sessionId: opts.sessionId,
      email: opts.email,
      claimToken: opts.claimToken,
      shortCode: opts.shortCode,
      loot: JSON.stringify([{ id: 'sticker_pack', label: '1x Sticker Pack', qty: 1 }]),
      isClaimed: opts.isClaimed ? 1 : 0,
      createdAt: Date.now(),
    });
  } finally {
    db.close();
  }
}
