import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    globalSetup: ['tests/helpers/globalSetup.ts'],
    // Integration tests boot real SSR servers against SQLite files; running the
    // files serially keeps ports / temp DBs isolated and the race/burst tests stable.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
