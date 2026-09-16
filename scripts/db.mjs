#!/usr/bin/env node
/**
 * SideQuest dev database helper.
 *
 *   node scripts/db.mjs stats            # row counts + uploads size
 *   node scripts/db.mjs reset            # clear all rows + uploads (safe while dev server runs)
 *   node scripts/db.mjs clear-uploads    # delete uploaded media only
 *   node scripts/db.mjs reset --hard     # delete the DB file(s) + uploads, then re-apply migrations
 *
 * Why not just `rm data/sidequest.db`? The dev server keeps an open SQLite
 * connection. On Linux, deleting the file leaves that connection writing to an
 * unlinked inode, so the server and any new connection silently diverge — that's
 * how the DB "breaks". Plain `reset` clears rows over the same open file, so it
 * is safe while the server is running. `reset --hard` replaces the file and
 * therefore wants the server stopped (it warns but proceeds).
 *
 * Schema migrations in `_prisma_migrations` are preserved by `reset`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';

try {
  process.loadEnvFile?.();
} catch {
  // .env optional
}

const command = process.argv[2] ?? 'stats';
const hard = process.argv.includes('--hard');

function dbPath() {
  const raw = process.env.DATABASE_URL ?? 'file:./data/sidequest.db';
  const p = raw.startsWith('file://') ? raw.slice(7) : raw.startsWith('file:') ? raw.slice(5) : raw;
  return path.resolve(process.cwd(), p);
}

function dataDir() {
  return path.resolve(process.cwd(), process.env.SIDEQUEST_DATA_DIR ?? './data');
}

function uploadsDir() {
  return path.join(dataDir(), 'uploads');
}

function humanBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function openDb() {
  const file = dbPath();
  if (!fs.existsSync(file)) {
    console.error(`No database at ${file}`);
    console.error('Run `npm run db:migrate` (or `db:reset --hard`) first.');
    process.exit(1);
  }
  return new Database(file);
}

function userTables(db) {
  return db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY name",
    )
    .all()
    .map((r) => r.name);
}

function stats() {
  const db = openDb();
  try {
    const tables = userTables(db);
    console.log(`Database: ${dbPath()}`);
    console.log(`Tables:   ${tables.length ? tables.join(', ') : '(none)'}`);
    for (const t of tables) {
      const n = db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
      console.log(`  ${t.padEnd(20)} ${n}`);
    }
    const migrations = db
      .prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'")
      .get().c;
    if (migrations) {
      const applied = db.prepare('SELECT COUNT(*) AS c FROM _prisma_migrations WHERE finished_at IS NOT NULL').get().c;
      console.log(`  migrations applied   ${applied}`);
    }
  } finally {
    db.close();
  }

  const files = walkFiles(uploadsDir());
  const bytes = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
  console.log(`Uploads:  ${files.length} file(s), ${humanBytes(bytes)} under ${uploadsDir()}`);
}

function clearUploads() {
  const dir = uploadsDir();
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  console.log(`Cleared uploads in ${dir}`);
}

function resetRows() {
  const db = openDb();
  try {
    const tables = userTables(db);
    const tx = db.transaction(() => {
      db.pragma('foreign_keys = OFF');
      for (const t of tables) db.prepare(`DELETE FROM "${t}"`).run();
      // reset AUTOINCREMENT counters when the bookkeeping table exists
      const hasSeq = db
        .prepare("SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
        .get().c;
      if (hasSeq) db.prepare('DELETE FROM sqlite_sequence').run();
      db.pragma('foreign_keys = ON');
    });
    tx();
    console.log(`Cleared ${tables.length} table(s): ${tables.join(', ')}`);
  } finally {
    db.close();
  }
  clearUploads();
}

function removeDbFiles() {
  const file = dbPath();
  for (const f of [file, `${file}-wal`, `${file}-shm`, `${file}-journal`]) {
    fs.rmSync(f, { force: true });
  }
  console.log(`Removed ${file} (+ WAL/SHM sidecars)`);
}

function deploy() {
  console.log('Applying migrations…');
  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], { cwd: process.cwd(), stdio: 'inherit' });
  } catch {
    console.error('\nMigration failed. On NixOS this usually means PRISMA_SCHEMA_ENGINE_BINARY is not set.');
    console.error('Enter the project shell (`direnv allow` / `nix develop`) or run `npm run db:deploy` from it.');
    process.exit(1);
  }
}

switch (command) {
  case 'stats':
    stats();
    break;
  case 'reset':
    if (hard) {
      console.warn('Hard reset replaces the DB file — make sure the dev server is stopped.');
      removeDbFiles();
      clearUploads();
      deploy();
    } else {
      resetRows();
    }
    break;
  case 'clear-uploads':
    clearUploads();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error('Usage: node scripts/db.mjs <stats|reset [--hard]|clear-uploads>');
    process.exit(1);
}
