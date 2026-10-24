import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { JOBS } from '@/lib/automations';
import { AutomationCategories, type AutomationGroup } from '@/components/automation/AutomationCategories';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { formatDateTime } from '@/lib/format';

const STATUS_CLASS: Record<string, string> = {
  success: 'badge-forest',
  failed: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge',
  partial: 'badge-champagne',
};

// Job → domain category. Every job maps to exactly one collapsible section.
const CATEGORY: Record<string, string> = {
  crm: 'Sales', speed_to_lead: 'Sales', sales_cadence: 'Sales', dead_lead_reactivation: 'Sales', viewing_reminders: 'Sales', meeting_reminders: 'Sales', churn_detection: 'Sales',
  acquisition_ops: 'Acquisitions', acquisition_cadence: 'Acquisitions',
  maintenance: 'Property', warranty_expiry: 'Property', reservation_expiry: 'Property', owner_lifecycle: 'Property',
  contract_reminders: 'HR',
  payment_reminders: 'Finance',
  task_orchestration: 'AI · Autonomous', self_healing: 'AI · Autonomous', learning_loop: 'AI · Autonomous', executive_memory: 'AI · Autonomous',
  website_sync: 'System', auto_calendar_events: 'System',
};
const ORDER = ['Sales', 'Acquisitions', 'Property', 'HR', 'Finance', 'AI · Autonomous', 'System'];

export default async function AutomationCenterPage() {
  await requirePermission('automation');
  const supabase = await createSupabaseServerClient();

  const { data: runs } = await supabase
    .from('automation_runs')
    .select('id, job, status, processed, summary, error, triggered_by, started_at')
    .order('started_at', { ascending: false })
    .limit(60);

  type Run = NonNullable<typeof runs>[number];
  const lastByJob = new Map<string, Run>();
  for (const r of runs ?? []) if (!lastByJob.has(r.job)) lastByJob.set(r.job, r);

  // Group jobs into categories (serialisable — the run() fn stays server-side).
  const groups: AutomationGroup[] = ORDER.map((category) => ({
    category,
    jobs: JOBS.filter((j) => (CATEGORY[j.key] ?? 'System') === category).map((j) => {
      const last = lastByJob.get(j.key);
      return { key: j.key, label: j.label, description: j.description, schedule: j.schedule, lastStatus: last?.status ?? null, lastAt: last?.started_at ?? null };
    }),
  })).filter((g) => g.jobs.length > 0);

  const failing = (runs ?? []).length ? [...lastByJob.values()].filter((r) => r.status === 'failed').length : 0;

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Operations" title="Automation Center" description={`${JOBS.length} automations across ${groups.length} domains${failing ? ` · ${failing} need attention` : ' · all healthy'}. Expand a category to run or inspect a job.`} />

      {/* Collapsible category sections */}
      <AutomationCategories groups={groups} />

      {/* Run history / audit log */}
      <div className="panel overflow-hidden">
        <div className="border-b border-stone-line px-6 py-4">
          <h4>Run history</h4>
        </div>
        {!runs || runs.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-charcoal-600/70">No automation runs recorded yet. Run a job above or wait for the next scheduled execution.</p>
        ) : (
          <table className="table-base w-full">
            <thead>
              <tr><th>Job</th><th>Status</th><th>Processed</th><th>Summary</th><th>Trigger</th><th>When</th></tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-stone/60">
                  <td className="font-medium text-charcoal">{JOBS.find((j) => j.key === r.job)?.label ?? r.job}</td>
                  <td><span className={STATUS_CLASS[r.status] ?? 'badge-neutral'}>{r.status}</span></td>
                  <td className="figure text-charcoal-600">{r.processed}</td>
                  <td className="text-charcoal-600/85">{r.error ? <span className="text-signal-danger">{r.error}</span> : r.summary}</td>
                  <td className="text-charcoal-600/70 capitalize">{r.triggered_by}</td>
                  <td className="figure text-charcoal-600/70">{formatDateTime(r.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
