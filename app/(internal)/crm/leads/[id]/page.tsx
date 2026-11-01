import { requirePermission } from '@/lib/auth';
import { loadContactDuplicates } from '@/lib/duplicates';
import { DuplicateBanner } from '@/components/crm/DuplicateBanner';
import { ContactMetaPanel } from '@/components/crm/ContactMetaPanel';
import { getContactMeta } from '@/lib/contact-meta';
import { getOrgSettings } from '@/lib/org-settings';
import { effectiveCan } from '@/lib/permissions';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Phone, Mail, User } from 'lucide-react';
import { StatusPipeline } from '@/components/crm/StatusPipeline';
import { LeadPipelinePicker } from '@/components/crm/LeadPipelinePicker';
import { pipelineOf, STATUS_EL } from '@/lib/pipeline-shared';
import { AIInsightPanel } from '@/components/crm/AIInsightPanel';
import { ContactTimeline, type TimelineEntry } from '@/components/crm/ContactTimeline';
import { LeadQuickActions } from '@/components/crm/LeadQuickActions';
import { ConvertToReservation, type AvailableUnit } from '@/components/crm/ConvertToReservation';
import { PriorityBadge } from '@/components/crm/PriorityBadge';
import { LeadAssistant } from '@/components/crm/LeadAssistant';
import { LeadNextAction } from '@/components/crm/LeadNextAction';
import { RecommendedProperties } from '@/components/crm/RecommendedProperties';
import { LeadAreasEditor } from '@/components/crm/LeadAreasEditor';
import { LeadRequirementsEditor } from '@/components/crm/LeadRequirementsEditor';
import { cleanRequirements, cleanValues } from '@/lib/unit-forms-shared';
import { rankPropertiesForLead } from '@/lib/matching';
import { SalesCoach } from '@/components/crm/SalesCoach';
import { ViewingScheduler, type ViewingRow, type UnitOption, type AgentOption } from '@/components/crm/ViewingScheduler';
import { NegotiationTracker, type NegotiationRow } from '@/components/crm/NegotiationTracker';
import { computePriority } from '@/lib/priority';
import { scoreLead } from '@/lib/lead-scoring';
import { getSourceConversionMap } from '@/lib/learning-loop';
import { PredictiveScore } from '@/components/crm/PredictiveScore';
import { analyzeSalesStrategy } from '@/lib/sales-assistant';
import { AssistantStrategy } from '@/components/crm/AssistantStrategy';
import { formatDate, formatDateTime, formatNumber, formatCurrency } from '@/lib/format';

