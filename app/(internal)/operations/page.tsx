import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Workflow, ArrowRight, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { buildOperationsHealth, type OpsSignal } from '@/lib/operations-health';
import { formatDateTime } from '@/lib/format';

/**
 * Operations workspace — the operational health monitor. Instead of duplicating
 * the dashboard task list, it answers "where is work stuck or at risk across the
 * business?" with a deterministic signal board (leads, follow-ups, tasks,
 * approvals, contracts, maintenance, automations) + recent automation runs.
 */

const TONE: Record<OpsSignal['severity'], { ring: string; num: string; dot: string }> = {
  ok: { ring: 'border-stone-line', num: 'text-forest', dot: 'bg-signal-success' },
  warn: { ring: 'border-champagne/40', num: 'text-champagne-600', dot: 'bg-champagne-500 ws-pulse-urgent' },
  risk: { ring: 'border-signal-danger/30', num: 'text-signal-danger', dot: 'bg-signal-danger ws-pulse-danger' },
};

function SignalCard({ s }: { s: OpsSignal }) {
  const t = TONE[s.severity];
  return (
    <Link href={s.href} className={`group panel flex flex-col gap-2 border ${t.ring} p-4 transition-shadow hover:shadow-overlay`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/55"><span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /> {s.label}</span>
        <ArrowUpRight size={13} className="text-charcoal-600/30 transition-colors group-hover:text-forest" />
      </div>
      <span className={`figure text-[30px] leading-none ${t.num}`}>{s.count}</span>
      <span className="text-[12px] text-charcoal-600/70">{s.insight}</span>
    </Link>
  );
}

export default async function OperationsPage() {
  await requirePermission('operations');
  const supabase = await createSupabaseServerClient();

  const [health, { data: jobs }] = await Promise.all([
    buildOperationsHealth(supabase),
    supabase.from('automation_runs').select('id, job, status, summary, started_at').order('started_at', { ascending: false }).limit(6),
  ]);

  const needsAttention = health.filter((s) => s.severity !== 'ok').length;

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        eyebrow="Workspace"
        title="Operations"
        description={needsAttention > 0 ? `${needsAttention} area${needsAttention > 1 ? 's need' : ' needs'} attention across the business.` : 'All operational areas are healthy — nothing is stuck.'}
        action={<Link href="/automation" className="btn-secondary text-sm"><Workflow size={14} strokeWidth={1.75} /> Automation Center</Link>}
      />

      {/* Operational health — where work is stuck or at risk */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {health.map((s) => <SignalCard key={s.key} s={s} />)}
        {needsAttention === 0 && (
          <div className="panel flex items-center gap-3 border border-stone-line p-4 text-sm text-charcoal-600/70">
            <ShieldCheck size={18} className="text-signal-success" strokeWidth={1.75} /> Operations running clean.
          </div>
        )}
      </div>

      {/* Recent automation runs */}
      <div className="panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="flex items-center gap-2"><Workflow size={15} className="text-olive" strokeWidth={1.75} /> Recent automation runs</h4>
          <Link href="/automation" className="inline-flex items-center gap-1 text-sm text-forest hover:underline">Automation Center <ArrowRight size={13} /></Link>
        </div>
        {(jobs ?? []).length === 0 ? (
          <p className="text-sm text-charcoal-600/70">No automation runs recorded yet — jobs will report here as they run.</p>
        ) : (
          <ul className="divide-y divide-stone-line">
            {(jobs ?? []).map((j: any) => (
              <li key={j.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="text-charcoal">{j.summary ?? j.job}</p>
                  <p className="text-xs text-charcoal-600/50">{j.job} · {formatDateTime(j.started_at)}</p>
                </div>
                <span className={j.status === 'success' ? 'badge-forest' : 'badge-neutral'}>{j.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
