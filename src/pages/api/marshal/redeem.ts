import type { APIRoute } from 'astro';
import { getEventConfig } from '../../../lib/config/loadEventConfig';
import { getPrisma } from '../../../lib/db/client';
import { apiError, json, num, readJson } from '../../../lib/api/http';
import { nowMs, isoFormat } from '../../../lib/time';
import { redeemBodySchema } from '../../../lib/validation/payloads';

/**
 * POST /api/marshal/redeem — atomically redeem a swag pass (§3.7 / §4.7).
 *
 * Middleware already guards this route (401 MARSHAL_UNAUTHENTICATED when the
 * sq_marshal cookie is missing/expired). Exactly one of claim_token (scanned
 * QR) or short_code (manual keypad) must be present.
 *
 * The atomic gate is a single `updateMany` (`UPDATE ... WHERE is_claimed =
 * false`): SQLite serializes writers, so of two concurrent scans only one flips
 * the row; the loser's predicate matches zero rows deterministically.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  if (locals.isMarshal !== true) {
    return apiError('MARSHAL_UNAUTHENTICATED', 'Marshal session missing or expired', 401);
  }

  const prisma = await getPrisma();
  const cfg = getEventConfig();
  const body = await readJson(request);
  const parsed = redeemBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError('MISSING_TOKEN', 'exactly one of claim_token or short_code is required', 400);
  }
  const { claim_token, short_code } = parsed.data;

  // claim_token is globally unique; short_code is unique per event.
  const row = claim_token
    ? await prisma.claim.findUnique({ where: { claimToken: claim_token } })
    : await prisma.claim.findUnique({
        where: { eventSlug_shortCode: { eventSlug: cfg.event_slug, shortCode: short_code! } },
      });

  if (!row) {
    return apiError('TOKEN_NOT_FOUND', 'no claim matches this token or code', 404);
  }

  const now = nowMs();

  // ── THE ATOMIC GATE ──
  const result = await prisma.claim.updateMany({
    where: { claimToken: row.claimToken, isClaimed: false },
    data: { isClaimed: true, claimedAt: BigInt(now), claimedByMarshal: locals.marshalLabel ?? null },
  });

  if (result.count === 1) {
    return json({
      status: 'claimed',
      student_email: row.studentEmail,
      loot: JSON.parse(row.lootSnapshot),
      claimed_at: now,
    });
  }

  // count === 0: we lost the race (or it was claimed earlier) — read authoritative timestamp.
  const current = await prisma.claim.findUnique({
    where: { claimToken: row.claimToken },
    select: { claimedAt: true },
  });
  const claimedAt = num(current?.claimedAt ?? null);
  return json(
    {
      error: {
        code: 'ALREADY_CLAIMED',
        message: `ALREADY CLAIMED at ${isoFormat(claimedAt ?? 0)}`,
        claimed_at: claimedAt,
      },
    },
    409,
  );
};
