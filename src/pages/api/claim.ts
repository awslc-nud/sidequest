import type { APIRoute } from 'astro';
import { getEventConfig } from '../../lib/config/loadEventConfig';
import { getPrisma } from '../../lib/db/client';
import { requireValidSession } from '../../lib/api/requireSession';
import { apiError, json, readJson } from '../../lib/api/http';
import { nowMs } from '../../lib/time';
import { validateEmail } from '../../lib/validation/email';
import { generateClaimToken, generateShortCode } from '../../lib/tokens/claimToken';
import { claimBodySchema } from '../../lib/validation/payloads';

function uniqueTargets(meta: unknown): string[] {
  const target = (meta as { target?: unknown } | undefined)?.target;
  const arr = Array.isArray(target) ? target : target ? [target] : [];
  return arr.map((t) => String(t).replace(/_/g, '').toLowerCase());
}

/**
 * POST /api/claim — mint the swag pass (§4.5).
 * Only valid once the chest is unlocked. Enforces the institutional-email rule
 * (AC-04) and the one-claim-per-session / one-claim-per-email rules.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const cfg = getEventConfig();
  const prisma = await getPrisma();

  const body = await readJson(request);
  const parsed = claimBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError('INVALID_BODY', 'invalid claim payload', 400);
  }
  const { session_id, student_email } = parsed.data;

  const sessionResult = await requireValidSession({
    bodySessionId: session_id,
    cookieSessionId: locals.sessionId,
    prisma,
    eventSlug: cfg.event_slug,
  });
  if (!sessionResult.ok) return sessionResult.response;
  const session = sessionResult.session;

  if (session.unlockedAt === null) {
    return apiError('CHEST_NOT_UNLOCKED', 'complete all tasks before claiming your pass', 400);
  }

  // The survey no longer counts towards progress, but it remains the keystone
  // required before claiming (see docs/ui-build.md #29).
  if (cfg.feedback_keystone.enabled && !session.feedbackDone) {
    return apiError('FEEDBACK_REQUIRED', 'complete the survey before claiming your pass', 400);
  }

  const emailCheck = validateEmail(student_email, cfg.allowed_email_domain);
  if (!emailCheck.ok) {
    return apiError(emailCheck.code, emailCheck.code === 'EMAIL_DOMAIN_MISMATCH' ? 'email domain not allowed' : 'invalid email syntax', 422);
  }
  const email = emailCheck.email;

  const lootSnapshot = JSON.stringify(cfg.loot);
  const now = nowMs();

  // Bounded retry loop: collide on short_code (or astronomically, claim_token) → regenerate.
  for (let attempt = 1; attempt <= 5; attempt++) {
    const claimToken = generateClaimToken();
    const shortCode = generateShortCode();
    try {
      const claim = await prisma.claim.create({
        data: {
          eventSlug: cfg.event_slug,
          sessionId: session.id,
          studentEmail: email,
          claimToken,
          shortCode,
          lootSnapshot,
          isClaimed: false,
          createdAt: BigInt(now),
        },
      });
      return json(
        {
          claim_token: claim.claimToken,
          short_code: claim.shortCode,
          student_email: claim.studentEmail,
          loot: cfg.loot,
        },
        201,
      );
    } catch (e) {
      // Prisma 7's query-compiler client may surface P2002 without the classic
      // error class/instance or meta.target — detect by code + disambiguate by
      // existing rows when the target list is unavailable.
      if ((e as { code?: string })?.code !== 'P2002') throw e;

      const targets = uniqueTargets((e as { meta?: unknown }).meta);
      if (targets.includes('sessionid')) {
        return apiError('SESSION_ALREADY_CLAIMED', 'this session has already minted a pass', 409);
      }
      if (targets.includes('studentemail')) {
        return apiError('EMAIL_ALREADY_CLAIMED', 'this email has already claimed a pass', 409);
      }
      if (!targets.includes('shortcode') && !targets.includes('claimtoken')) {
        // meta unavailable — decide by what already exists
        const bySession = await prisma.claim.findFirst({ where: { sessionId: session.id } });
        if (bySession) {
          return apiError('SESSION_ALREADY_CLAIMED', 'this session has already minted a pass', 409);
        }
        const byEmail = await prisma.claim.findFirst({
          where: { eventSlug: cfg.event_slug, studentEmail: email },
        });
        if (byEmail) {
          return apiError('EMAIL_ALREADY_CLAIMED', 'this email has already claimed a pass', 409);
        }
      }
      continue; // short_code / claim_token collision — regenerate and retry
    }
  }

  return apiError('CLAIM_MINT_FAILED', 'could not mint a unique claim pass, please retry', 500);
};
