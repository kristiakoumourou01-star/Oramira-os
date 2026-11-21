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
      <WorkspaceHeader eyebrow="Διοίκηση" title="Command Center"
        description={attention > 0 ? `${attention} σημεία χρειάζονται προσοχή · προτεραιότητες, κίνδυνοι, cashflow και bottlenecks.` : 'Όλα κυλούν, τίποτα δεν έχει κολλήσει.'}
        action={<Link href="/automation" className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-3 text-[14px] text-charcoal hover:border-forest/30"><Workflow size={14} strokeWidth={1.75} /> Αυτοματισμοί</Link>} />

      <section>
        <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-charcoal-600">Λειτουργική υγεία</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {health.map((s) => { const t = TONE[s.severity]; return (
            <Link key={s.key} href={s.href} className={`group flex flex-col gap-2 rounded-[14px] border bg-white p-4 shadow-sm transition-colors duration-150 hover:border-forest/40 ${t.ring}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/55"><span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /> {s.label}</span>
                <ArrowUpRight size={13} className="text-charcoal-600/30 transition-colors group-hover:text-forest" />
              </div>
              <span className={`text-[28px] font-semibold leading-none tabular-nums ${t.num}`}>{s.count}</span>
              <span className="text-[13px] text-charcoal-600">{s.insight}</span>
            </Link>
          ); })}
          {attention === 0 && <div className="flex items-center gap-3 rounded-[14px] border border-stone-line bg-white p-4 text-sm text-charcoal-600 shadow-sm"><ShieldCheck size={18} className="text-forest" strokeWidth={1.75} /> Όλα λειτουργούν κανονικά.</div>}
        </div>
      </section>

      {data && <CommandCenterBoard data={data} />}
    </div>
  );
}
