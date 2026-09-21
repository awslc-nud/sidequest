import type { QuestStatus } from '../../client/types';

/**
 * UI types for the mission tracker (`ui-spec.md` §5), now driven by the server
 * config/progress API rather than seeded mockup data.
 */

/** Icon key for a mission's `IconTile`. */
export type MissionIcon = 'camera' | 'users';

export interface Mission {
  id: string;
  title: string;
  description: string;
  icon: MissionIcon;
  /** Server/local completion state: todo | pending_sync | failed | done. */
  status: QuestStatus;
}
