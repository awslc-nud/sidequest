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
 */
export default function IconTile({ icon: Icon }: IconTileProps) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-deep p-2">
      <Icon size={20} className="text-brand-white" aria-hidden="true" />
    </span>
  );
}
