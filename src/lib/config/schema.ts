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
});

export const FeedbackQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['rating_1_5', 'text', 'boolean']),
  label: z.string(),
});

export const EventConfigSchema = z.object({
  event_name: z.string().min(1),
  event_slug: z.string().regex(/^[a-z0-9-]+$/),
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
 * `N = quests.length + (feedback_keystone.enabled ? 1 : 0)`
 * Always computed fresh from the loaded config, never stored (§2.3/§4.4).
 */
export function totalTaskCount(cfg: EventConfig): number {
  return cfg.quests.length + (cfg.feedback_keystone.enabled ? 1 : 0);
}
