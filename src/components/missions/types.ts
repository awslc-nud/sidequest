/**
 * UI types for the mission tracker (`ui-spec.md` §5).
 *
 * Kept separate from `src/client/types.ts` (which mirrors the server API) since
 * this shape is derived from the seeded mockup data, not an API response.
 */

/** Icon key for a mission's `IconTile`. */
export type MissionIcon = 'camera' | 'users';

export interface Mission {
  id: string;
  title: string;
  description: string;
  icon: MissionIcon;
  completed: boolean;
}
