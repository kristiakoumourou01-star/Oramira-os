import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { JOBS } from '@/lib/automations';
import { RunJobButton } from '@/components/automation/RunJobButton';
import { Workflow, CheckCircle2, XCircle, Clock } from 'lucide-react';

const STATUS_CLASS: Record<string, string> = {
  success: 'badge-forest',
  failed: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge',
  partial: 'badge-champagne',
};

export default async function AutomationCenterPage() {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: runs } = await supabase
    .from('automation_runs')
    .select('id, job, status, processed, summary, error, triggered_by, started_at')
    .order('started_at', { ascending: false })
    .limit(60);

  // Last run per job for the cards.
  type Run = NonNullable<typeof runs>[number];
  const lastByJob = new Map<string, Run>();
  for (const r of runs ?? []) if (!lastByJob.has(r.job)) lastByJob.set(r.job, r);

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-1">Operations</p>
        <h1 className="text-3xl">Automation Center</h1>
        <p className="mt-1 text-sm text-charcoal-600/70">The engine that keeps Oramira OS moving — reservations, warranties, payments, maintenance, CRM, and website sync.</p>
      </div>

      {/* Job cards */}
      <div className="grid grid-cols-2 gap-4">
        {JOBS.map((job) => {
          const last = lastByJob.get(job.key);
          return (
            <div key={job.key} className="panel p-5">
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Workflow size={16} className="text-olive" strokeWidth={1.75} />
                  <h4>{job.label}</h4>
                </div>
                <span className="badge-neutral">{job.schedule}</span>
              </div>
              <p className="mb-4 text-sm text-charcoal-600/75">{job.description}</p>
              <div className="flex items-center justify-between border-t border-stone-line pt-3">
                <div className="flex items-center gap-2 text-xs text-charcoal-600/70">
                  {last ? (
                    <>
                      {last.status === 'success' ? <CheckCircle2 size={13} className="text-signal-success" strokeWidth={1.75} /> : last.status === 'failed' ? <XCircle size={13} className="text-signal-danger" strokeWidth={1.75} /> : <Clock size={13} strokeWidth={1.75} />}
                      <span>Last run {new Date(last.started_at).toLocaleString()}</span>
                    </>
                  ) : (
                    <span>Never run</span>
                  )}
                </div>
                <RunJobButton jobKey={job.key} />
              </div>
            </div>
          );
        })}
      </div>

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
                  <td className="figure text-charcoal-600/70">{new Date(r.started_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
