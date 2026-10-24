/**
 * Generic workspace skeleton shown by route-level loading.tsx files while a
 * Server Component fetches. Mirrors the standard page shape (header · tabs ·
 * KPI row · content) so navigation feels instant instead of blank.
 */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      {/* header */}
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-[#E3DAC9]/70" />
        <div className="h-7 w-52 rounded-lg bg-[#E3DAC9]/80" />
      </div>
      {/* tab bar */}
      <div className="flex gap-2 border-b border-stone-line pb-1">
        {[64, 80, 72, 88, 60].map((w, i) => <div key={i} className="h-5 rounded bg-[#E9E1D2]/80" style={{ width: w }} />)}
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-white shadow-[0_1px_2px_rgba(31,77,58,0.04),0_8px_20px_rgba(31,77,58,0.05)] ring-1 ring-stone-line/40" />
        ))}
      </div>
      {/* content blocks */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-72 rounded-2xl bg-white shadow-[0_1px_2px_rgba(31,77,58,0.04),0_8px_20px_rgba(31,77,58,0.05)] ring-1 ring-stone-line/40 lg:col-span-2" />
        <div className="h-72 rounded-2xl bg-white shadow-[0_1px_2px_rgba(31,77,58,0.04),0_8px_20px_rgba(31,77,58,0.05)] ring-1 ring-stone-line/40" />
      </div>
    </div>
  );
}
