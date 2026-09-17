/**
 * Loading placeholder matching `MissionRow`'s footprint (`ui-spec.md` §3).
 *
 * Same container padding/gap/radius/shadow and the same icon (40px) and status
 * (24px) block sizes, with text lines mirroring the title/description line
 * heights (24px / 20px) — so swapping in real rows causes no layout shift.
 */
export default function MissionRowSkeleton() {
  return (
    <li
      aria-hidden="true"
      className="flex animate-pulse items-center gap-3.5 rounded-2xl bg-white p-4 shadow-sm"
    >
      <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="h-6 w-1/2 rounded bg-slate-100" />
        <div className="h-5 w-3/4 rounded bg-slate-100" />
      </div>
      <div className="h-6 w-6 shrink-0 rounded-full bg-slate-100" />
    </li>
  );
}
