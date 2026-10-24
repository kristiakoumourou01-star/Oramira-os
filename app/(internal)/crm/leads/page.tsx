import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEnrichedLeads } from '@/lib/leads';
import { getRetargetingAudiences } from '@/app/actions/communications';
import { computeSalesKpis, formatMinutes } from '@/lib/sales-kpi';
import { buildSalesCommand } from '@/lib/sales-command';
import Link from 'next/link';
import { SalesCommandCenter } from '@/components/crm/SalesCommandCenter';
import { LeadBoard, type Agent } from '@/components/crm/LeadBoard';
import { NewLeadForm } from '@/components/crm/NewLeadForm';
import { SpeedToLeadWidget, type PendingLead } from '@/components/crm/SpeedToLeadWidget';
import { UnassignedTriage, type TriageLead } from '@/components/crm/UnassignedTriage';
import { RetargetingExport } from '@/components/crm/RetargetingExport';
import { Tabs, type TabDef } from '@/components/ui/Tabs';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { Clock, CalendarDays, Handshake, Trophy, Zap, Reply, CalendarCheck, Home, Wallet } from 'lucide-react';
import { formatDate, formatDateTime, formatNumber, formatCurrency } from '@/lib/format';

const Panel = ({ children }: { children: React.ReactNode }) => <div className="panel p-6">{children}</div>;
const Empty = ({ text }: { text: string }) => <p className="text-sm text-charcoal-600/70">{text}</p>;
const SOURCE_LABEL: Record<string, string> = { website: 'Website', meta: 'Meta', google: 'Google', organic: 'Organic', referral: 'Referral', whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', walk_in: 'Walk-in', other: 'Other' };
const VIEW_STATUS: Record<string, string> = { scheduled: 'badge-champagne', attended: 'badge-forest', no_show: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge', cancelled: 'badge-neutral' };

/** Sales — one workspace page. Pipeline, follow-ups, viewings, retargeting,
 *  closings, and KPIs are in-page tabs (no extra sidebar routes). */
export default async function SalesPage({ searchParams }: { searchParams: { tab?: string } }) {
  const profile = await requirePermission('leads');
  const supabase = await createSupabaseServerClient();
  const now = Date.now();

  const [leads, { data: projects }, { data: agents }, { data: pending }, unassignedRes, { data: followUps }, { data: viewings }, { data: reservations }, { data: won }, retarget, kpis] = await Promise.all([
    getEnrichedLeads(),
    supabase.from('projects').select('id, name'),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales', 'management']),
    supabase.from('leads').select('id, created_at, contacts(full_name)').eq('status', 'new').is('first_response_at', null),
    supabase.from('leads').select('id, created_at, source, status, contacts(full_name)').is('assigned_to', null).order('created_at', { ascending: true }).limit(80),
    supabase.from('follow_up_tasks').select('id, note, due_at, lead_id, contacts(full_name)').eq('is_done', false).order('due_at', { ascending: true }).limit(100),
    supabase.from('viewings').select('id, scheduled_at, status, lead_id, contacts(full_name), projects(name), agent:agent_id(full_name)').order('scheduled_at', { ascending: false }).limit(100),
    supabase.from('reservations').select('id, status, deposit_amount, deposit_paid, reserved_at, contacts(full_name), units(unit_number, projects(name))').order('reserved_at', { ascending: false }).limit(60),
    supabase.from('leads').select('id, contacts(full_name)').eq('status', 'won').limit(60),
    getRetargetingAudiences(),
    computeSalesKpis(supabase),
  ]);

  const command = await buildSalesCommand(supabase);

  const pendingLeads: PendingLead[] = (pending ?? [])
    .map((l: any) => ({ id: l.id, name: l.contacts?.full_name ?? 'Unnamed lead', minutesWaiting: Math.max(0, Math.floor((now - new Date(l.created_at).getTime()) / 60000)) }))
    .sort((a, b) => b.minutesWaiting - a.minutesWaiting);

  // Ownerless leads — surfaced as a triage rail so none slips. Terminal/parked
  // statuses are filtered in JS (avoids a PostgREST enum-list quirk); resilient:
  // an errored query just yields an empty rail rather than breaking the page.
  const CLOSED = new Set(['won', 'lost', 'nurture', 'no_response', 'retargeting', 'reactivation']);
  const unassignedLeads: TriageLead[] = (unassignedRes.error ? [] : unassignedRes.data ?? [])
    .filter((l: any) => !CLOSED.has(l.status))
    .map((l: any) => ({ id: l.id, name: l.contacts?.full_name ?? 'Unnamed lead', source: l.source ?? 'other', ageMinutes: Math.max(0, Math.floor((now - new Date(l.created_at).getTime()) / 60000)) }));

  const kpiCards = [
    { icon: Zap, label: 'Avg speed-to-lead', value: formatMinutes(kpis.speedToLeadAvgMinutes), sub: `median ${formatMinutes(kpis.speedToLeadMedianMinutes)}` },
    { icon: Reply, label: 'Response rate', value: `${kpis.responseRatePct}%`, sub: `${kpis.totalLeads} leads` },
    { icon: CalendarCheck, label: 'Booking rate', value: `${kpis.bookingRatePct}%`, sub: 'leads with a viewing' },
    { icon: Home, label: 'Viewing → reservation', value: `${kpis.viewingToReservationPct}%`, sub: `${kpis.reservationsCount} reservations` },
    { icon: Trophy, label: 'Reservation → sale', value: `${kpis.reservationToSalePct}%`, sub: `${kpis.wonCount} won` },
    { icon: Wallet, label: 'Commissions pending', value: `${formatCurrency(kpis.commissionsPending)}`, sub: `${formatCurrency(kpis.commissionsPaid)} paid` },
  ];

  const tabs: TabDef[] = [
    { id: 'command', label: 'Command Center', content: <SalesCommandCenter data={command} /> },
    {
      id: 'pipeline', label: 'Pipeline', content: (
        <div className="space-y-6">
          <UnassignedTriage leads={unassignedLeads} agents={(agents ?? []) as Agent[]} currentUserId={profile.id} />
          <SpeedToLeadWidget leads={pendingLeads} />
          <LeadBoard leads={leads} agents={(agents ?? []) as Agent[]} currentUserId={profile.id} />
        </div>
      ),
    },
    {
      id: 'followups', label: 'Follow-ups', content: (
        <Panel>{(followUps ?? []).length === 0 ? <Empty text="No open follow-ups. 🎉" /> : (
          <ul className="divide-y divide-stone-line">
            {(followUps ?? []).map((t: any) => {
              const overdue = new Date(t.due_at).getTime() <= now;
              return (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Clock size={15} className={overdue ? 'text-signal-danger' : 'text-olive'} strokeWidth={1.75} />
                    <div>
                      <p className="text-sm text-charcoal">{t.note ?? 'Follow-up'}{t.contacts?.full_name ? ` · ${t.contacts.full_name}` : ''}</p>
                      <p className="text-xs text-charcoal-600/60">{formatDateTime(t.due_at)}</p>
                    </div>
                  </div>
                  {t.lead_id && <Link href={`/crm/leads/${t.lead_id}`} className="text-sm text-forest hover:underline">Open</Link>}
                </li>
              );
            })}
          </ul>
        )}</Panel>
      ),
    },
    {
      id: 'viewings', label: 'Viewings', content: (
        <Panel>{(viewings ?? []).length === 0 ? <Empty text="No viewings scheduled." /> : (
          <ul className="divide-y divide-stone-line">
            {(viewings ?? []).map((v: any) => (
              <li key={v.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <CalendarDays size={15} className="text-olive" strokeWidth={1.75} />
                  <div>
                    <p className="text-sm text-charcoal">{v.contacts?.full_name ?? 'Lead'}{v.projects?.name ? ` · ${v.projects.name}` : ''}</p>
                    <p className="text-xs text-charcoal-600/60">{formatDateTime(v.scheduled_at)}{v.agent?.full_name ? ` · ${v.agent.full_name}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={VIEW_STATUS[v.status] ?? 'badge-neutral'}>{v.status.replace('_', ' ')}</span>
                  {v.lead_id && <Link href={`/crm/leads/${v.lead_id}`} className="text-sm text-forest hover:underline">Open</Link>}
                </div>
              </li>
            ))}
          </ul>
        )}</Panel>
      ),
    },
    { id: 'retargeting', label: 'Retargeting', content: <RetargetingExport leads={retarget} /> },
    {
      id: 'closings', label: 'Closings', content: (
        <div className="space-y-6">
          <Panel>
            <h4 className="mb-4 flex items-center gap-2"><Handshake size={15} className="text-olive" strokeWidth={1.75} /> Reservations</h4>
            {(reservations ?? []).length === 0 ? <Empty text="No reservations yet." /> : (
              <ul className="divide-y divide-stone-line">
                {(reservations ?? []).map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="text-charcoal">{r.contacts?.full_name ?? 'Buyer'}{r.units?.unit_number ? ` · ${r.units.projects?.name ?? ''} House ${r.units.unit_number}` : ''}</p>
                      <p className="text-xs text-charcoal-600/60">{r.reserved_at ? formatDate(r.reserved_at) : ''}{r.deposit_amount ? ` · deposit ${formatCurrency(Number(r.deposit_amount))}${r.deposit_paid ? ' (paid)' : ''}` : ''}</p>
                    </div>
                    <span className={r.status === 'active' ? 'badge-forest' : 'badge-neutral'}>{r.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel>
            <h4 className="mb-4 flex items-center gap-2"><Trophy size={15} className="text-olive" strokeWidth={1.75} /> Completed sales</h4>
            {(won ?? []).length === 0 ? <Empty text="No completed sales yet." /> : (
              <ul className="divide-y divide-stone-line">{(won ?? []).map((l: any) => <li key={l.id} className="py-2.5 text-sm text-charcoal">{l.contacts?.full_name ?? 'Buyer'}</li>)}</ul>
            )}
          </Panel>
        </div>
      ),
    },
    {
      id: 'kpis', label: 'KPIs', content: (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {kpiCards.map((c) => (
              <Panel key={c.label}>
                <p className="mb-1 flex items-center gap-2 text-xs text-charcoal-600/70"><c.icon size={14} className="text-olive" strokeWidth={1.75} /> {c.label}</p>
                <p className="figure text-3xl text-forest">{c.value}</p>
                <p className="text-xs text-charcoal-600/50">{c.sub}</p>
              </Panel>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <Panel>
              <h4 className="mb-4">Sales per agent</h4>
              {kpis.agents.length === 0 ? <Empty text="No agent activity yet." /> : (
                <table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-charcoal-600/50"><th className="pb-2">Agent</th><th className="pb-2 text-right">Leads</th><th className="pb-2 text-right">Won</th><th className="pb-2 text-right">Pending €</th></tr></thead>
                  <tbody>{kpis.agents.map((a) => (<tr key={a.agentId} className="border-t border-stone-line"><td className="py-2 text-charcoal">{a.name}</td><td className="py-2 text-right figure text-charcoal-600">{a.leads}</td><td className="py-2 text-right figure text-forest">{a.won}</td><td className="py-2 text-right figure text-charcoal-600">{formatNumber(a.commissionPending)}</td></tr>))}</tbody>
                </table>
              )}
            </Panel>
            <Panel>
              <h4 className="mb-4">Lead source performance</h4>
              {kpis.sources.length === 0 ? <Empty text="No leads yet." /> : (
                <table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-charcoal-600/50"><th className="pb-2">Source</th><th className="pb-2 text-right">Leads</th><th className="pb-2 text-right">Won</th><th className="pb-2 text-right">Conv.</th></tr></thead>
                  <tbody>{kpis.sources.map((sr) => (<tr key={sr.source} className="border-t border-stone-line"><td className="py-2 text-charcoal">{SOURCE_LABEL[sr.source] ?? sr.source}</td><td className="py-2 text-right figure text-charcoal-600">{sr.leads}</td><td className="py-2 text-right figure text-forest">{sr.won}</td><td className="py-2 text-right figure text-charcoal-600">{sr.conversionPct}%</td></tr>))}</tbody>
                </table>
              )}
            </Panel>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Workspace" title="Sales" action={<NewLeadForm projects={projects ?? []} agents={(agents ?? []) as Agent[]} />} />
      <Tabs tabs={tabs} initial={searchParams?.tab} />
    </div>
  );
}
