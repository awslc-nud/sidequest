import { describe, expect, it } from 'vitest';
import { EventConfigSchema } from '../../src/lib/config/schema';

const valid = {
  event_name: 'Tech Summit 2026',
  event_slug: 'tech-summit-2026',
  allowed_email_domain: 'school.edu.ph',
  feedback_keystone: {
    enabled: true,
    questions: [
      { id: 'q1', type: 'rating_1_4', label: 'How was the event?' },
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

  it('auto-generates question ids by position when omitted', () => {
    const res = EventConfigSchema.parse({
      ...valid,
      feedback_keystone: {
        enabled: true,
        questions: [
          { type: 'rating_1_4', label: 'a' },
          { type: 'text', label: 'b' },
        ],
      },
    });
    expect(res.feedback_keystone.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('keeps explicit question ids and de-duplicates collisions', () => {
    const res = EventConfigSchema.parse({
      ...valid,
      feedback_keystone: {
        enabled: true,
        questions: [
          { id: 'x', type: 'rating_1_4', label: 'a' },
          { id: 'x', type: 'text', label: 'b' },
          { type: 'text', label: 'c' },
        ],
      },
    });
    expect(res.feedback_keystone.questions.map((q) => q.id)).toEqual(['x', 'x_2', 'q3']);
  });

  it('wraps a flat questions list into one untitled section', () => {
    const res = EventConfigSchema.parse(valid);
    expect(res.feedback_keystone.sections).toHaveLength(1);
    expect(res.feedback_keystone.sections[0].id).toBe('s1');
    expect(res.feedback_keystone.sections[0].title).toBeUndefined();
    expect(res.feedback_keystone.sections[0].questions.map((q) => q.id)).toEqual(['q1', 'q2']);
    // flat convenience list stays in display order
    expect(res.feedback_keystone.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('normalizes explicit sections with auto ids and keeps titles', () => {
    const res = EventConfigSchema.parse({
      ...valid,
      feedback_keystone: {
        enabled: true,
        sections: [
          { title: 'Event', questions: [{ type: 'rating_1_4', label: 'a' }] },
          { id: 'custom', title: 'Logistics', description: 'the boring bits', questions: [{ type: 'text', label: 'b' }] },
        ],
      },
    });
    expect(res.feedback_keystone.sections.map((s) => s.id)).toEqual(['s1', 'custom']);
    expect(res.feedback_keystone.sections[0].title).toBe('Event');
    expect(res.feedback_keystone.sections[1].description).toBe('the boring bits');
    expect(res.feedback_keystone.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('accepts ghost_text as a placeholder alias', () => {
    const res = EventConfigSchema.parse({
      ...valid,
      feedback_keystone: {
        enabled: true,
        questions: [{ type: 'text', label: 'a', ghost_text: 'Say hi' }],
      },
    });
    expect(res.feedback_keystone.questions[0].placeholder).toBe('Say hi');
  });
});
