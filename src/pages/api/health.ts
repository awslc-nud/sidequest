import type { APIRoute } from 'astro';
import { json } from '../../lib/api/http';

/**
 * GET /api/health — trivial liveness probe.
 *
 * Deliberately does no DB/config/disk work so the container healthcheck keeps
 * succeeding while the event loop is busy with an upload burst. (The old probe
 * hit `/api/config`, whose terms reads could stall the loop and trip a restart.)
 */
export const GET: APIRoute = () => json({ ok: true });
