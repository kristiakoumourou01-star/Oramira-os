import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Star, CheckCircle2, Timer, RefreshCcw } from 'lucide-react';
import type { ContractorJob } from '@/types/database.types';

const COMPLETED = ['resolved', 'closed'];

export default async function ContractorPerformancePage() {
  await requireRole(['contractor', 'admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const [{ data: jobs }, { data: rating }] = await Promise.all([
    supabase.rpc('contractor_jobs'),
    supabase.rpc('contractor_avg_rating'),
  ]);

  const all: ContractorJob[] = jobs ?? [];
  const completed = all.filter((j) => COMPLETED.includes(j.status));

  // Average resolution time (created → resolved) across completed jobs.
  const durations = completed
    .filter((j) => j.resolved_at)
    .map((j) => new Date(j.resolved_at as string).getTime() - new Date(j.created_at).getTime());
  const avgMs = durations.length > 0 ? durations.reduce((s, d) => s + d, 0) / durations.length : null;
  const avgDays = avgMs != null ? (avgMs / (24 * 60 * 60 * 1000)).toFixed(1) : null;

  // Issue recurrence: properties (units) that have generated more than one job.
  const perUnit = new Map<string, number>();
  for (const j of all) perUnit.set(j.unit_id, (perUnit.get(j.unit_id) ?? 0) + 1);
  const recurringUnits = Array.from(perUnit.values()).filter((n) => n > 1).length;

  // Category breakdown.
  const perCategory = new Map<string, number>();
  for (const j of all) {
    const c = j.category ?? 'other';
    perCategory.set(c, (perCategory.get(c) ?? 0) + 1);
  }
  const categories = Array.from(perCategory.entries()).sort((a, b) => b[1] - a[1]);

  const stats = [
    { label: 'Jobs completed', value: String(completed.length), icon: CheckCircle2 },
    { label: 'Avg. resolution', value: avgDays != null ? `${avgDays}d` : '—', icon: Timer },
    { label: 'Average rating', value: rating != null ? `${Number(rating).toFixed(1)}★` : 'No ratings', icon: Star },
    { label: 'Recurring properties', value: String(recurringUnits), icon: RefreshCcw },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Your track record</p>
        <h1 className="font-display text-3xl">Performance</h1>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="panel p-6">
            <s.icon size={18} className="mb-3 text-champagne-600" strokeWidth={1.75} />
            <p className="figure text-3xl text-forest">{s.value}</p>
            <p className="mt-1 text-xs text-charcoal-600/70">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="panel p-6">
          <h4 className="mb-4">Work by category</h4>
          {categories.length === 0 ? (
            <p className="text-sm text-charcoal-600/70">No jobs recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {categories.map(([cat, count]) => {
                const pct = all.length > 0 ? Math.round((count / all.length) * 100) : 0;
                return (
                  <li key={cat}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="capitalize text-charcoal">{cat}</span>
                      <span className="figure text-charcoal-600/70">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-sand-100"><div className="h-full rounded-full bg-forest" style={{ width: `${pct}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="panel p-6">
          <h4 className="mb-2">Issue recurrence</h4>
          <p className="mb-4 text-xs text-charcoal-600/60">Properties that have needed more than one visit — useful for spotting recurring faults.</p>
          {recurringUnits === 0 ? (
            <p className="text-sm text-charcoal-600/70">No recurring properties — every home has needed you only once.</p>
          ) : (
            <p className="text-sm text-charcoal-600/80">
              <span className="figure text-2xl text-forest">{recurringUnits}</span> propert{recurringUnits === 1 ? 'y has' : 'ies have'} generated repeat jobs out of{' '}
              <span className="figure">{perUnit.size}</span> total.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
