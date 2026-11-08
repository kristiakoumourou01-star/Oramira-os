import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ShieldCheck, Workflow } from 'lucide-react';
import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildCommandCenter } from '@/lib/command-center';
import { buildOperationsHealth, type OpsSignal } from '@/lib/operations-health';
import { CommandCenterBoard } from '@/components/dashboard/CommandCenterBoard';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

const TONE: Record<OpsSignal['severity'], { ring: string; num: string; dot: string }> = {
  ok: { ring: 'border-stone-line', num: 'text-forest', dot: 'bg-signal-success' },
  warn: { ring: 'border-champagne/40', num: 'text-champagne-600', dot: 'bg-champagne-500 ws-pulse-urgent' },
  risk: { ring: 'border-signal-danger/30', num: 'text-signal-danger', dot: 'bg-signal-danger ws-pulse-danger' },
};

/**
 * Command Center — ένα σημείο για «τι κολλάει και τι χρειάζεται προσοχή»:
 * η λειτουργική υγεία (πρώην Operations) + το Executive board (προτεραιότητες,
 * κίνδυνοι, cashflow, bottlenecks). Οι εκτελέσεις αυτοματισμών είναι στο Automation Center.
 */
export default async function CommandCenterPage() {
  const profile = await requireProfile();
  const leadership = profile.role === 'admin' || profile.role === 'management';
  const ops = leadership || effectiveCan(profile.role, profile.moduleAccess, 'operations', 'view', profile.permissions);
  if (!ops) redirect('/dashboard');
  const supabase = await createSupabaseServerClient();
  const [health, data] = await Promise.all([buildOperationsHealth(supabase), leadership ? buildCommandCenter(supabase) : Promise.resolve(null)]);
  const attention = health.filter((s) => s.severity !== 'ok').length;

  return (
    <div className="space-y-5">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-charcoal-600/70 hover:text-forest"><ArrowLeft size={15} /> Dashboard</Link>
      <WorkspaceHeader eyebrow="Executive" title="Command Center"
        description={attention > 0 ? `${attention} σημεία χρειάζονται προσοχή · προτεραιότητες, κίνδυνοι, cashflow και bottlenecks.` : 'Όλα κυλούν — τίποτα δεν έχει κολλήσει.'}
        action={<Link href="/automation" className="btn-secondary text-sm"><Workflow size={14} strokeWidth={1.75} /> Automation Center</Link>} />

      <section>
        <p className="eyebrow mb-2">Λειτουργική υγεία</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {health.map((s) => { const t = TONE[s.severity]; return (
            <Link key={s.key} href={s.href} className={`group panel flex flex-col gap-2 border ${t.ring} p-4 transition-shadow hover:shadow-overlay`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/55"><span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /> {s.label}</span>
                <ArrowUpRight size={13} className="text-charcoal-600/30 transition-colors group-hover:text-forest" />
              </div>
              <span className={`figure text-[30px] leading-none ${t.num}`}>{s.count}</span>
              <span className="text-[12px] text-charcoal-600/70">{s.insight}</span>
            </Link>
          ); })}
          {attention === 0 && <div className="panel flex items-center gap-3 border border-stone-line p-4 text-sm text-charcoal-600/70"><ShieldCheck size={18} className="text-signal-success" strokeWidth={1.75} /> Operations running clean.</div>}
        </div>
      </section>

      {data && <CommandCenterBoard data={data} />}
    </div>
  );
}
