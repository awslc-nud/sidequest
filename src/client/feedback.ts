/**
 * Emoji faces for the 1–4 survey rating, shared by the form and the results
 * view. The face is presentation only — answers are always submitted as the
 * numeric `value`.
 */
export const RATING_FACES = [
  { value: 1, emoji: '😞', label: 'Absolutely No' },
  { value: 2, emoji: '😕', label: 'Not Really' },
  { value: 3, emoji: '🙂', label: 'Somewhat Yes' },
  { value: 4, emoji: '😍', label: 'Absolutely Yes' },
] as const;
