import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Phone, Mail, User } from 'lucide-react';
import { StatusPipeline } from '@/components/crm/StatusPipeline';
import { AIInsightPanel } from '@/components/crm/AIInsightPanel';
import { ContactTimeline, type TimelineEntry } from '@/components/crm/ContactTimeline';
import { LeadQuickActions } from '@/components/crm/LeadQuickActions';
import { ConvertToReservation, type AvailableUnit } from '@/components/crm/ConvertToReservation';
import { PriorityBadge } from '@/components/crm/PriorityBadge';
import { computePriority } from '@/lib/priority';

const SOURCE_LABEL: Record<string, string> = {
  website: 'Website', meta: 'Meta', google: 'Google', organic: 'Organic',
  referral: 'Referral', whatsapp: 'WhatsApp', walk_in: 'Walk-in', other: 'Other',
};

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: lead } = await supabase
    .from('leads')
    .select(
      `id, contact_id, status, source, budget_min, budget_max, timeline_to_buy, message,
       ai_score, ai_score_reasoning, ai_summary, ai_next_steps, ai_summary_generated_at,
       last_contacted_at, created_at, assigned_to,
       contacts(full_name, email, phone, nationality), owner:assigned_to(full_name), projects:preferred_project_id(name)`
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!lead) notFound();

  const contact = (lead as any).contacts;
  const ownerName = (lead as any).owner?.full_name ?? null;

  const [{ data: followUps }, { data: notes }, { data: comms }, { data: units }] = await Promise.all([
    supabase.from('follow_up_tasks').select('id, due_at, note').eq('lead_id', lead.id).eq('is_done', false).order('due_at'),
    supabase
      .from('notes')
      .select('id, body, created_at, entity_type, profiles(full_name)')
      .or(`and(entity_type.eq.lead,entity_id.eq.${lead.id}),and(entity_type.eq.contact,entity_id.eq.${lead.contact_id})`)
      .order('created_at', { ascending: false }),
    supabase.from('contact_communications').select('id, channel, direction, summary, occurred_at, profiles(full_name)').eq('contact_id', lead.contact_id).order('occurred_at', { ascending: false }),
    supabase.from('units').select('id, unit_number, price, projects(name)').eq('status', 'available').order('unit_number'),
  ]);

  const nextFollowUp = (followUps ?? [])[0]?.due_at ?? null;
  const { score, reasons } = computePriority({
    status: lead.status, budget_min: lead.budget_min, budget_max: lead.budget_max,
    ai_score: lead.ai_score, last_contacted_at: lead.last_contacted_at, created_at: lead.created_at,
  });

  const timeline: TimelineEntry[] = [
    ...(notes ?? []).map((n: any) => ({ id: n.id, kind: 'note' as const, body: n.body, author: n.profiles?.full_name, occurred_at: n.created_at })),
    ...(comms ?? []).map((c: any) => ({ id: c.id, kind: 'communication' as const, body: c.summary, channel: c.channel, direction: c.direction, author: c.profiles?.full_name, occurred_at: c.occurred_at })),
  ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  const availableUnits: AvailableUnit[] = (units ?? []).map((u: any) => ({
    id: u.id,
    label: `${u.projects?.name ?? 'Project'} · Unit ${u.unit_number}${u.price != null ? ` · €${Number(u.price).toLocaleString()}` : ''}`,
  }));

  const quickLead = { id: lead.id, contact_id: lead.contact_id, full_name: contact?.full_name ?? null, email: contact?.email ?? null, phone: contact?.phone ?? null };
  const budget = lead.budget_min || lead.budget_max ? `€${Number(lead.budget_min ?? 0).toLocaleString()}–${Number(lead.budget_max ?? 0).toLocaleString()}` : '—';

  return (
    <div className="space-y-6">
      <Link href="/crm/leads" className="inline-flex items-center gap-1 text-sm text-charcoal-600/70 hover:text-forest">
        <ArrowLeft size={14} strokeWidth={1.75} /> Leads
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <PriorityBadge score={score} />
            <span className="badge-neutral capitalize">{lead.status}</span>
          </div>
          <h1 className="text-3xl">{contact?.full_name ?? 'Unnamed lead'}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-charcoal-600/80">
            {contact?.phone && <span className="flex items-center gap-1"><Phone size={13} strokeWidth={1.75} /> {contact.phone}</span>}
            {contact?.email && <span className="flex items-center gap-1"><Mail size={13} strokeWidth={1.75} /> {contact.email}</span>}
            <span className="flex items-center gap-1"><User size={13} strokeWidth={1.75} /> {ownerName ?? 'Unassigned'}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <LeadQuickActions lead={quickLead} size="md" />
          <ConvertToReservation
            leadId={lead.id}
            contactId={lead.contact_id}
            units={availableUnits}
            alreadyReserved={lead.status === 'reserved' || lead.status === 'won'}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="panel p-6">
            <h4 className="mb-4">Sales pipeline</h4>
            <StatusPipeline leadId={lead.id} currentStatus={lead.status} />
            <div className="mt-5 grid grid-cols-3 gap-4 text-sm">
              <div><p className="eyebrow">Budget</p><p className="figure text-charcoal">{budget}</p></div>
              <div><p className="eyebrow">Source</p><p className="text-charcoal">{SOURCE_LABEL[lead.source] ?? lead.source}</p></div>
              <div><p className="eyebrow">Timeline to buy</p><p className="text-charcoal">{lead.timeline_to_buy ?? '—'}</p></div>
              <div><p className="eyebrow">Interested project</p><p className="text-charcoal">{(lead as any).projects?.name ?? '—'}</p></div>
              <div><p className="eyebrow">Last contacted</p><p className="text-charcoal">{lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleDateString() : 'Never'}</p></div>
              <div><p className="eyebrow">Next follow-up</p><p className={`text-charcoal ${nextFollowUp && new Date(nextFollowUp).getTime() <= Date.now() ? 'text-signal-danger' : ''}`}>{nextFollowUp ? new Date(nextFollowUp).toLocaleDateString() : '—'}</p></div>
            </div>
          </div>

          <ContactTimeline contactId={lead.contact_id} leadId={lead.id} entries={timeline} />
        </div>

        <div className="space-y-6">
          <AIInsightPanel
            leadId={lead.id}
            score={lead.ai_score}
            reasoning={lead.ai_score_reasoning}
            summary={lead.ai_summary}
            nextSteps={lead.ai_next_steps}
            generatedAt={lead.ai_summary_generated_at}
          />

          <div className="panel p-6">
            <h4 className="mb-3">Priority score</h4>
            <p className="figure mb-3 text-3xl text-forest">{score}</p>
            {reasons.length === 0 ? (
              <p className="text-sm text-charcoal-600/70">Baseline priority — no boosting signals yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm text-charcoal-600/85">
                {reasons.map((r) => <li key={r} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-champagne" /> {r}</li>)}
              </ul>
            )}
          </div>

          <div className="panel p-6">
            <h4 className="mb-3">Upcoming follow-ups</h4>
            {(followUps ?? []).length === 0 ? (
              <p className="text-sm text-charcoal-600/70">None scheduled. Use the calendar action above to add one.</p>
            ) : (
              <ul className="divide-y divide-stone-line">
                {(followUps ?? []).map((f: any) => (
                  <li key={f.id} className="py-2.5">
                    <p className="figure text-sm text-charcoal">{new Date(f.due_at).toLocaleString()}</p>
                    {f.note && <p className="text-xs text-charcoal-600/70">{f.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
