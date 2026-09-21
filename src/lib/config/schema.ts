import { z } from 'zod';

export const QuestSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  title: z.string().min(1),
  description: z.string().min(1),
});

export const LootItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string().min(1),
  qty: z.number().int().positive(),
  /** Optional prize artwork (e.g. `/assets/prize.png`) shown on `/reward`. */
  image: z.string().min(1).optional(),
});

export const FeedbackQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['rating_1_5', 'text', 'boolean']),
  label: z.string(),
});

export const EventConfigSchema = z.object({
  event_name: z.string().min(1),
  event_slug: z.string().regex(/^[a-z0-9-]+$/),
  /** Optional header line shown under the event name, e.g. "Aug 29, 2026". */
  event_date: z.string().min(1).optional(),
  /** Optional header line shown under the event name, e.g. "Main Campus". */
  event_venue: z.string().min(1).optional(),
  allowed_email_domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i),
  feedback_keystone: z.object({
    enabled: z.boolean(),
    questions: z.array(FeedbackQuestionSchema),
  }),
  loot: z.array(LootItemSchema).min(1),
  quests: z.array(QuestSchema).min(1),
});

export type EventConfig = z.infer<typeof EventConfigSchema>;
export type Quest = z.infer<typeof QuestSchema>;
export type LootItem = z.infer<typeof LootItemSchema>;
export type FeedbackQuestion = z.infer<typeof FeedbackQuestionSchema>;

/**
 * Derived value — Total Task Count (N):
 * `N = quests.length`
 *
 * The feedback survey is a **separate post-quest step** and intentionally does
 * not count towards the progress bar or the chest unlock (product decision — see
 * `docs/ui-build.md` #29). Always computed fresh from the loaded config, never
 * stored.
 */
export function totalTaskCount(cfg: EventConfig): number {
  return cfg.quests.length;
}