const SOURCE_LABEL: Record<string, string> = {
  website: 'Website', meta: 'Meta', google: 'Google', organic: 'Organic',
  referral: 'Referral', whatsapp: 'WhatsApp', walk_in: 'Walk-in', other: 'Other',
};

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const profile = await requirePermission('leads');
  const supabase = await createSupabaseServerClient();

  // Resilient select: prefer the full record, but degrade to guaranteed columns
  // if the assignment/doctrine columns (0020/0027) aren't on the DB yet — so a
  // missing column shows a lead with less metadata instead of a false 404.
  const FULL = `id, contact_id, status, source, budget_min, budget_max, timeline_to_buy, message, preferred_project_id,
       ai_score, ai_score_reasoning, ai_summary, ai_next_steps, ai_summary_generated_at,
       last_contacted_at, created_at, assigned_to, assigned_at, next_action_date, next_action_type, first_response_at,
       contacts(full_name, email, phone, nationality, buyer_type, preferred_language), owner:assigned_to(full_name),
       assigner:assigned_by(full_name), projects:preferred_project_id(name)`;
  const BASE = `id, contact_id, status, source, budget_min, budget_max, timeline_to_buy, message, preferred_project_id,
       ai_score, ai_score_reasoning, ai_summary, ai_next_steps, ai_summary_generated_at,
       last_contacted_at, created_at, assigned_to,
       contacts(full_name, email, phone, nationality), owner:assigned_to(full_name),
       projects:preferred_project_id(name)`;
  let leadRes = await supabase.from('leads').select(FULL).eq('id', params.id).maybeSingle();
  if (leadRes.error) {
    console.warn('[lead detail] full select failed (%s) — base columns', leadRes.error.message);
    leadRes = await supabase.from('leads').select(BASE).eq('id', params.id).maybeSingle();
  }
  const lead: any = leadRes.data;
  if (!lead) notFound();
  // Everything below depends only on the lead row, so start it all at once
  // instead of one wave after another.
  const pMatch = Promise.all([
    supabase.from('leads').select('preferred_areas').eq('id', lead.id).maybeSingle(),
    supabase.from('projects').select('id, name, location, latitude, longitude'),
    (supabase as any).from('leads').select('unit_requirements').eq('id', lead.id).maybeSingle(),
    (supabase as any).from('units').select('id, custom_fields').eq('status', 'available'),
    getOrgSettings(),
  ]);
  const pConv = getSourceConversionMap(supabase);
  const pMain = Promise.all([
    supabase.from('follow_up_tasks').select('id, due_at, note').eq('lead_id', lead.id).eq('is_done', false).order('due_at'),
    supabase
      .from('notes')
      .select('id, body, created_at, entity_type, profiles(full_name)')
      .or(`and(entity_type.eq.lead,entity_id.eq.${lead.id}),and(entity_type.eq.contact,entity_id.eq.${lead.contact_id})`)
      .order('created_at', { ascending: false }),
    supabase.from('contact_communications').select('id, channel, direction, summary, status, ai_generated, occurred_at, profiles(full_name)').eq('contact_id', lead.contact_id).order('occurred_at', { ascending: false }),
    supabase.from('units').select('id, unit_number, price, bedrooms, project_id, projects(name)').eq('status', 'available').order('unit_number'),
    supabase.from('lead_assignments').select('id, note, created_at, to:assigned_to(full_name), by:assigned_by(full_name)').eq('lead_id', lead.id).order('created_at', { ascending: false }),
    supabase.from('viewings').select('id, scheduled_at, status, notes, units(unit_number), projects(name), agent:agent_id(full_name)').eq('lead_id', lead.id).order('scheduled_at', { ascending: false }),
    supabase.from('negotiations').select('id, offered_price, counter_offer, agreed_price, payment_terms, reservation_deposit, notes, created_at, profiles(full_name)').eq('lead_id', lead.id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales', 'management']).order('full_name'),
  ]);
  const pDupes = loadContactDuplicates(lead.contact_id);
  const [contactMeta, { tags: tagDefs, pipelines: pipeCfg }, { data: pl }] = await Promise.all([
    getContactMeta(lead.contact_id), getOrgSettings(),
    // Pipeline fields (migration 0068) read separately so the page works before it runs.
    (supabase as any).from('leads').select('pipeline, stage_entered_at, lost_reason, lost_note, is_returning, commission_invoice_id').eq('id', params.id).maybeSingle(),
  ]);
  const pipeline = pipelineOf(pipeCfg, pl?.pipeline ?? null);

  const contact = (lead as any).contacts;
  const ownerName = (lead as any).owner?.full_name ?? null;
  const assignerName = (lead as any).assigner?.full_name ?? null;

  const [{ data: followUps }, { data: notes }, { data: comms }, { data: units }, { data: history }, { data: viewings }, { data: negotiations }, { data: agents }] = await pMain;

  const nextFollowUp = (followUps ?? [])[0]?.due_at ?? null;
  const { score, reasons } = computePriority({
    status: lead.status, budget_min: lead.budget_min, budget_max: lead.budget_max,
    ai_score: lead.ai_score, last_contacted_at: lead.last_contacted_at, created_at: lead.created_at,
  });

  // Predictive score — computed from data already loaded above (no extra queries),
  // calibrated by the learning loop's per-source conversion rates.
  const inbound = (comms ?? []).filter((c: any) => c.direction === 'inbound');
  const activeNeg = (negotiations ?? []).find((n: any) => n.agreed_price == null);
  const sourceConversion = await pConv;
  const leadScore = scoreLead({
    status: lead.status, budgetMin: lead.budget_min, budgetMax: lead.budget_max, aiScore: lead.ai_score,
    createdAt: lead.created_at, lastContactedAt: lead.last_contacted_at, firstResponseAt: lead.first_response_at,
    buyerType: contact?.buyer_type ?? null,
    inboundCount: inbound.length, outboundCount: (comms ?? []).length - inbound.length,
    lastInboundAt: inbound.map((c: any) => c.occurred_at).sort().at(-1) ?? null,
    viewingsCount: (viewings ?? []).length, viewingsAttended: (viewings ?? []).filter((v: any) => v.status === 'attended').length,
    hasActiveNegotiation: !!activeNeg, objections: (activeNeg as any)?.notes ?? null,
    openFollowUpOverdue: (followUps ?? []).some((f: any) => new Date(f.due_at).getTime() < Date.now()),
    sourceConversionPct: sourceConversion[lead.source] ?? null,
  });

  const latestNeg = (negotiations ?? [])[0] as any;
  const strategy = analyzeSalesStrategy({
    status: lead.status, buyerType: contact?.buyer_type ?? null, language: contact?.preferred_language ?? null,
    convertProbability: leadScore.convertProbability, urgency: leadScore.urgency,
    viewingsAttended: (viewings ?? []).filter((v: any) => v.status === 'attended').length,
    offered: latestNeg?.offered_price ?? null, counter: latestNeg?.counter_offer ?? null, agreed: latestNeg?.agreed_price ?? null,
    objectionsNote: latestNeg?.notes ?? null,
    lastInboundText: (comms ?? []).find((c: any) => c.direction === 'inbound')?.summary ?? null,
  });

  const timeline: TimelineEntry[] = [
    ...(notes ?? []).map((n: any) => ({ id: n.id, kind: 'note' as const, body: n.body, author: n.profiles?.full_name, occurred_at: n.created_at })),
    ...(comms ?? []).map((c: any) => ({ id: c.id, kind: 'communication' as const, body: c.summary, channel: c.channel, direction: c.direction, status: c.status, ai_generated: c.ai_generated, author: c.profiles?.full_name, occurred_at: c.occurred_at })),
  ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  const availableUnits: AvailableUnit[] = (units ?? []).map((u: any) => ({
    id: u.id,
    label: `${u.projects?.name ?? 'Project'} · Unit ${u.unit_number}${u.price != null ? ` · ${formatCurrency(Number(u.price))}` : ''}`,
  }));

  // Matching engine → recommended inventory for this buyer (renders only when
  // there are real matches; empty until inventory exists).
  // Location matching (migration 0060): the buyer's areas vs each project's place.
  const [{ data: areaRow }, { data: projGeo }, { data: reqRow }, { data: unitFeat }, orgCfg] = await pMatch;
  const unitFields = orgCfg.unitForms.fields;
  const leadReq = cleanRequirements(reqRow?.unit_requirements, unitFields);
  const featById = new Map<string, any>(((unitFeat ?? []) as any[]).map((u) => [u.id, cleanValues(u.custom_fields, unitFields)]));
  const leadAreas: string[] = Array.isArray((areaRow as any)?.preferred_areas) ? (areaRow as any).preferred_areas : [];
  const geoById = new Map(((projGeo ?? []) as any[]).map((p) => [p.id, p]));
  const propertyMatches = rankPropertiesForLead(
    { budgetMin: lead.budget_min, budgetMax: lead.budget_max, preferredProjectId: (lead as any).preferred_project_id ?? null, areas: leadAreas, requirements: leadReq },
    (units ?? []).map((u: any) => {
      const g: any = geoById.get(u.project_id) ?? {};
      return { id: u.id, price: u.price, bedrooms: u.bedrooms, projectId: u.project_id, status: 'available', locationText: [g.location, g.name].filter(Boolean).join(', '), lat: g.latitude != null ? Number(g.latitude) : null, lng: g.longitude != null ? Number(g.longitude) : null, features: featById.get(u.id) ?? {} };
    }),
    { limit: 4, fields: unitFields },
  ).map((u: any) => {
    const raw: any = (units ?? []).find((x: any) => x.id === u.id);
    return { id: u.id, unit_number: raw?.unit_number, projectName: raw?.projects?.name, projectId: u.projectId, price: u.price, match: u.match };
  });

  const unitOptions: UnitOption[] = (units ?? []).map((u: any) => ({
    id: u.id,
    label: `${u.projects?.name ?? 'Project'} · Unit ${u.unit_number}`,
    projectId: u.project_id ?? null,
  }));
  const viewingRows: ViewingRow[] = (viewings ?? []).map((v: any) => ({
    id: v.id, scheduled_at: v.scheduled_at, status: v.status, notes: v.notes,
    unit_label: v.units?.unit_number ? `${v.projects?.name ?? 'Project'} · Unit ${v.units.unit_number}` : v.projects?.name ?? null,
    agent: v.agent?.full_name ?? null,
  }));
  const negotiationRows: NegotiationRow[] = (negotiations ?? []).map((n: any) => ({
    id: n.id, offered_price: n.offered_price, counter_offer: n.counter_offer, agreed_price: n.agreed_price,
    payment_terms: n.payment_terms, reservation_deposit: n.reservation_deposit, notes: n.notes, created_at: n.created_at,
    author: n.profiles?.full_name ?? null,
  }));
  const agentOptions: AgentOption[] = (agents ?? []) as AgentOption[];

  const quickLead = { id: lead.id, contact_id: lead.contact_id, full_name: contact?.full_name ?? null, email: contact?.email ?? null, phone: contact?.phone ?? null };
  const budget = lead.budget_min || lead.budget_max ? `${formatCurrency(Number(lead.budget_min ?? 0))}–${formatNumber(Number(lead.budget_max ?? 0))}` : '—';

  const dupes = await pDupes;
  return (
    <div className="space-y-6">
      <Link href="/crm/leads" className="inline-flex items-center gap-1 text-sm text-charcoal-600/70 hover:text-forest">
        <ArrowLeft size={14} strokeWidth={1.75} /> Leads
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <PriorityBadge score={score} />
            <span className="badge-neutral">{STATUS_EL[lead.status] ?? lead.status}</span>
            {pl?.is_returning && <span className="badge-champagne" title="Έχει ξαναγοράσει από εσάς">Επιστρέφων πελάτης</span>}
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

      {/* The one authoritative "what to do now" — always-fresh deterministic
          recommendation, one click from execution. */}
      <DuplicateBanner contactId={lead.contact_id} matches={dupes} canMerge={['admin', 'management', 'sales'].includes(profile.role)} />

      <LeadNextAction nba={leadScore.nba} source="heuristic" phone={contact?.phone ?? null} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="panel p-6">
            <div className="mb-4 flex items-center justify-between gap-2"><h4>Πορεία πώλησης</h4><LeadPipelinePicker leadId={lead.id} value={pl?.pipeline ?? null} pipelines={pipeCfg.pipelines} defaultKey={pipeCfg.defaultKey} /></div>
            <StatusPipeline leadId={lead.id} currentStatus={lead.status} pipeline={pipeline} lostReasons={pipeCfg.lostReasons} stageEnteredAt={pl?.stage_entered_at ?? null}
              lostReason={pl?.lost_reason ?? null} lostNote={pl?.lost_note ?? null} commissionInvoiceId={pl?.commission_invoice_id ?? null} />
            <div className="mt-5 grid grid-cols-3 gap-4 text-sm">
              <div><p className="eyebrow">Budget</p><p className="figure text-charcoal">{budget}</p></div>
              <div><p className="eyebrow">Source</p><p className="text-charcoal">{SOURCE_LABEL[lead.source] ?? lead.source}</p></div>
              <div><p className="eyebrow">Timeline to buy</p><p className="text-charcoal">{lead.timeline_to_buy ?? '—'}</p></div>
              <div><p className="eyebrow">Interested project</p><p className="text-charcoal">{(lead as any).projects?.name ?? '—'}</p></div>
              <div><p className="eyebrow">Last contacted</p><p className="text-charcoal">{lead.last_contacted_at ? formatDate(lead.last_contacted_at) : 'Never'}</p></div>
              <div><p className="eyebrow">Next follow-up</p><p className={`text-charcoal ${nextFollowUp && new Date(nextFollowUp).getTime() <= Date.now() ? 'text-signal-danger' : ''}`}>{nextFollowUp ? formatDate(nextFollowUp) : '—'}</p></div>
              <div><p className="eyebrow">Next action</p><p className="text-charcoal capitalize">{lead.next_action_type ? `${lead.next_action_type.replace('_', ' ')}${lead.next_action_date ? ` · ${formatDate(lead.next_action_date)}` : ''}` : '—'}</p></div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <LeadAreasEditor leadId={lead.id} initial={leadAreas} canEdit={effectiveCan(profile.role, profile.moduleAccess, 'leads', 'edit', profile.permissions)} />
            <LeadRequirementsEditor leadId={lead.id} fields={unitFields} initial={leadReq} canEdit={effectiveCan(profile.role, profile.moduleAccess, 'leads', 'edit', profile.permissions)} />
          </div>

          <RecommendedProperties matches={propertyMatches} mapHref={`/map?lead=${lead.id}`} />

          <ViewingScheduler leadId={lead.id} contactId={lead.contact_id} units={unitOptions} agents={agentOptions} viewings={viewingRows} />

          <NegotiationTracker leadId={lead.id} entries={negotiationRows} />

          <ContactTimeline contactId={lead.contact_id} leadId={lead.id} entries={timeline} />
        </div>

        <div className="space-y-6">
          <ContactMetaPanel
            contactId={lead.contact_id}
            initial={contactMeta}
            defs={tagDefs}
            canEdit={effectiveCan(profile.role, profile.moduleAccess, 'leads', 'edit', profile.permissions)}
          />

          <div className="panel p-6">
            <h4 className="mb-3">Assignment</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-charcoal-600/70">Owner</span><span className="font-medium text-charcoal">{ownerName ?? 'Unassigned'}</span></div>
              <div className="flex justify-between"><span className="text-charcoal-600/70">Assigned by</span><span className="text-charcoal">{assignerName ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-charcoal-600/70">Assigned</span><span className="figure text-charcoal-600">{lead.assigned_at ? formatDate(lead.assigned_at) : '—'}</span></div>
            </div>
            {(history ?? []).length > 0 && (
              <div className="mt-4 border-t border-stone-line pt-3">
                <p className="eyebrow mb-2">History</p>
                <ul className="space-y-1.5">
                  {(history ?? []).map((h: any) => (
                    <li key={h.id} className="text-xs text-charcoal-600/80">
                      → <span className="text-charcoal">{h.to?.full_name ?? 'Unassigned'}</span>
                      {h.by?.full_name ? ` by ${h.by.full_name}` : ''} · {formatDate(h.created_at)}
                    </li>
                  ))}
                </ul>
              </div>
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
                    <p className="figure text-sm text-charcoal">{formatDateTime(f.due_at)}</p>
                    {f.note && <p className="text-xs text-charcoal-600/70">{f.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Έξυπνος βοηθός: κλειστό από προεπιλογή, για να μη γεμίζει η σελίδα. */}
          <details className="panel group p-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-5 text-sm font-medium text-charcoal">
              <span>Έξυπνος βοηθός <span className="font-normal text-charcoal-600/60">· AI, πιθανότητα, στρατηγική, μήνυμα</span></span>
              <span className="text-charcoal-600/50 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="space-y-5 border-t border-stone-line p-5">
              <PredictiveScore score={leadScore} />
              <AIInsightPanel
                leadId={lead.id}
                score={lead.ai_score}
                reasoning={lead.ai_score_reasoning}
                summary={lead.ai_summary}
                nextSteps={lead.ai_next_steps}
                generatedAt={lead.ai_summary_generated_at}
              />
              <SalesCoach
                signals={{
                  status: lead.status,
                  buyerType: contact?.buyer_type,
                  language: contact?.preferred_language,
                  createdAt: lead.created_at,
                  lastContactedAt: lead.last_contacted_at,
                  firstResponseAt: lead.first_response_at,
                  aiScore: lead.ai_score,
                  priority: score,
                }}
              />
              <AssistantStrategy strategy={strategy} />
              <LeadAssistant leadId={lead.id} hasPhone={!!contact?.phone} hasEmail={!!contact?.email} />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
