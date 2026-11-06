import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { getParcels, STAGE_LABEL } from '@/lib/acquisitions';
import { detectAssembly } from '@/lib/land-assembly';
import { Tabs, type TabDef } from '@/components/ui/Tabs';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { AcquisitionMap } from '@/components/acquisitions/AcquisitionMap';
import { AcquisitionBoard } from '@/components/acquisitions/AcquisitionBoard';
import { NewParcelForm } from '@/components/acquisitions/NewParcelForm';
import { AssemblyPanel } from '@/components/acquisitions/AssemblyPanel';
import { Users, Handshake, Gauge, HeartHandshake, Landmark, TrendingUp, Puzzle, PhoneCall, CalendarCheck, FileSignature, Phone, MessageCircle, Mail } from 'lucide-react';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';

const DAY = 86400000;
const BAND: Record<string, string> = { Prime: 'bg-forest text-white', Strong: 'bg-forest/12 text-forest', Moderate: 'bg-champagne-50 text-champagne-600', Weak: 'bg-sand-100 text-charcoal-600/70' };
const Panel = ({ children }: { children: React.ReactNode }) => <div className="panel p-6">{children}</div>;

export default async function AcquisitionsPage({ searchParams }: { searchParams: { tab?: string } }) {
  await requirePermission('acquisitions');
  const supabase = await createSupabaseServerClient();
  const now = Date.now();

  const [parcels, { data: agents }] = await Promise.all([
    getParcels(),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales', 'management']).order('full_name'),
  ]);

  const clusters = detectAssembly(parcels.map((p) => ({ id: p.id, reference: p.reference, areaRef: p.areaRef, plotSizeSqm: p.plotSizeSqm, stage: p.stage, ownerName: p.ownerName, score: p.score.score, marginAbs: p.uplift?.marginAbs ?? 0 })));

  const active = parcels.filter((p) => !['acquired', 'lost'].includes(p.stage));
  const acquired = parcels.filter((p) => p.stage === 'acquired').length;

  // Meetings booked this week (landowner meetings from the comms timeline).
  const contactIds = parcels.map((p) => p.contactId).filter(Boolean) as string[];
  let meetings = 0;
  if (contactIds.length) {
    const { count } = await supabase.from('contact_communications').select('id', { count: 'exact', head: true }).eq('channel', 'meeting').in('contact_id', contactIds).gte('occurred_at', new Date(now - 7 * DAY).toISOString());
    meetings = count ?? 0;
  }

  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
  const kpis = [
    { label: 'Active owners', value: String(active.length), icon: Users, tone: 'forest' },
    { label: 'Negotiations', value: String(parcels.filter((p) => p.stage === 'negotiation').length), icon: Handshake, tone: 'forest' },
    { label: 'Avg score', value: String(avg(active.map((p) => p.score.score))), icon: Gauge, tone: 'forest' },
    { label: 'Avg readiness', value: String(avg(active.map((p) => p.readiness.score))), icon: HeartHandshake, tone: 'champagne' },
    { label: 'Potential GDV', value: formatCurrencyCompact(parcels.reduce((s, p) => s + Number((p.offerInputs?.gdv as number) ?? p.uplift?.post ?? 0), 0)), icon: Landmark, tone: 'forest' },
    { label: 'Est. profit', value: formatCurrencyCompact(parcels.reduce((s, p) => s + (p.uplift?.marginAbs ?? 0), 0)), icon: TrendingUp, tone: 'champagne' },
    { label: 'Assembly plays', value: String(clusters.length), icon: Puzzle, tone: 'forest' },
    { label: 'Contacted 7d', value: String(parcels.filter((p) => p.lastContactedAt && now - new Date(p.lastContactedAt).getTime() < 7 * DAY).length), icon: PhoneCall, tone: 'forest' },
    { label: 'Meetings 7d', value: String(meetings), icon: CalendarCheck, tone: 'forest' },
    { label: 'Offers pending', value: String(parcels.filter((p) => p.stage === 'offer_made').length), icon: FileSignature, tone: 'danger' },
  ];
  const KTONE: Record<string, string> = { forest: 'text-forest', champagne: 'text-champagne-600', danger: 'text-signal-danger' };

  const outreachDue = active.filter((p) => ['contacted', 'interested', 'negotiation'].includes(p.stage) && (!p.lastContactedAt || now - new Date(p.lastContactedAt).getTime() > 7 * DAY)).sort((a, b) => b.score.score - a.score.score);

  const tabs: TabDef[] = [
    { id: 'pipeline', label: 'Pipeline', content: parcels.length === 0 ? <Panel><p className="text-sm text-charcoal-600/70">No parcels yet — add your first off-market landowner to start sourcing.</p></Panel> : <AcquisitionBoard parcels={parcels} /> },
    {
      id: 'scoring', label: 'Land scoring', content: (
        <Panel>
          {parcels.length === 0 ? <p className="text-sm text-charcoal-600/70">No parcels scored yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-charcoal-600/50"><th className="pb-2 pr-3">Parcel</th><th className="pb-2 pr-3">Location</th><th className="pb-2 pr-3 text-right">Readiness</th><th className="pb-2 pr-3 text-right">Uplift</th><th className="pb-2 text-right">Score</th></tr></thead>
                <tbody>
                  {parcels.map((p) => (
                    <tr key={p.id} className="border-t border-stone-line">
                      <td className="py-2.5 pr-3"><Link href={`/acquisitions/${p.id}`} className="font-medium text-charcoal hover:text-forest">{p.reference}</Link><br /><span className="text-[11px] text-charcoal-600/50">{p.ownerName ?? '—'}</span></td>
                      <td className="py-2.5 pr-3 text-charcoal-600/70">{p.location ?? '—'}</td>
                      <td className="py-2.5 pr-3 text-right figure text-champagne-600">{p.readiness.score}</td>
                      <td className="py-2.5 pr-3 text-right figure text-forest">{p.uplift ? formatCurrency(p.uplift.marginAbs) : '—'}</td>
                      <td className="py-2.5 text-right"><span className={`figure rounded-md px-2 py-0.5 text-xs font-semibold ${BAND[p.score.band]}`}>{p.score.score}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ),
    },
    { id: 'assembly', label: 'Assembly', content: <AssemblyPanel clusters={clusters} /> },
    {
      id: 'outreach', label: 'Outreach', content: (
        <div className="space-y-4">
          <Panel>
            <h4 className="mb-1 text-charcoal">Automated outreach cadence</h4>
            <p className="mb-3 text-xs text-charcoal-600/60">The <span className="font-medium">acquisition_cadence</span> job nudges quiet landowners — WhatsApp then email, audience-aware — and flags a call. Follow-ups, DD deadlines and stalled-negotiation escalations run automatically.</p>
            <div className="flex flex-wrap gap-2 text-xs text-charcoal-600/70">
              <span className="flex items-center gap-1 rounded-lg bg-sand-100 px-2.5 py-1"><Phone size={12} className="text-forest" /> Call</span>
              <span className="flex items-center gap-1 rounded-lg bg-sand-100 px-2.5 py-1"><MessageCircle size={12} className="text-forest" /> WhatsApp</span>
              <span className="flex items-center gap-1 rounded-lg bg-sand-100 px-2.5 py-1"><Mail size={12} className="text-forest" /> Email</span>
            </div>
          </Panel>
          <Panel>
            <h4 className="mb-3 text-charcoal">Due for outreach · {outreachDue.length}</h4>
            {outreachDue.length === 0 ? <p className="text-sm text-charcoal-600/60">Every active landowner has been contacted recently. 🎉</p> : (
              <ul className="divide-y divide-stone-line">
                {outreachDue.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0"><Link href={`/acquisitions/${p.id}`} className="font-medium text-charcoal hover:text-forest">{p.reference}</Link><span className="text-[11px] text-charcoal-600/55">{p.ownerName ? ` · ${p.ownerName}` : ''} · {STAGE_LABEL[p.stage]}</span></div>
                    <span className="shrink-0 text-[11px] text-signal-danger">{p.lastContactedAt ? `${Math.floor((now - new Date(p.lastContactedAt).getTime()) / DAY)}d quiet` : 'never contacted'}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Workspace" title="Acquisitions" description={`${active.length} active · ${acquired} acquired · a map-first off-market sourcing engine.`} action={<NewParcelForm agents={(agents ?? []) as any} />} />

      {/* Executive KPI bar */}
      <div className="ws-card grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5 !py-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center gap-2.5">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest/[0.06] ${KTONE[k.tone]}`}><k.icon size={15} strokeWidth={1.9} /></span>
            <div><p className={`figure text-xl leading-none ${KTONE[k.tone]}`}>{k.value}</p><p className="mt-0.5 text-[10px] uppercase tracking-wide text-charcoal-600/50">{k.label}</p></div>
          </div>
        ))}
      </div>

      {/* Map-first primary surface */}
      <AcquisitionMap parcels={parcels} />

      {/* Pipeline + scoring + assembly + outreach (secondary) */}
      <Tabs tabs={tabs} initial={searchParams?.tab} />
    </div>
  );
}
