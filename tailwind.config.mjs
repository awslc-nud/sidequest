/**
 * Tailwind CSS configuration — TechFair Mission Tracker.
 *
 * Tailwind v4 (`@tailwindcss/vite`) is CSS-first and no longer auto-discovers a
 * JavaScript config, so this file is loaded explicitly from
 * `src/styles/global.css` via the `@config` directive.
 *
 * `theme.extend.colors` (rather than `theme.colors`) is used so the full default
 * palette is preserved and only the mission-tracker roles below are pinned. The
 * values mirror Tailwind's own v4 tokens so there is no visual drift; keeping
 * them named here makes the palette a single, reviewable source of truth for
 * `ui-spec.md` §1.1.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  theme: {
    extend: {
      /**
       * Top-panel radius. The default scale caps at `rounded-3xl` (1.5rem), while
       * `ui-spec.md` §1.2 / the layout skeleton call for a 2.5rem top panel
       * (`rounded-t-panel`), which visually tucks under the hero zone.
       */
      borderRadius: {
        panel: '2.5rem',
      },
      /**
       * Rapid vibration applied to the closed chest for 500ms when a non-final
       * mission is completed (`ui-spec.md` §6). Mirrors the spec's keyframe:
       * ±2px translate / ±3° rotate on alternating quarter-frames.
       */
      keyframes: {
        'chest-shake': {
          '0%, 100%': { transform: 'translateX(0) rotate(0)' },
          '25%': { transform: 'translateX(-2px) rotate(-3deg)' },
          '75%': { transform: 'translateX(2px) rotate(3deg)' },
        },
      },
      animation: {
        'chest-shake': 'chest-shake 0.5s ease-in-out',
      },
      colors: {
        teal: {
          /** Progress track (unfilled) — `ui-spec.md` §1.1. */
          100: 'oklch(95.3% 0.051 180.801)',
          /** Primary accent — active tab pill and primary actions. */
          800: 'oklch(43.7% 0.078 188.216)',
        },
        emerald: {
          /** Progress fill / success state. */
          500: 'oklch(69.6% 0.17 162.48)',
        },
        slate: {
          /** Muted text — mission descriptions. */
          400: 'oklch(70.4% 0.04 256.788)',
          /** Muted text — header subtext and progress label. */
          500: 'oklch(55.4% 0.046 257.417)',
          /** Heading / mission title text. */
          800: 'oklch(27.9% 0.041 260.031)',
        },
      },
    },
  },
};
