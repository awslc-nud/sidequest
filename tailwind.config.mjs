import { colors, radius } from './src/styles/tokens';

/**
 * Tailwind CSS configuration — TechFair Mission Tracker.
 *
 * Tailwind v4 (`@tailwindcss/vite`) is CSS-first and no longer auto-discovers a
 * JavaScript config, so this file is loaded explicitly from
 * `src/styles/global.css` via the `@config` directive.
 *
 * `theme.extend.colors` (rather than `theme.colors`) preserves the full default
 * palette and only pins the mission-tracker roles. Raw values live in
 * `src/styles/tokens.ts` and are imported here so utilities and runtime JS share
 * one source of truth (Tailwind loads this file through `jiti`, which resolves
 * the TS import).
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  theme: {
    extend: {
      borderRadius: {
        /**
         * Top-panel radius. The default scale caps at `rounded-3xl` (1.5rem),
         * while `ui-spec.md` §1.2 / the layout skeleton call for a 2.5rem top
         * panel (`rounded-t-panel`) that tucks under the hero zone.
         */
        panel: radius.panel,
      },
      /**
       * Rapid vibration applied to the closed chest for 500ms when a non-final
       * mission is completed (`ui-spec.md` §6). Mirrors the spec's keyframe
       * baseline (±2px translate / ±3° rotate), but the amplitude is driven by
       * `--chest-shake-x` / `--chest-shake-rot` so it can scale with progress
       * (the vars fall back to the spec values when unset).
       */
      keyframes: {
        'chest-shake': {
          '0%, 100%': { transform: 'translateX(0) rotate(0)' },
          '25%': {
            transform:
              'translateX(calc(-1 * var(--chest-shake-x, 2px))) rotate(calc(-1 * var(--chest-shake-rot, 3deg)))',
          },
          '75%': {
            transform: 'translateX(var(--chest-shake-x, 2px)) rotate(var(--chest-shake-rot, 3deg))',
          },
        },
        /**
         * Overshoot-then-settle scale for the permanent chest-open swap when all
         * missions are completed (`ui-spec.md` §6). Runs once for ~400ms.
         */
        'pop-in': {
          '0%': { transform: 'scale(0.7)' },
          '60%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'chest-shake': 'chest-shake 0.5s ease-in-out',
        'pop-in': 'pop-in 0.4s ease-out',
      },
      colors: {
        teal: {
          /** Progress track (unfilled) — `ui-spec.md` §1.1. */
          100: colors.progressTrack,
          /** Primary accent — active tab pill and primary actions. */
          800: colors.primary,
        },
        emerald: {
          /** Progress fill / success state. */
          500: colors.success,
        },
        slate: {
          /** Muted text — mission descriptions. */
          400: colors.subtle,
          /** Muted text — header subtext and progress label. */
          500: colors.muted,
          /** Heading / mission title text. */
          800: colors.heading,
        },
      },
    },
  },
};
