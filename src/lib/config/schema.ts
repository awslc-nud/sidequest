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

const FeedbackQuestionInputSchema = z.object({
  /** Optional — auto-assigned `q1`, `q2`, … by position when omitted. */
  id: z.string().min(1).optional(),
  type: z.enum(['rating_1_4', 'text', 'boolean']),
  label: z.string(),
  /** Placeholder ("ghost text") for text inputs; defaults client-side. */
  placeholder: z.string().optional(),
  /** Alias for `placeholder`. */
  ghost_text: z.string().optional(),
});

/** A logical group of questions (a "section" / container). */
const FeedbackSectionInputSchema = z.object({
  /** Optional — auto-assigned `s1`, `s2`, … by position when omitted. */
  id: z.string().min(1).optional(),
  /** Optional heading shown above the group. */
  title: z.string().optional(),
  /** Optional supporting line under the heading. */
  description: z.string().optional(),
  questions: z.array(FeedbackQuestionInputSchema).default([]),
});

const FeedbackKeystoneInputSchema = z.object({
  enabled: z.boolean(),
  /** Preferred: logical groups of questions. */
  sections: z.array(FeedbackSectionInputSchema).optional(),
  /** Legacy flat list — normalized into one untitled section. */
  questions: z.array(FeedbackQuestionInputSchema).optional(),
});

/**
 * Normalizes the survey into sections. Accepts either `sections` (preferred) or
 * a flat `questions` list (wrapped into a single untitled section); if both are
 * present, flat questions become an extra untitled section rather than being
 * dropped. Every section/question gets an id even when omitted (`s1`, `q1`, … by
 * position; explicit ids win and duplicates are de-duplicated). Ids key stored
 * answers, so set them explicitly if you plan to reorder after responses exist.
 *
 * `questions` is also exposed flattened for validation/CSV/back-compat.
 */
export const FeedbackKeystoneSchema = FeedbackKeystoneInputSchema.transform((fk) => {
  const rawSections: z.infer<typeof FeedbackSectionInputSchema>[] = [];
  if (fk.sections?.length) rawSections.push(...fk.sections);
  if (fk.questions?.length) rawSections.push({ questions: fk.questions });

  const seenSections = new Set<string>();
  const seenQuestions = new Set<string>();
  let questionIndex = 0;

  const sections = rawSections.map((section, i) => {
    const sectionBase = (section.id ?? '').trim() || `s${i + 1}`;
    let sectionId = sectionBase;
    for (let n = 2; seenSections.has(sectionId); n += 1) sectionId = `${sectionBase}_${n}`;
    seenSections.add(sectionId);

    const questions = section.questions.map((q) => {
      questionIndex += 1;
      const base = (q.id ?? '').trim() || `q${questionIndex}`;
      let id = base;
      for (let n = 2; seenQuestions.has(id); n += 1) id = `${base}_${n}`;
      seenQuestions.add(id);
      return {
        id,
        type: q.type,
        label: q.label,
        placeholder: q.placeholder ?? q.ghost_text,
      };
    });

    return { id: sectionId, title: section.title, description: section.description, questions };
  });

  return { enabled: fk.enabled, sections, questions: sections.flatMap((s) => s.questions) };
});

export const EventConfigSchema = z.object({
  event_name: z.string().min(1),
  event_slug: z.string().regex(/^[a-z0-9-]+$/),
  /** Optional header line shown under the event name, e.g. "Aug 29, 2026". */
  event_date: z.string().min(1).optional(),
  /** Optional header line shown under the event name, e.g. "Main Campus". */
  event_venue: z.string().min(1).optional(),
  allowed_email_domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i),
  feedback_keystone: FeedbackKeystoneSchema,
  loot: z.array(LootItemSchema).min(1),
  quests: z.array(QuestSchema).min(1),
});

export type EventConfig = z.infer<typeof EventConfigSchema>;
export type Quest = z.infer<typeof QuestSchema>;
export type LootItem = z.infer<typeof LootItemSchema>;
export type FeedbackQuestion = z.infer<typeof FeedbackKeystoneSchema>['questions'][number];
export type FeedbackSection = z.infer<typeof FeedbackKeystoneSchema>['sections'][number];

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
