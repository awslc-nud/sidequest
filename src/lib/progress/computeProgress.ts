import type { EventConfig } from '../config/schema';
import { totalTaskCount } from '../config/schema';

/** Minimal DB surface so this also works inside `prisma.$transaction` (a tx has the same delegates). */
export interface ProgressDb {
  submission: {
    findMany(args: { where: { sessionId: string }; select: { promptId: true } }): Promise<{ promptId: string }[]>;
  };
  session: {
    findUnique(args: {
      where: { id: string };
      select: { feedbackDone: true };
    }): Promise<{ feedbackDone: boolean } | null>;
  };
}

export interface ProgressResult {
  completed: number;
  total: number;
  completed_prompt_ids: string[];
}

/**
 * Single source of truth for K/N (§4.4). Called identically from
 * /api/upload, /api/feedback and /api/progress/:sid so the
 * "chest unlocks exactly at K == N" invariant can never be computed
 * inconsistently across endpoints.
 *
 * `completed_prompt_ids` is de-duplicated defensively: the DB unique
 * constraint already prevents a second row per (session, prompt), but counting
 * unique prompts keeps K correct even against a hand-seeded fixture.
 */
export async function computeProgress(db: ProgressDb, sessionId: string, cfg: EventConfig): Promise<ProgressResult | null> {
  const [submissions, session] = await Promise.all([
    db.submission.findMany({
      where: { sessionId },
      select: { promptId: true },
    }),
    db.session.findUnique({
      where: { id: sessionId },
      select: { feedbackDone: true },
    }),
  ]);

  if (!session) return null;

  const completedPromptIds = [...new Set(submissions.map((s) => s.promptId))];
  const feedbackCount = session.feedbackDone ? 1 : 0;
  return {
    completed: completedPromptIds.length + feedbackCount,
    total: totalTaskCount(cfg),
    completed_prompt_ids: completedPromptIds,
  };
}
