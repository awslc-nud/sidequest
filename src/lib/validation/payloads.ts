import { z } from 'zod';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PROMPT_ID_RE = /^[a-z0-9_]+$/;

export const sessionIdSchema = z
  .string()
  .regex(UUID_RE, 'session_id must be a UUIDv4')
  .describe('session_id');

/** Parsed fields of the `/api/upload` multipart form (file validated separately). */
export const uploadFieldsSchema = z.object({
  session_id: sessionIdSchema,
  prompt_id: z.string().regex(PROMPT_ID_RE, 'invalid prompt_id'),
  client_capture_id: sessionIdSchema,
});

/** Answer values allowed by the feedback config question types. */
const answerSchema = z.union([z.number(), z.string().min(1).max(2000), z.boolean()]);

export const feedbackBodySchema = z.object({
  session_id: sessionIdSchema,
  answers: z.record(z.string(), answerSchema),
});

export const claimBodySchema = z.object({
  session_id: sessionIdSchema,
  student_email: z.string().min(3).max(320),
});

/** `/api/marshal/redeem` — exactly one of claim_token / short_code must be present. */
export const redeemBodySchema = z
  .object({
    claim_token: sessionIdSchema.optional(),
    short_code: z.string().regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/).optional(),
  })
  .superRefine((val, ctx) => {
    const hasToken = val.claim_token !== undefined;
    const hasCode = val.short_code !== undefined;
    if (hasToken === hasCode) {
      ctx.addIssue({
        code: 'custom',
        path: ['body'],
        message: 'exactly one of claim_token or short_code is required',
      });
    }
  });

export type UploadFields = z.infer<typeof uploadFieldsSchema>;
export type FeedbackBody = z.infer<typeof feedbackBodySchema>;
export type ClaimBody = z.infer<typeof claimBodySchema>;
export type RedeemBody = z.infer<typeof redeemBodySchema>;
