import { describe, expect, it } from 'vitest';
import { computeProgress, type ProgressDb } from '../../src/lib/progress/computeProgress';

function makeDb(rows: Array<{ promptId: string }>, sessionExists = true): ProgressDb {
  return {
    submission: {
      findMany: async () => rows,
    } as any,
    session: {
      findUnique: async () => (sessionExists ? { id: 's' } : null),
    } as any,
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

describe('computeProgress (photo quests only)', () => {
  it('excludes the survey keystone from N even when feedback is enabled', async () => {
    const db = makeDb([{ promptId: 'p1' }, { promptId: 'p2' }]);
    const p = await computeProgress(db, 's', feedbackOn);
    expect(p).toEqual({ completed: 2, total: 2, completed_prompt_ids: ['p1', 'p2'] });
  });

  it('reports the same total when feedback is disabled', async () => {
    const db = makeDb([{ promptId: 'p1' }, { promptId: 'p2' }]);
    const p = await computeProgress(db, 's', feedbackOff);
    expect(p).toEqual({ completed: 2, total: 2, completed_prompt_ids: ['p1', 'p2'] });
  });

  it('does not count partial quest completion as the survey', async () => {
    const db = makeDb([{ promptId: 'p1' }]);
    const p = await computeProgress(db, 's', feedbackOn);
    expect(p?.completed).toBe(1);
    expect(p?.total).toBe(2);
  });

  it('duplicate prompt submissions do not double-count K', async () => {
    const db = makeDb([{ promptId: 'p1' }, { promptId: 'p2' }, { promptId: 'p1' }]);
    const p = await computeProgress(db, 's', feedbackOff);
    expect(p?.completed).toBe(2);
    expect(p?.completed_prompt_ids).toEqual(['p1', 'p2']);
  });

  it('returns null when session is missing', async () => {
    expect(await computeProgress(makeDb([], false), 'missing', feedbackOff)).toBeNull();
  });
});
