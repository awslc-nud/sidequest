import type { APIRoute } from 'astro';
import { getEventConfig, ConfigError } from '../../lib/config/loadEventConfig';
import { getTerms } from '../../lib/config/loadTerms';
import { totalTaskCount } from '../../lib/config/schema';
import { apiError, json } from '../../lib/api/http';

/**
 * GET /api/config — public event config subset for the attendee UI (§3.1).
 * Never exposes secrets (no MARSHAL_SECRET_KEY, no internal fields).
 */
export const GET: APIRoute = () => {
  try {
    const cfg = getEventConfig();
    return json({
      event_name: cfg.event_name,
      event_slug: cfg.event_slug,
      event_date: cfg.event_date ?? null,
      event_venue: cfg.event_venue ?? null,
      allowed_email_domain: cfg.allowed_email_domain,
      quests: cfg.quests.map((q) => ({ id: q.id, title: q.title, description: q.description })),
      feedback_keystone: {
        enabled: cfg.feedback_keystone.enabled,
        sections: cfg.feedback_keystone.sections.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          questions: s.questions.map((q) => ({
            id: q.id,
            type: q.type,
            label: q.label,
            placeholder: q.placeholder,
          })),
        })),
        questions: cfg.feedback_keystone.questions.map((q) => ({
          id: q.id,
          type: q.type,
          label: q.label,
          placeholder: q.placeholder,
        })),
      },
      terms: getTerms(),
      total_tasks: totalTaskCount(cfg),
    });
  } catch (e) {
    const message = e instanceof ConfigError ? e.message : 'Unknown config failure';
    return apiError('CONFIG_LOAD_FAILED', message, 500);
  }
};
