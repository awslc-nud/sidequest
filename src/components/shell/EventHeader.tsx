interface EventHeaderProps {
  /** Event name, e.g. "TechFair 2025". */
  title: string;
  /** Optional date + venue line, e.g. "Aug 28 - 29, 2025 • Main Campus". */
  subtitle?: string;
}

/**
 * Centered event title block above the mascot hero (`ui-spec.md` §2).
 *
 * Tailwind preflight strips default heading styles, so the title's size and
 * weight are set explicitly. The subtitle is optional — the public config only
 * carries date/venue when the event defines them.
 */
export default function EventHeader({ title, subtitle }: EventHeaderProps) {
  return (
    <header className="relative z-10 pt-8 pb-2 text-center">
      <h1 className="text-2xl font-bold text-brand-ink">{title}</h1>
      {subtitle && <p className="text-sm text-brand-muted">{subtitle}</p>}
    </header>
  );
}
