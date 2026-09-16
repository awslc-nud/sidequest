interface MascotChestHeroProps {
  /** True for ~500ms after a non-final mission is completed (ui-spec §6). */
  isShaking: boolean;
}

/**
 * Mascot + chest hero zone (`ui-spec.md` §2, §3 states).
 *
 * During the shake both mascot states are mounted and cross-faded via opacity
 * rather than swapping `src`, so the swap is flicker-free (both images load at
 * mount). The mascot bounces with a `translate` and the chest picks up the
 * `animate-chest-shake` keyframe; both revert when `isShaking` clears.
 *
 * The all-complete (chest-open / excited) state is added in the next task.
 *
 * Asset note: the repo ships `chest-locked.png`; `ui-spec.md` calls it
 * `chest-closed.png`, so the existing filename is used.
 */
export default function MascotChestHero({ isShaking }: MascotChestHeroProps) {
  return (
    <div className="relative z-10 flex h-40 items-center justify-center">
      <div
        className={`relative h-36 w-36 transition-transform duration-200 ease-out ${
          isShaking ? 'translate-y-1' : 'translate-y-0'
        }`}
      >
        <img
          src="/assets/mascot-idle.png"
          alt="Mission tracker mascot"
          aria-hidden={isShaking}
          className={`absolute inset-0 h-36 w-36 object-contain transition-opacity duration-150 ${
            isShaking ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <img
          src="/assets/mascot-surprised.png"
          alt="Mission tracker mascot"
          aria-hidden={!isShaking}
          className={`absolute inset-0 h-36 w-36 object-contain transition-opacity duration-150 ${
            isShaking ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
      <img
        src="/assets/chest-locked.png"
        alt="Reward chest"
        className={`absolute h-[90px] w-[110px] translate-y-4 object-contain ${
          isShaking ? 'animate-chest-shake' : ''
        }`}
      />
    </div>
  );
}
