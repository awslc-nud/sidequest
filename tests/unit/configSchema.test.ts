import { describe, expect, it } from 'vitest';
import { EventConfigSchema } from '../../src/lib/config/schema';

const valid = {
  event_name: 'Tech Summit 2026',
  event_slug: 'tech-summit-2026',
  allowed_email_domain: 'school.edu.ph',
  feedback_keystone: {
    enabled: true,
    questions: [
      { id: 'q1', type: 'rating_1_5', label: 'How was the event?' },
      { id: 'q2', type: 'text', label: 'Any suggestions?' },
    ],
  },
  loot: [
    { id: 'sticker_pack', label: '1x Sticker Pack', qty: 1 },
    { id: 'tardigrade_pin', label: '1x Tardigrade Pin', qty: 1 },
  ],
  quests: [
    { id: 'prompt_1_arrival', title: 'Arrival Selfie', description: 'x' },
    { id: 'prompt_2_stage', title: 'Stage Slide', description: 'x' },
  ],
};

describe('EventConfigSchema', () => {
  it('parses the §2.3 fixture', () => {
    expect(EventConfigSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a config missing quests', () => {
    const { quests, ...rest } = valid as any;
    const res = EventConfigSchema.safeParse(rest);
    expect(res.success).toBe(false);
  });

  it('rejects a bad event_slug regex (spaces)', () => {
    expect(EventConfigSchema.safeParse({ ...valid, event_slug: 'Bad Slug' }).success).toBe(false);
  });

  it('rejects a bad quest id charset', () => {
    expect(EventConfigSchema.safeParse({ ...valid, quests: [{ ...valid.quests[0], id: 'Pascal Case' }] }).success).toBe(false);
  });
});
