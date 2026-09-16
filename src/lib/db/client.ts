import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/client';
import { dbFilePath } from '../env';

export { PrismaClient };

export interface DbHandle {
  prisma: PrismaClient;
  close: () => Promise<void>;
}

const DEFAULT_PRAGMAS = [
  'PRAGMA journal_mode = WAL;',
  'PRAGMA busy_timeout = 5000;',
  'PRAGMA foreign_keys = ON;',
];

/**
 * Open a SQLite file through Prisma's better-sqlite3 driver adapter and apply
 * the connection-time PRAGMAs the spec requires (§2.2). The Prisma query
 * compiler client is engine-free, so the pragmas run over the adapter.
 */
export async function createClient(dbPath: string): Promise<DbHandle> {
  const adapter = new PrismaBetterSqlite3({ url: dbPath, timeout: 5000 });
  const prisma = new PrismaClient({ adapter });
  for (const pragma of DEFAULT_PRAGMAS) {
    await prisma.$queryRawUnsafe(pragma);
  }
  return {
    prisma,
    close: async () => {
      await prisma.$disconnect().catch(() => undefined);
    },
  };
}

let singleton: DbHandle | null = null;

/**
 * Process-wide Prisma client bound to DATABASE_URL. Constructed lazily on
 * first use so tests / build steps that never touch the DB pay no cost.
 */
export async function getClient(): Promise<DbHandle> {
  if (!singleton) {
    singleton = await createClient(dbFilePath());
  }
  return singleton;
}

export async function getPrisma(): Promise<PrismaClient> {
  return (await getClient()).prisma;
}

/** Close and drop the singleton (test teardown / restart). */
export async function resetClient(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}

export { Prisma } from './generated/client';
export type { Session, Submission, Claim, FeedbackResponse, MarshalSession } from './generated/client';

