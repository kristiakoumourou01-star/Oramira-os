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
import { DealHeader, StageBar, DealSummary, DealComposer, FocusList, DealHistory, type HistoryItem, type Person } from '@/components/sales/DealParts';
import { activityLabel } from '@/lib/activity-types';
import { StatusPipeline } from '@/components/crm/StatusPipeline';
import { LeadPipelinePicker } from '@/components/crm/LeadPipelinePicker';
import { pipelineOf, stageOf, STATUS_EL, daysSince } from '@/lib/pipeline-shared';
import { AIInsightPanel } from '@/components/crm/AIInsightPanel';
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
import { formatDate, formatNumber, formatCurrency } from '@/lib/format';

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
  const [contactMeta, { tags: tagDefs, pipelines: pipeCfg }, { data: pl }, { data: stRow }] = await Promise.all([
    getContactMeta(lead.contact_id), getOrgSettings(),
    // Pipeline fields (migration 0068) read separately so the page works before it runs.
    (supabase as any).from('leads').select('pipeline, stage_entered_at, lost_reason, lost_note, is_returning, commission_invoice_id').eq('id', params.id).maybeSingle(),
    (supabase as any).from('leads').select('stage').eq('id', params.id).maybeSingle(), // 0072 — χωρίς αυτό: null
  ]);
  // Deal (0075): πεδία, ολοκληρωμένες activities, changelog.
  const [{ data: dealRow }, { data: openActs }, { data: doneActs }, { data: changes }] = await Promise.all([
    (supabase as any).from('leads').select('title, value, currency, expected_close_date, labels, followers, archived_at, won_at, lost_at').eq('id', params.id).maybeSingle(),
    (supabase as any).from('follow_up_tasks').select('id, due_at, note, type, priority, duration_min, owner:assigned_to(full_name)').eq('lead_id', params.id).eq('is_done', false).order('due_at'),
    (supabase as any).from('follow_up_tasks').select('id, due_at, done_at, note, type, owner:assigned_to(full_name)').eq('lead_id', params.id).eq('is_done', true).order('due_at', { ascending: false }).limit(100),
    (supabase as any).from('lead_changes').select('id, field, old_value, new_value, created_at, actor:actor_id(full_name)').eq('lead_id', params.id).order('created_at', { ascending: false }).limit(200),
  ]);
  const pipeline = pipelineOf(pipeCfg, pl?.pipeline ?? null);

  const contact = (lead as any).contacts;
  const ownerName = (lead as any).owner?.full_name ?? null;
  const assignerName = (lead as any).assigner?.full_name ?? null;

  const [{ data: followUps }, { data: notes }, { data: comms }, { data: units }, { data: history2 }, { data: viewings }, { data: negotiations }, { data: agents }] = await pMain;

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
  const canEdit = effectiveCan(profile.role, profile.moduleAccess, 'leads', 'edit', profile.permissions);
  const curStage = stageOf(pipeline, lead.status, stRow?.stage ?? null);
  const dealVal = dealRow?.value != null ? Number(dealRow.value) : null;
  const budgetVal = lead.budget_max != null ? Number(lead.budget_max) : lead.budget_min != null ? Number(lead.budget_min) : null;
  const closed = lead.status === 'won' || ['lost', 'nurture', 'no_response', 'retargeting', 'reactivation'].includes(lead.status);
  const agentName = new Map(((agents ?? []) as any[]).map((a) => [a.id, a.full_name]));
  const stageName = (k: string | null) => (k ? pipeline.stages.find((x) => x.key === k)?.label ?? k : '—');
  const FIELD: Record<string, string> = { title: 'Τίτλος', value: 'Αξία', status: 'Κατάσταση', stage: 'Στάδιο', pipeline: 'Pipeline', assigned_to: 'Υπεύθυνος', expected_close_date: 'Αναμ. κλείσιμο', labels: 'Labels', budget_min: 'Budget από', budget_max: 'Budget έως', source: 'Πηγή', lost_reason: 'Λόγος', preferred_project_id: 'Έργο', archived_at: 'Αρχείο' };
  const showVal = (f: string, v: string | null) => {
    if (v == null || v === '') return '—';
    if (f === 'assigned_to') return agentName.get(v) ?? '—';
    if (f === 'stage') return stageName(v);
    if (f === 'status') return STATUS_EL[v] ?? v;
    if (f === 'pipeline') return pipeCfg.pipelines.find((x) => x.key === v)?.name ?? v;
    if (f === 'value' || f === 'budget_min' || f === 'budget_max') return formatCurrency(Number(v));
    if (f === 'lost_reason') return pipeCfg.lostReasons.find((x) => x.key === v)?.label ?? v;
    if (f === 'labels') return v.replace(/[{}]/g, '').split(',').filter(Boolean).map((k) => pipeCfg.dealLabels.find((x) => x.key === k)?.name ?? k).join(', ') || '—';
    if (f === 'archived_at') return 'ναι';
    if (f === 'expected_close_date') return formatDate(v);
    return v;
  };
  const history: HistoryItem[] = [
    ...(notes ?? []).map((n: any) => ({ id: n.id, kind: 'note' as const, at: n.created_at, who: n.profiles?.full_name ?? null, title: 'Σημείωση', body: n.body })),
    ...(comms ?? []).map((c: any) => ({ id: c.id, kind: 'comm' as const, at: c.occurred_at, who: c.profiles?.full_name ?? null, title: `${c.channel === 'phone' ? 'Κλήση' : c.channel === 'whatsapp' ? 'WhatsApp' : c.channel === 'email' ? 'Email' : c.channel} · ${c.direction === 'inbound' ? 'εισερχόμενο' : 'εξερχόμενο'}`, body: c.summary })),
    ...((doneActs ?? []) as any[]).map((a) => ({ id: a.id, kind: 'activity' as const, at: a.done_at ?? a.due_at, who: a.owner?.full_name ?? null, title: `✓ ${a.note || activityLabel(a.type)}`, icon: a.type ?? 'task' })),
    ...((changes ?? []) as any[]).map((c) => ({ id: c.id, kind: 'change' as const, at: c.created_at, who: c.actor?.full_name ?? 'Σύστημα', title: `${FIELD[c.field] ?? c.field}: ${showVal(c.field, c.old_value)} → ${showVal(c.field, c.new_value)}` })),
    { id: 'created', kind: 'change' as const, at: lead.created_at, who: null, title: 'Το deal δημιουργήθηκε' },
  ].sort((a, b) => b.at.localeCompare(a.at));
  const ageDays = daysSince(lead.created_at) ?? 0;
  const lastTouch = [lead.last_contacted_at, ...((doneActs ?? []) as any[]).map((a) => a.done_at ?? a.due_at)].filter(Boolean).sort().at(-1) ?? lead.created_at;
  const inactiveDays = daysSince(lastTouch) ?? 0;
  const typeCount = new Map<string, number>();
  for (const a of (doneActs ?? []) as any[]) typeCount.set(a.type ?? 'task', (typeCount.get(a.type ?? 'task') ?? 0) + 1);
  const totalDone = [...typeCount.values()].reduce((x, y) => x + y, 0);
  const userCount = new Map<string, number>();
  for (const h of history) if (h.who && h.kind !== 'change') userCount.set(h.who, (userCount.get(h.who) ?? 0) + 1);
  const Box = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="panel p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-charcoal-600/70">{title}</p>{children}</section>
  );
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-3 py-1 text-sm"><span className="text-charcoal-600/70">{k}</span><span className="text-right text-charcoal">{v}</span></div>;

  return (
    <div className="space-y-4">
      <DealHeader leadId={lead.id} title={dealRow?.title ?? null} fallbackTitle={contact?.full_name ?? 'Deal'} status={lead.status} ownerId={lead.assigned_to ?? null}
        agents={(agents ?? []) as Person[]} followers={dealRow?.followers ?? []} archived={!!dealRow?.archived_at} lostReasons={pipeCfg.lostReasons}
        wonStageKey={pipeline.stages.find((x) => x.status === 'won')?.key ?? null} contactName={contact?.full_name ?? 'Deal'} />
      <div className="flex flex-wrap items-center gap-2">
        <LeadPipelinePicker leadId={lead.id} value={pl?.pipeline ?? null} pipelines={pipeCfg.pipelines} defaultKey={pipeCfg.defaultKey} />
        {pl?.is_returning && <span className="badge-champagne" title="Έχει ξαναγοράσει από εσάς">Επιστρέφων πελάτης</span>}
        <PriorityBadge score={score} />
      </div>
      {closed
        ? <StatusPipeline leadId={lead.id} currentStatus={lead.status} currentStage={stRow?.stage ?? null} pipeline={pipeline} lostReasons={pipeCfg.lostReasons} stageEnteredAt={pl?.stage_entered_at ?? null}
            lostReason={pl?.lost_reason ?? null} lostNote={pl?.lost_note ?? null} commissionInvoiceId={pl?.commission_invoice_id ?? null} />
        : <StageBar leadId={lead.id} pipeline={pipeline} status={lead.status} stage={stRow?.stage ?? null} enteredAt={pl?.stage_entered_at ?? null} />}

      <DuplicateBanner contactId={lead.contact_id} matches={dupes} canMerge={['admin', 'management', 'sales'].includes(profile.role)} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
        {/* Αριστερά: Summary, Details, Πρόσωπο, Overview — όπως Pipedrive */}
        <div className="space-y-4">
          <Box title="Summary">
            <DealSummary leadId={lead.id} value={dealVal} budgetFallback={budgetVal} currency={dealRow?.currency ?? 'EUR'} expectedClose={dealRow?.expected_close_date ?? null}
              labels={dealRow?.labels ?? []} allLabels={pipeCfg.dealLabels} probability={curStage?.probability ?? (lead.status === 'won' ? 100 : 0)} weighted={(dealVal ?? budgetVal ?? 0) * ((curStage?.probability ?? 0) / 100)} />
          </Box>
          <Box title="Πρόσωπο">
            <Link href={`/crm/${lead.contact_id}`} className="font-semibold text-charcoal hover:text-forest" data-no-tr>{contact?.full_name ?? '—'}</Link>
            {contact?.phone && <Row k="Τηλέφωνο" v={<a href={`tel:${contact.phone}`} className="text-forest hover:underline">{contact.phone}</a>} />}
            {contact?.email && <Row k="Email" v={<a href={`mailto:${contact.email}`} className="break-all text-forest hover:underline">{contact.email}</a>} />}
            {contact?.nationality && <Row k="Υπηκοότητα" v={contact.nationality} />}
            {contact?.preferred_language && <Row k="Γλώσσα" v={contact.preferred_language} />}
            <div className="mt-2"><LeadQuickActions lead={quickLead} size="sm" /></div>
          </Box>
          <Box title="Details">
            <Row k="Budget" v={budget} />
            <Row k="Πηγή" v={SOURCE_LABEL[lead.source] ?? lead.source} />
            <Row k="Πότε θέλει να αγοράσει" v={lead.timeline_to_buy ?? '—'} />
            <Row k="Έργο ενδιαφέροντος" v={(lead as any).projects?.name ?? '—'} />
            <Row k="Τελευταία επικοινωνία" v={lead.last_contacted_at ? formatDate(lead.last_contacted_at) : '—'} />
            {lead.message && <p className="mt-2 rounded-lg bg-stone/60 p-2 text-sm text-charcoal-600" data-no-tr>{lead.message}</p>}
          </Box>
          <ContactMetaPanel contactId={lead.contact_id} initial={contactMeta} defs={tagDefs} canEdit={canEdit} />
          <Box title="Overview">
            <Row k="Ηλικία deal" v={ageDays < 1 ? '< 1 μέρα' : `${ageDays} μέρες`} />
            <Row k="Αδράνεια (μέρες)" v={inactiveDays} />
            <Row k="Δημιουργήθηκε" v={formatDate(lead.created_at)} />
            {dealRow?.won_at && <Row k="Won" v={formatDate(dealRow.won_at)} />}
            {dealRow?.lost_at && <Row k="Lost" v={formatDate(dealRow.lost_at)} />}
            {totalDone > 0 && (
              <div className="mt-3 border-t border-stone-line pt-2">
                <p className="mb-1 text-xs font-medium text-charcoal-600/70">Top activities</p>
                {[...typeCount.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => <Row key={t} k={activityLabel(t)} v={`${n} · ${Math.round((n / totalDone) * 100)}%`} />)}
              </div>
            )}
            {userCount.size > 0 && (
              <div className="mt-3 border-t border-stone-line pt-2">
                <p className="mb-1 text-xs font-medium text-charcoal-600/70">Πιο ενεργοί χρήστες</p>
                {[...userCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([u, n]) => <Row key={u} k={u} v={n} />)}
              </div>
            )}
          </Box>
          <Box title="Ανάθεση">
            <Row k="Υπεύθυνος" v={ownerName ?? '—'} />
            <Row k="Ανατέθηκε από" v={assignerName ?? '—'} />
            <Row k="Ανατέθηκε" v={lead.assigned_at ? formatDate(lead.assigned_at) : '—'} />
            {(history2 ?? []).length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-stone-line pt-2">
                {(history2 ?? []).map((h: any) => <li key={h.id} className="text-xs text-charcoal-600/80">→ <span className="text-charcoal">{h.to?.full_name ?? '—'}</span>{h.by?.full_name ? ` · ${h.by.full_name}` : ''} · {formatDate(h.created_at)}</li>)}
              </ul>
            )}
          </Box>
          <div className="grid gap-4">
            <LeadAreasEditor leadId={lead.id} initial={leadAreas} canEdit={canEdit} />
            <LeadRequirementsEditor leadId={lead.id} fields={unitFields} initial={leadReq} canEdit={canEdit} />
          </div>
        </div>

        {/* Δεξιά: composer, Focus, ακίνητα/προβολές/διαπραγμάτευση, ιστορικό */}
        <div className="min-w-0 space-y-4">
          <DealComposer leadId={lead.id} contactId={lead.contact_id} phone={contact?.phone ?? null} email={contact?.email ?? null} agents={(agents ?? []) as Person[]} ownerId={lead.assigned_to ?? null} filesHref={`/crm/${lead.contact_id}?tab=documents`} />
          <LeadNextAction nba={leadScore.nba} source="heuristic" phone={contact?.phone ?? null} />
          <FocusList items={((openActs ?? []) as any[]).map((a) => ({ id: a.id, due_at: a.due_at, note: a.note, type: a.type ?? null, priority: a.priority ?? null, duration_min: a.duration_min ?? null, owner: a.owner?.full_name ?? null }))} />
          <div className="flex flex-wrap justify-end"><ConvertToReservation leadId={lead.id} contactId={lead.contact_id} units={availableUnits} alreadyReserved={lead.status === 'reserved' || lead.status === 'won'} /></div>
          <RecommendedProperties matches={propertyMatches} mapHref={`/map?lead=${lead.id}`} />
          <ViewingScheduler leadId={lead.id} contactId={lead.contact_id} units={unitOptions} agents={agentOptions} viewings={viewingRows} />
          <NegotiationTracker leadId={lead.id} entries={negotiationRows} />
          <div className="panel p-4"><DealHistory items={history} /></div>
          <details className="panel group p-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-5 text-sm font-medium text-charcoal">
              <span>Έξυπνος βοηθός <span className="font-normal text-charcoal-600/60">· AI, πιθανότητα, στρατηγική, μήνυμα</span></span>
              <span className="text-charcoal-600/50 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="space-y-5 border-t border-stone-line p-5">
              <PredictiveScore score={leadScore} />
              <AIInsightPanel leadId={lead.id} score={lead.ai_score} reasoning={lead.ai_score_reasoning} summary={lead.ai_summary} nextSteps={lead.ai_next_steps} generatedAt={lead.ai_summary_generated_at} />
              <SalesCoach signals={{ status: lead.status, buyerType: contact?.buyer_type, language: contact?.preferred_language, createdAt: lead.created_at, lastContactedAt: lead.last_contacted_at, firstResponseAt: lead.first_response_at, aiScore: lead.ai_score, priority: score }} />
              <AssistantStrategy strategy={strategy} />
              <LeadAssistant leadId={lead.id} hasPhone={!!contact?.phone} hasEmail={!!contact?.email} />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
