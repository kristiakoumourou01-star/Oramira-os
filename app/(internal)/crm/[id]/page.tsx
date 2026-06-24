import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { LifecycleBadges } from '@/components/crm/LifecycleBadges';
import { StatusPipeline } from '@/components/crm/StatusPipeline';
import { AIInsightPanel } from '@/components/crm/AIInsightPanel';
import { ContactTimeline, type TimelineEntry } from '@/components/crm/ContactTimeline';
import { UnitLinkCard } from '@/components/crm/UnitLinkCard';
import { TaskList } from '@/components/ui/TaskList';

/**
 * The single 360-degree view of a contact — this is what makes the CRM the
 * source of truth rather than a leads list with a CRUD form behind it.
 * Everything downstream (buyer portal, homeowner record, investor holding)
 * renders on the SAME page because it's the same person.
 */
export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: contact } = await supabase.from('contacts').select('*').eq('id', params.id).single();
  if (!contact) notFound();

  const { data: lead } = await supabase
    .from('leads')
    .select('id, status, source, budget_min, budget_max, timeline_to_buy, message, ai_score, ai_score_reasoning, ai_summary, ai_next_steps, ai_summary_generated_at, projects:preferred_project_id(name)')
    .eq('contact_id', contact.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: buyer } = await supabase
    .from('buyers')
    .select('id, portal_eligible, portal_activated')
    .eq('contact_id', contact.id)
    .maybeSingle();

  const { data: investorHoldings } = contact.is_investor
    ? await supabase
        .from('investor_holdings')
        .select('id, capital_invested, ownership_percentage, projects(name), units(unit_number)')
        .eq('investor_id', (await supabase.from('investors').select('id').eq('contact_id', contact.id).single()).data?.id ?? '')
    : { data: [] as any[] };

  let unitLinkData = null;
  if (buyer) {
    const { data: unit } = await supabase
      .from('units')
      .select('id, unit_number, sqm, price, projects(name)')
      .eq('buyer_contact_id', contact.id)
      .maybeSingle();

    const { data: reservation } = unit
      ? await supabase.from('reservations').select('deposit_amount, deposit_paid').eq('unit_id', unit.id).eq('buyer_contact_id', contact.id).maybeSingle()
      : { data: null };

    const { data: contract } = unit
      ? await supabase.from('contracts').select('id, status').eq('unit_id', unit.id).eq('buyer_contact_id', contact.id).maybeSingle()
      : { data: null };

    const { data: payments } = contract
      ? await supabase.from('payments').select('amount_paid, paid_at').eq('contract_id', (contract as any).id)
      : { data: [] };

    unitLinkData = {
      buyerId: buyer.id,
      portalEligible: buyer.portal_eligible,
      portalActivated: buyer.portal_activated,
      unit: unit ? { id: unit.id, unit_number: unit.unit_number, sqm: unit.sqm, price: unit.price, project_name: (unit as any).projects?.name ?? null } : null,
      reservation: reservation ?? null,
      contract: contract ? { status: (contract as any).status } : null,
      payments: payments ?? [],
    };
  }

  const { data: notes } = await supabase
    .from('notes')
    .select('id, body, created_at, profiles(full_name)')
    .eq('entity_type', 'contact')
    .eq('entity_id', contact.id);

  const { data: comms } = await supabase
    .from('contact_communications')
    .select('id, channel, direction, summary, occurred_at, profiles(full_name)')
    .eq('contact_id', contact.id);

  const timeline: TimelineEntry[] = [
    ...(notes ?? []).map((n: any) => ({
      id: n.id, kind: 'note' as const, body: n.body, author: n.profiles?.full_name, occurred_at: n.created_at,
    })),
    ...(comms ?? []).map((c: any) => ({
      id: c.id, kind: 'communication' as const, body: c.summary, channel: c.channel, direction: c.direction,
      author: c.profiles?.full_name, occurred_at: c.occurred_at,
    })),
  ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  const { data: followUps } = await supabase
    .from('follow_up_tasks')
    .select('id, note, due_at, is_done')
    .eq('contact_id', contact.id);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow mb-1">{contact.email}</p>
          <h1 className="text-3xl">{contact.full_name ?? 'Unnamed contact'}</h1>
          <p className="mt-1 text-sm text-charcoal-600/80">{contact.phone} {contact.nationality ? `· ${contact.nationality}` : ''}</p>
        </div>
        <LifecycleBadges
          isLead={contact.is_lead} isBuyer={contact.is_buyer}
          isInvestor={contact.is_investor} isHomeowner={contact.is_homeowner}
          isNewsletter={contact.is_newsletter_subscriber}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {lead && (
            <div className="panel p-6">
              <h4 className="mb-4">Sales pipeline</h4>
              <StatusPipeline leadId={lead.id} currentStatus={lead.status} />
              <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="eyebrow">Budget</p>
                  <p className="figure text-charcoal">
                    €{Number(lead.budget_min ?? 0).toLocaleString()}–{Number(lead.budget_max ?? 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="eyebrow">Source</p>
                  <p className="text-charcoal capitalize">{lead.source}</p>
                </div>
                <div>
                  <p className="eyebrow">Interested project</p>
                  <p className="text-charcoal">{(lead as any).projects?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="eyebrow">Timeline to buy</p>
                  <p className="text-charcoal">{lead.timeline_to_buy ?? '—'}</p>
                </div>
              </div>
            </div>
          )}

          <ContactTimeline contactId={contact.id} leadId={lead?.id} entries={timeline} />

          {investorHoldings && investorHoldings.length > 0 && (
            <div className="panel p-6">
              <h4 className="mb-4">Investment holdings</h4>
              <table className="table-base w-full">
                <thead><tr><th>Project</th><th>Unit</th><th>Capital invested</th><th>Ownership</th></tr></thead>
                <tbody>
                  {investorHoldings.map((h: any) => (
                    <tr key={h.id}>
                      <td>{h.projects?.name ?? '—'}</td>
                      <td>{h.units?.unit_number ?? '—'}</td>
                      <td className="figure">€{Number(h.capital_invested ?? 0).toLocaleString()}</td>
                      <td className="figure">{h.ownership_percentage ?? '—'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {lead && (
            <AIInsightPanel
              leadId={lead.id}
              score={lead.ai_score}
              reasoning={lead.ai_score_reasoning}
              summary={lead.ai_summary}
              nextSteps={lead.ai_next_steps}
              generatedAt={lead.ai_summary_generated_at}
            />
          )}

          {unitLinkData && <UnitLinkCard data={unitLinkData} />}

          <div className="panel p-6">
            <h4 className="mb-3">Follow-ups</h4>
            <TaskList
              table="follow_up_tasks"
              tasks={(followUps ?? []).map((t) => ({ id: t.id, title: t.note ?? 'Follow up', due_at: t.due_at, is_done: t.is_done }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
