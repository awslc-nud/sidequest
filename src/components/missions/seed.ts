import type { Mission } from './types';

/**
 * Seed missions matching the mockup (`ui-spec.md` §5).
 *
 * Initial state is 2 completed / 3 incomplete, which yields the mockup's
 * "2 / 5 completed" progress. Ids follow the `prompt_N_name` convention from
 * `spec.md` so they can later be reconciled with server quest ids.
 */
export const SEED_MISSIONS: Mission[] = [
  {
    id: 'prompt_1_arrival',
    title: 'Arrival Moment',
    description: 'Take a photo of yourself at the event venue!',
    icon: 'camera',
    completed: true,
  },
  {
    id: 'prompt_2_stage',
    title: 'Stage Slide',
    description: 'Capture a photo of a slide from the main stage.',
    icon: 'camera',
    completed: true,
  },
  {
    id: 'prompt_3_friend',
    title: 'New Friend',
    description: 'Snap a photo with someone new today!',
    icon: 'users',
    completed: false,
  },
  {
    id: 'prompt_4_merch',
    title: 'Event Merch',
    description: 'Take a photo of the event merchandise!',
    icon: 'camera',
    completed: false,
  },
  {
    id: 'prompt_5_crowd',
    title: 'Crowd Reaction',
    description: 'Capture the energy of the crowd!',
    icon: 'camera',
    completed: false,
  },
];
