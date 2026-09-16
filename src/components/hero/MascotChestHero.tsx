/**
 * Mascot + chest hero zone (`ui-spec.md` §2).
 *
 * Layout only for now: the chest sits absolutely-positioned over the mascot's
 * arms and paints on top because it follows the mascot in DOM order. Animation
 * and state wiring (shake / pop-in / all-complete) land in Phase 4.
 *
 * Asset note: the repo ships `chest-locked.png`; `ui-spec.md` calls it
 * `chest-closed.png`. The existing filename is used rather than renaming assets.
 */
export default function MascotChestHero() {
  return (
    <div className="relative z-10 flex h-40 items-center justify-center">
      <img
        src="/assets/mascot-idle.png"
        alt="Mission tracker mascot"
        className="h-36 w-36 object-contain"
      />
      <img
        src="/assets/chest-locked.png"
        alt="Reward chest"
        className="absolute h-[90px] w-[110px] translate-y-4 object-contain"
      />
    </div>
  );
}
