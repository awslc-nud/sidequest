import path from 'node:path';
import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile?.();
} catch {
  // .env is optional (env may be provided by the shell/container).
}

const rawUrl = process.env.DATABASE_URL ?? 'file:./data/sidequest.db';

function toSqliteFileUrl(raw: string): string {
  if (!raw.startsWith('file:')) return raw;
  const p = raw.slice('file:'.length);
  return 'file:' + path.resolve(process.cwd(), p);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: toSqliteFileUrl(rawUrl),
  },
});
