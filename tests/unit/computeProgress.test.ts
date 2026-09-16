import { describe, expect, it } from 'vitest';
import { computeProgress, type ProgressDb } from '../../src/lib/progress/computeProgress';

function makeDb(rows: Array<{ promptId: string }>, feedbackDone: boolean): ProgressDb {
  return {
    submission: {
      findMany: async () => rows,
    } as any,
    session: {
      findUnique: async () => ({ feedbackDone }),
    },
  } as any;
}

const feedbackOn = {
  event_name: 'E',
  event_slug: 'e',
  allowed_email_domain: 'd.edu',
  feedback_keystone: { enabled: true, questions: [] },
  loot: [],
  quests: [
    { id: 'p1', title: 't', description: 'd' },
    { id: 'p2', title: 't', description: 'd' },
  ],
} as any;

const feedbackOff = { ...feedbackOn, feedback_keystone: { enabled: false, questions: [] } } as any;

describe('computeProgress (§4.4 / AC-03)', () => {
  it('feedback disabled excludes feedback from N', async () => {
    const db = makeDb([{ promptId: 'p1' }, { promptId: 'p2' }], false);
    const p = await computeProgress(db, 's', feedbackOff);
    expect(p).toEqual({ completed: 2, total: 2, completed_prompt_ids: ['p1', 'p2'] });
  });

  it('feedback enabled adds the keystone to N', async () => {
    const db = makeDb([{ promptId: 'p1' }, { promptId: 'p2' }], false);
    const p = await computeProgress(db, 's', feedbackOn);
    expect(p?.completed).toBe(2);
    expect(p?.total).toBe(3);
  });

  it('duplicate prompt submissions do not double-count K', async () => {
    const db = makeDb([{ promptId: 'p1' }, { promptId: 'p2' }, { promptId: 'p1' }], false);
    const p = await computeProgress(db, 's', feedbackOff);
    expect(p?.completed).toBe(2);
    expect(p?.completed_prompt_ids).toEqual(['p1', 'p2']);
  });

  it('returns null when session is missing', async () => {
    const sessionless = {
      submission: { findMany: async () => [] },
      session: { findUnique: async () => null },
    } as any;
    expect(await computeProgress(sessionless, 'missing', feedbackOff)).toBeNull();
  });
});
