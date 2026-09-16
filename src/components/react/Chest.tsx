import { useEffect, useState } from 'react';
import { Gift, Lock } from 'lucide-react';

export type ChestState = 'locked' | 'unlocked' | 'burst';

interface Props {
  state: ChestState;
}

/** Chest visual. When the chest unlocks, a short burst plays, then it rests open. */
export default function Chest({ state }: Props) {
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (state === 'burst') {
      setBurst(true);
      const t = setTimeout(() => setBurst(false), 1800);
      return () => clearTimeout(t);
    }
  }, [state]);

  const open = state === 'unlocked' || burst;
  const cn = burst ? 'animate-[chest-burst_0.6s_ease-out]' : open ? 'animate-[chest-spring_0.5s_ease-out]' : '';
  return (
    <div
      aria-live="polite"
      className="relative flex aspect-[4/3] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60"
    >
      <Gift className={cn ? `${cn} h-20 w-20 text-amber-300/90` : 'h-20 w-20 text-amber-300/60'} />
      {!open && <Lock className="absolute right-6 top-6 h-5 w-5 text-zinc-500" aria-label="Locked chest" />}
    </div>
  );
}
