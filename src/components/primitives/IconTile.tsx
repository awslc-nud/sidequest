import type { LucideIcon } from 'lucide-react';

interface IconTileProps {
  /** Lucide icon component to render (e.g. `Camera`, `Users`). */
  icon: LucideIcon;
}

/**
 * Dark rounded tile holding a mission's icon (`ui-spec.md` §3).
 *
 * A fixed square footprint is enforced so tiles align across rows regardless of
 * the icon passed in — Lucide icons share a square viewBox, so `size={20}` never
 * changes the tile dimensions. The icon is decorative (`aria-hidden`); the
 * mission title carries the meaning.
 *
 * A subtle top-lit gradient and inner highlight give the tile a soft raised
 * look so the rows don't read flat.
 */
export default function IconTile({ icon: Icon }: IconTileProps) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-deep to-brand-deep/85 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
      <Icon size={20} className="text-brand-white" aria-hidden="true" />
    </span>
  );
}
