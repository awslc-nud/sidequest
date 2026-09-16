import { describe, expect, it } from 'vitest';
import {
  uploadFieldsSchema,
  feedbackBodySchema,
  claimBodySchema,
  redeemBodySchema,
} from '../../src/lib/validation/payloads';

const sid = '11111111-1111-4111-8111-111111111111';

describe('payload schemas', () => {
  it('accepts valid upload fields', () => {
    expect(
      uploadFieldsSchema.safeParse({
        session_id: sid,
        prompt_id: 'prompt_2_stage',
        client_capture_id: '22222222-2222-4222-8222-222222222222',
      }).success,
    ).toBe(true);
  });

  it('rejects bad upload prompt_id / session ids', () => {
    expect(uploadFieldsSchema.safeParse({ session_id: 'nope', prompt_id: 'Pascal', client_capture_id: sid }).success).toBe(false);
    expect(uploadFieldsSchema.safeParse({ session_id: sid, prompt_id: 'Pascal', client_capture_id: sid }).success).toBe(false);
  });

  it('accepts a valid feedback body', () => {
    expect(feedbackBodySchema.safeParse({ session_id: sid, answers: { q1: 5, q2: 'text' } }).success).toBe(true);
    expect(feedbackBodySchema.safeParse({ session_id: sid, answers: { q1: true } }).success).toBe(true); // boolean is a legal answer value
    expect(feedbackBodySchema.safeParse({ session_id: sid, answers: { q1: [1] } }).success).toBe(false);
    expect(feedbackBodySchema.safeParse({ session_id: sid, answers: { q1: null } }).success).toBe(false);
  });

  it('accepts a valid claim body', () => {
    expect(claimBodySchema.safeParse({ session_id: sid, student_email: 'x@school.edu.ph' }).success).toBe(true);
  });

  it('redeem requires exactly one of claim_token / short_code', () => {
    const token = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(redeemBodySchema.safeParse({ claim_token: token }).success).toBe(true);
    expect(redeemBodySchema.safeParse({ short_code: 'K4T9' }).success).toBe(true);
    expect(redeemBodySchema.safeParse({}).success).toBe(false);
    expect(redeemBodySchema.safeParse({ claim_token: token, short_code: 'K4T9' }).success).toBe(false);
    expect(redeemBodySchema.safeParse({ short_code: '0O1L' }).success).toBe(false); // excluded chars
  });
});
