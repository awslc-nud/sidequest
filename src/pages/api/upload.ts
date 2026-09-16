import path from 'node:path';
import { randomInt } from 'node:crypto';
import type { APIRoute } from 'astro';
import { getEventConfig } from '../../lib/config/loadEventConfig';
import { getPrisma } from '../../lib/db/client';
import { Prisma } from '../../lib/db/client';
import { requireValidSession } from '../../lib/api/requireSession';
import { apiError, json } from '../../lib/api/http';
import { uploadAdmissionQueue } from '../../lib/uploadAdmission/admissionQueue';
import { writeUpload, ensureDir } from '../../lib/storage/writeUpload';
import { computeProgress } from '../../lib/progress/computeProgress';
import { dataDir, MAX_REQUEST_BYTES, MAX_UPLOAD_BYTES } from '../../lib/env';
import { nowMs } from '../../lib/time';
import { uploadFieldsSchema } from '../../lib/validation/payloads';

function retryAfterSeconds(): string {
  return String(randomInt(1, 5)); // jittered so waiting clients don't retry in lockstep
}

/**
 * POST /api/upload — accept a single confirmed photo (multipart/form-data).
 *
 * Wire order per spec: cheap validation → Admission Queue (§4.2b) → idempotent
 * replay check → disk write (streamed, atomic) → DB transaction (§4.3).
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const cfg = getEventConfig();
  const prisma = await getPrisma();

  // ── body ceiling (defense in depth alongside the 2MB file check) ──
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_REQUEST_BYTES) {
    return apiError('PAYLOAD_TOO_LARGE', 'request body exceeds the configured multipart limit', 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError('INVALID_REQUEST', 'unable to parse multipart body', 400);
  }

  const file = form.get('file');
  const parsed = uploadFieldsSchema.safeParse({
    session_id: form.get('session_id'),
    prompt_id: form.get('prompt_id'),
    client_capture_id: form.get('client_capture_id'),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code = issue?.path[0] === 'session_id' ? 'SESSION_MISMATCH' : issue?.path[0] === 'prompt_id' ? 'INVALID_PROMPT_ID' : 'INVALID_CLIENT_CAPTURE_ID';
    return apiError(code, issue?.message ?? 'invalid multipart field', code === 'SESSION_MISMATCH' ? 403 : 400);
  }
  const { session_id, prompt_id, client_capture_id } = parsed.data;

  if (!(file instanceof File)) {
    return apiError('INVALID_REQUEST', 'missing photo file', 400);
  }
  if (file.type !== 'image/webp') {
    return apiError('INVALID_CONTENT_TYPE', 'file must be image/webp', 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return apiError('FILE_TOO_LARGE', `file exceeds ${MAX_UPLOAD_BYTES} byte ceiling`, 400);
  }

  // ── session + chest gate ──
  const sessionResult = await requireValidSession({
    bodySessionId: session_id,
    cookieSessionId: locals.sessionId,
    prisma,
    eventSlug: cfg.event_slug,
  });
  if (!sessionResult.ok) return sessionResult.response;
  const session = sessionResult.session;

  if (session.unlockedAt !== null) {
    return apiError('CHEST_ALREADY_UNLOCKED', 'session has already unlocked the chest; quests are read-only', 409);
  }

  const quest = cfg.quests.find((q) => q.id === prompt_id);
  if (!quest) {
    return apiError('INVALID_PROMPT_ID', `unknown prompt_id ${prompt_id}`, 400);
  }

  // ── Admission Queue ──
  const admission = await uploadAdmissionQueue.tryEnqueue();
  if (!admission.admitted) {
    return apiError(
      'SERVER_BUSY',
      'Server is processing a burst of uploads, please retry shortly',
      429,
      { 'retry-after': retryAfterSeconds() },
    );
  }

  try {
    // ── idempotent replay check BEFORE touching disk (§4.3) ──
    const existing = await prisma.submission.findUnique({
      where: { sessionId_clientCaptureId: { sessionId: session.id, clientCaptureId: client_capture_id } },
    });
    if (existing) {
      const progress = await computeProgress(prisma, session.id, cfg);
      return json(
        {
          accepted: true,
          prompt_id,
          progress,
          chest_unlocked: session.unlockedAt !== null,
        },
        200,
      );
    }

    // ── disk write (must succeed before the DB row commits) ──
    const destDir = path.join(dataDir(), 'uploads', cfg.event_slug, prompt_id);
    const filename = `${session.id}_${nowMs()}.webp`;
    const finalPath = path.join(destDir, filename);
    await ensureDir(destDir);
    await writeUpload(finalPath, (file as File).stream());

    const relPath = path.posix.join(...path.relative(dataDir(), finalPath).split(path.sep));

    // ── DB transaction: upsert row, recompute progress, flip unlock ──
    try {
      const progress = await prisma.$transaction(async (tx) => {
        await tx.submission.upsert({
          where: { sessionId_promptId: { sessionId: session.id, promptId: prompt_id } },
          update: {
            clientCaptureId: client_capture_id,
            filePath: relPath,
            fileSizeBytes: file.size,
            receivedAt: BigInt(nowMs()),
          },
          create: {
            sessionId: session.id,
            eventSlug: cfg.event_slug,
            promptId: prompt_id,
            clientCaptureId: client_capture_id,
            filePath: relPath,
            fileSizeBytes: file.size,
            receivedAt: BigInt(nowMs()),
          },
        });

        const p = await computeProgress(tx, session.id, cfg);
        if (p && p.completed === p.total) {
          await tx.session.updateMany({
            where: { id: session.id, unlockedAt: null },
            data: { unlockedAt: BigInt(nowMs()) },
          });
        }
        return p;
      });

      if (!progress) {
        return apiError('SESSION_NOT_FOUND', 'session not found', 404);
      }
      return json(
        {
          accepted: true,
          prompt_id,
          progress,
          chest_unlocked: progress.completed === progress.total,
        },
        201,
      );
    } catch (e) {
      // File is already safely on disk; do not delete it. Surface retryable error.
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        return apiError('STORAGE_WRITE_FAILED', 'database write failed; file already stored safely', 500);
      }
      throw e;
    }
  } finally {
    admission.release();
  }
};
