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
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
}

export interface ProgressResult {
  completed: number;
  total: number;
  completed_prompt_ids: string[];
}

/**
 * Single source of truth for K/N. Called identically from /api/upload,
 * /api/feedback and /api/progress/:sid so the "chest unlocks exactly at K == N"
 * invariant can never be computed inconsistently across endpoints.
 *
 * `N` is the photo-quest count only: the feedback survey is a separate step and
 * does not contribute to progress (see `totalTaskCount`). `K` is the number of
 * distinct completed photo prompts.
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
      select: { id: true },
    }),
  ]);

  if (!session) return null;

  const completedPromptIds = [...new Set(submissions.map((s) => s.promptId))];
  return {
    completed: completedPromptIds.length,
    total: totalTaskCount(cfg),
    completed_prompt_ids: completedPromptIds,
  };
}
