/** Wire types matching the API contracts in spec §3. */

export interface PublicConfig {
  event_name: string;
  event_slug: string;
  /** Optional header lines rendered under the event name. */
  event_date: string | null;
  event_venue: string | null;
  allowed_email_domain: string;
  quests: Array<{ id: string; title: string; description: string }>;
  feedback_keystone: { enabled: boolean; questions: Array<{ id: string; type: 'rating_1_5' | 'text' | 'boolean'; label: string }> };
  total_tasks: number;
}

export interface ProgressResponse {
  session_id: string;
  completed_prompt_ids: string[];
  feedback_done: boolean;
  completed: number;
  total: number;
  chest_unlocked: boolean;
  unlocked_at: number | null;
  claim: {
    claim_token: string;
    short_code: string;
    is_claimed: boolean;
    claimed_at: number | null;
  } | null;
}

export interface ClaimResponse {
  claim_token: string;
  short_code: string;
  student_email: string;
  loot: Array<{ id: string; label: string; qty: number }>;
}

export type QuestStatus = 'todo' | 'pending_sync' | 'failed' | 'done';

export const CONFIG_ERRORS = new Set(['CONFIG_LOAD_FAILED']);
