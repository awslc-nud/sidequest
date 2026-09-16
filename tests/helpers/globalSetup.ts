import { execFileSync } from 'node:child_process';

/**
 * Build the Astro SSR server before the suite runs. Integration tests boot
 * `dist/server/entry.mjs` with per-test temp SQLite DBs + config fixtures.
 * Set SIDEQUEST_SKIP_BUILD=1 to reuse an existing dist during local iteration.
 */
export default function setup(): void {
  if (process.env.SIDEQUEST_SKIP_BUILD === '1') return;
  execFileSync('npx', ['astro', 'build'], { cwd: process.cwd(), stdio: 'inherit' });
}
