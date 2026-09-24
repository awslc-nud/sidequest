import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

export const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');
export const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'prisma', 'migrations');
export const DEFAULT_SECRET = 'test-marshal-secret-key-0123456789';
/** Stable event fixture so integration tests don't depend on the live event.config.json. */
export const DEFAULT_CONFIG_FILE = path.join(PROJECT_ROOT, 'tests', 'fixtures', 'config.json');

function applyMigrations(dbPath: string): void {
  const dirs = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const db = new Database(dbPath);
  try {
    for (const dir of dirs) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8');
      db.exec(sql);
    }
  } finally {
    db.close();
  }
}

async function freePort(): Promise<number> {
  const srv = net.createServer();
  await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const port = (srv.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => srv.close(() => resolve()));
  return port;
}

export interface TestServer {
  baseUrl: string;
  stop: () => Promise<void>;
  tmpRoot: string;
}

export interface ServerOptions {
  env?: Record<string, string>;
  /** Override the event config file the server loads. */
  configFile?: string;
}

export async function startServer(opts: ServerOptions = {}): Promise<TestServer> {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sidequest-'));
  const dataDir = path.join(tmpRoot, 'data');
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
  const dbPath = path.join(dataDir, 'sidequest.db');
  applyMigrations(dbPath);

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    DATABASE_URL: `file:${dbPath}`,
    SIDEQUEST_DATA_DIR: dataDir,
    MARSHAL_SECRET_KEY: DEFAULT_SECRET,
    // Keep integration tests deterministic; the limiter has its own unit test.
    SIDEQUEST_RATE_LIMIT_DISABLED: '1',
    // Pin the event config to the fixture so the live config can change freely.
    EVENT_CONFIG_PATH: opts.configFile ?? DEFAULT_CONFIG_FILE,
    ...opts.env,
  };

  const child: ChildProcess = spawn('node', [path.join(PROJECT_ROOT, 'dist/server/entry.mjs')], {
    cwd: PROJECT_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let log = '';
  child.stdout?.on('data', (d) => (log += String(d)));
  child.stderr?.on('data', (d) => (log += String(d)));

  const deadline = Date.now() + 15_000;
  for (;;) {
    if (child.exitCode !== null) {
      child.kill();
      throw new Error(`server exited early (${child.exitCode}):\n${log}`);
    }
    try {
      const res = await fetch(`${baseUrl}/api/config`, { headers: { origin: baseUrl } });
      if (res.ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`server failed to become ready:\n${log}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  return {
    baseUrl,
    tmpRoot,
    async stop() {
      child.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 150));
      if (child.exitCode === null) child.kill('SIGKILL');
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    },
  };
}
