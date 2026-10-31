import Link from 'next/link';
import { loadContactDuplicates } from '@/lib/duplicates';
import { DuplicateBanner } from '@/components/crm/DuplicateBanner';
import { notFound } from 'next/navigation';
import { Languages, MessageCircle, Clock, ShieldCheck, ShieldAlert } from 'lucide-react';
import { requirePermission, hasRight } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgSettings } from '@/lib/org-settings';
import { legalHold } from '@/lib/gdpr';
import { readMeta } from '@/lib/contact-meta-shared';
import { rankPropertiesForLead } from '@/lib/matching';
import { cleanRequirements, cleanValues } from '@/lib/unit-forms-shared';
import { pipelineOf } from '@/lib/pipeline-shared';
import { BEST_TIME, CHANNELS, EMPTY_KYC, KYC_STATUS, LANGUAGES, RISK_LABEL, cleanKyc, type RiskLevel } from '@/lib/kyc-shared';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { ContactMetaPanel } from '@/components/crm/ContactMetaPanel';
import { GdprPanel } from '@/components/crm/GdprPanel';
import { LifecycleBadges } from '@/components/crm/LifecycleBadges';
import { StatusPipeline } from '@/components/crm/StatusPipeline';
import { AIInsightPanel } from '@/components/crm/AIInsightPanel';
import { ContactTimeline, type TimelineEntry } from '@/components/crm/ContactTimeline';
import { UnitLinkCard } from '@/components/crm/UnitLinkCard';
import { RecommendedProperties } from '@/components/crm/RecommendedProperties';
import { ContactPreferences } from '@/components/crm/ContactPreferences';
import { ContactRelations, type RelationRow } from '@/components/crm/ContactRelations';
import { ContactDocuments, type DocRow } from '@/components/crm/ContactDocuments';
import { KycPanel } from '@/components/crm/KycPanel';
import { TaskList } from '@/components/ui/TaskList';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'overview', label: 'Επισκόπηση' },
  { key: 'activity', label: 'Σημειώσεις & μηνύματα' },
  { key: 'properties', label: 'Ακίνητα & προβολές' },
  { key: 'deals', label: 'Συναλλαγές & πληρωμές' },
  { key: 'documents', label: 'Έγγραφα' },
  { key: 'people', label: 'Οικογένεια & συνεργάτες' },
  { key: 'kyc', label: 'Ταυτότητα & AML' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
const VIEWING: Record<string, string> = { scheduled: 'Προγραμματισμένη', attended: 'Έγινε', no_show: 'Δεν ήρθε', cancelled: 'Ακυρώθηκε' };
const LEAD: Record<string, string> = { new: 'Νέο', contacted: 'Επικοινωνία', engaged: 'Ενδιαφέρον', qualified: 'Κατάλληλο', waiting: 'Αναμονή', viewing: 'Προβολή', offer: 'Προσφορά', negotiating: 'Διαπραγμάτευση', reserved: 'Κράτηση', won: 'Κλείσιμο', lost: 'Χάθηκε', nurture: 'Nurture', no_response: 'Χωρίς απάντηση', retargeting: 'Retargeting', reactivation: 'Επανενεργοποίηση' };
const RES: Record<string, string> = { active: 'Ενεργή', converted: 'Έγινε συμβόλαιο', cancelled: 'Ακυρώθηκε', expired: 'Έληξε' };
const CON: Record<string, string> = { draft: 'Προσχέδιο', sent: 'Στάλθηκε', signed: 'Υπογράφηκε', cancelled: 'Ακυρώθηκε' };
const label = (list: { v: string; l: string }[], v: string | null | undefined) => list.find((x) => x.v === v)?.l ?? null;

/**
 * Καρτέλα επαφής (βήμα 12) — όλη η εικόνα ενός προσώπου σε καρτέλες:
 * επισκόπηση, σημειώσεις/μηνύματα, ακίνητα & προβολές, συναλλαγές & πληρωμές,
 * έγγραφα, οικογένεια/συνεργάτες, ταυτότητα & AML.
 */
export default async function ContactDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const profile = await requirePermission('leads');
  const canEdit = effectiveCan(profile.role, profile.moduleAccess, 'leads', 'edit', profile.permissions);
  const tab: TabKey = (TABS.find((t) => t.key === searchParams.tab)?.key ?? 'overview') as TabKey;
  const supabase = await createSupabaseServerClient();
  const db = supabase as any;

  const { data: contact } = await supabase.from('contacts').select('*').eq('id', params.id).single();
  if (!contact) notFound();
  const c = contact as any;
  const settings = await getOrgSettings();
  const here = `/crm/${contact.id}`;
  const dupes = await loadContactDuplicates(contact.id);

  const [{ data: leads }, { data: kycRow, error: kycErr }, { count: relCount }, { count: docCount }, { count: viewCount }] = await Promise.all([
    supabase.from('leads').select('id, status, source, budget_min, budget_max, timeline_to_buy, message, ai_score, ai_score_reasoning, ai_summary, ai_next_steps, ai_summary_generated_at, preferred_project_id, created_at, pipeline, stage_entered_at, lost_reason, lost_note, commission_invoice_id, projects:preferred_project_id(name)').eq('contact_id', contact.id).order('created_at', { ascending: false }),
    db.from('contact_kyc').select('*, verifier:verified_by(full_name)').eq('contact_id', contact.id).maybeSingle(),
    db.from('contact_relations').select('id', { count: 'exact', head: true }).or(`contact_id.eq.${contact.id},related_contact_id.eq.${contact.id}`),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('entity_type', 'contact').eq('entity_id', contact.id),
    supabase.from('viewings').select('id', { count: 'exact', head: true }).eq('contact_id', contact.id),
  ]);
  const lead = (leads ?? [])[0] as any;
  const migMissing = !!kycErr && /does not exist|schema cache|Could not find/i.test(kycErr.message);
  const kyc = kycRow as any;
  const level = (kyc?.risk_level ?? null) as RiskLevel | null;
  const kycStatus = KYC_STATUS[kyc?.status ?? 'not_started'];
  const reviewOverdue = kyc?.review_due && kyc.review_due < new Date().toISOString().slice(0, 10);

  const counts: Partial<Record<TabKey, number>> = { properties: viewCount ?? 0, documents: docCount ?? 0, people: relCount ?? 0, deals: (leads ?? []).length };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">{contact.email}</p>
          <h1 className="text-3xl">{contact.full_name ?? 'Χωρίς όνομα'}</h1>
          <p className="mt-1 text-sm text-charcoal-600/80">{contact.phone} {contact.nationality ? `· ${contact.nationality}` : ''}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-charcoal-600">
            {c.preferred_language && <span className="flex items-center gap-1"><Languages size={12} /> {label(LANGUAGES, c.preferred_language) ?? c.preferred_language}</span>}
            {c.communication_preference && <span className="flex items-center gap-1"><MessageCircle size={12} /> {label(CHANNELS, c.communication_preference) ?? c.communication_preference}</span>}
            {c.best_time && <span className="flex items-center gap-1"><Clock size={12} /> {label(BEST_TIME, c.best_time)}{c.best_time_note ? ` · ${c.best_time_note}` : ''}</span>}
            <Link href={`${here}?tab=kyc`} className="flex items-center gap-1 hover:underline">
              {level && level !== 'low' ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
              AML: <span className={kycStatus?.tone}>{kycStatus?.label}</span>
              {level && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: RISK_LABEL[level].bg, color: RISK_LABEL[level].fg }}>{RISK_LABEL[level].label}</span>}
              {reviewOverdue && <span className="text-signal-danger">· επανέλεγχος!</span>}
            </Link>
          </p>
        </div>
        <LifecycleBadges isLead={contact.is_lead} isBuyer={contact.is_buyer} isInvestor={contact.is_investor} isHomeowner={contact.is_homeowner} isNewsletter={contact.is_newsletter_subscriber} />
      </div>

      <DuplicateBanner contactId={contact.id} matches={dupes} canMerge={canEdit && ['admin', 'management', 'sales'].includes(profile.role)} />

      <nav className="flex flex-wrap gap-1 border-b border-stone-line">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key === 'overview' ? here : `${here}?tab=${t.key}`} scroll={false}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.key ? 'border-forest font-medium text-forest' : 'border-transparent text-charcoal-600 hover:text-charcoal'}`}>
            {t.label}{(counts[t.key] ?? 0) > 0 && <span className="ml-1.5 rounded-full bg-stone px-1.5 text-[11px] text-charcoal-600">{counts[t.key]}</span>}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && await Overview()}
      {tab === 'activity' && await Activity()}
      {tab === 'properties' && await Properties()}
      {tab === 'deals' && await Deals()}
      {tab === 'documents' && await Documents()}
      {tab === 'people' && await People()}
      {tab === 'kyc' && (
        <KycPanel contactId={contact.id} initial={kyc ? cleanKyc(kyc) : EMPTY_KYC} aml={settings.aml} canEdit={canEdit} missing={migMissing} contactNationality={contact.nationality}
          meta={{ verifiedAt: kyc?.verified_at ?? null, verifiedBy: kyc?.verifier?.full_name ?? null, reviewDue: kyc?.review_due ?? null, updatedAt: kyc?.updated_at ?? null }} />
      )}
    </div>
  );

  /* ------------------------------------------------------------ tabs -- */

  async function Overview() {
    const canErase = effectiveCan(profile.role, profile.moduleAccess, 'leads', 'delete', profile.permissions);
    const gdprHold = canErase && !c.anonymized_at ? await legalHold(contact!.id) : { hold: null, missing: false };
    const { data: buyer } = await supabase.from('buyers').select('id, portal_eligible, portal_activated').eq('contact_id', contact!.id).maybeSingle();
    let unitLinkData = null;
    if (buyer) {
      const { data: unit } = await supabase.from('units').select('id, unit_number, sqm, price, projects(name)').eq('buyer_contact_id', contact!.id).limit(1).maybeSingle();
      const { data: reservation } = unit ? await supabase.from('reservations').select('deposit_amount, deposit_paid').eq('unit_id', unit.id).eq('buyer_contact_id', contact!.id).order('reserved_at', { ascending: false }).limit(1).maybeSingle() : { data: null };
      const { data: contract } = unit ? await supabase.from('contracts').select('id, status').eq('unit_id', unit.id).eq('buyer_contact_id', contact!.id).order('created_at', { ascending: false }).limit(1).maybeSingle() : { data: null };
      const { data: payments } = contract ? await supabase.from('payments').select('amount_paid, paid_at').eq('contract_id', (contract as any).id) : { data: [] };
      unitLinkData = {
        buyerId: buyer.id, portalEligible: buyer.portal_eligible, portalActivated: buyer.portal_activated,
        unit: unit ? { id: unit.id, unit_number: unit.unit_number, sqm: unit.sqm, price: unit.price, project_name: (unit as any).projects?.name ?? null } : null,
        reservation: reservation ?? null, contract: contract ? { status: (contract as any).status } : null, payments: payments ?? [],
      };
    }
    const { data: followUps } = await supabase.from('follow_up_tasks').select('id, note, due_at, is_done').eq('contact_id', contact!.id);
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {lead && (
            <div className="panel p-6">
              <div className="mb-4 flex items-center justify-between"><h4>Πορεία πώλησης</h4><Link href={`/crm/leads/${lead.id}`} className="text-xs text-forest hover:underline">Άνοιγμα lead →</Link></div>
              <StatusPipeline leadId={lead.id} currentStatus={lead.status} pipeline={pipelineOf(settings.pipelines, lead.pipeline ?? null)} lostReasons={settings.pipelines.lostReasons}
                stageEnteredAt={lead.stage_entered_at ?? null} lostReason={lead.lost_reason ?? null} lostNote={lead.lost_note ?? null} commissionInvoiceId={lead.commission_invoice_id ?? null} />
              <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div><p className="eyebrow">Budget</p><p className="figure text-charcoal">{lead.budget_min || lead.budget_max ? `€${formatNumber(Number(lead.budget_min ?? 0))}–${formatNumber(Number(lead.budget_max ?? 0))}` : '—'}</p></div>
                <div><p className="eyebrow">Πηγή</p><p className="capitalize text-charcoal">{lead.source}</p></div>
                <div><p className="eyebrow">Έργο ενδιαφέροντος</p><p className="text-charcoal">{lead.projects?.name ?? '—'}</p></div>
                <div><p className="eyebrow">Πότε θέλει να αγοράσει</p><p className="text-charcoal">{lead.timeline_to_buy ?? '—'}</p></div>
              </div>
            </div>
          )}
          {lead && <AIInsightPanel leadId={lead.id} score={lead.ai_score} reasoning={lead.ai_score_reasoning} summary={lead.ai_summary} nextSteps={lead.ai_next_steps} generatedAt={lead.ai_summary_generated_at} />}
          {unitLinkData && <UnitLinkCard data={unitLinkData} />}
          <div className="panel p-6">
            <h4 className="mb-3">Follow-ups</h4>
            <TaskList table="follow_up_tasks" tasks={(followUps ?? []).map((t) => ({ id: t.id, title: t.note ?? 'Follow up', due_at: t.due_at, is_done: t.is_done }))} />
          </div>
        </div>
        <div className="space-y-6">
          <ContactPreferences contactId={contact!.id} canEdit={canEdit && !migMissing} initial={{ language: c.preferred_language ?? null, channel: c.communication_preference ?? null, bestTime: c.best_time ?? null, bestTimeNote: c.best_time_note ?? null }} />
          <ContactMetaPanel contactId={contact!.id} initial={readMeta(contact)} defs={settings.tags} canEdit={canEdit} />
          <GdprPanel contactId={contact!.id}
            info={{ consentAt: c.consent_at ?? null, consentSource: c.consent_source ?? null, consentText: c.consent_text ?? null, marketing: !!c.marketing_opt_in, marketingAt: c.marketing_opt_in_at ?? null, anonymizedAt: c.anonymized_at ?? null }}
            hold={gdprHold.hold} missing={gdprHold.missing || !('anonymized_at' in c)} canEdit={canEdit} canErase={canErase} canExport={hasRight(profile, 'export_data')} />
        </div>
      </div>
    );
  }

  async function Activity() {
    const [{ data: notes }, { data: comms }] = await Promise.all([
      supabase.from('notes').select('id, body, created_at, profiles(full_name)').eq('entity_type', 'contact').eq('entity_id', contact!.id),
      supabase.from('contact_communications').select('id, channel, direction, summary, status, ai_generated, occurred_at, profiles(full_name)').eq('contact_id', contact!.id),
    ]);
    const timeline: TimelineEntry[] = [
      ...(notes ?? []).map((n: any) => ({ id: n.id, kind: 'note' as const, body: n.body, author: n.profiles?.full_name, occurred_at: n.created_at })),
      ...(comms ?? []).map((m: any) => ({ id: m.id, kind: 'communication' as const, body: m.summary, channel: m.channel, direction: m.direction, status: m.status, ai_generated: m.ai_generated, author: m.profiles?.full_name, occurred_at: m.occurred_at })),
    ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    return <div className="max-w-3xl"><ContactTimeline contactId={contact!.id} leadId={lead?.id} entries={timeline} /></div>;
  }

  async function Properties() {
    const { data: viewings } = await supabase.from('viewings').select('id, scheduled_at, status, notes, unit_id, project_id, units(unit_number), projects(name), agent:agent_id(full_name)').eq('contact_id', contact!.id).order('scheduled_at', { ascending: false });
    let matches: any[] = [];
    if (lead) {
      const [{ data: units }, { data: projGeo }, { data: extra }, { data: unitFeat }] = await Promise.all([
        supabase.from('units').select('id, unit_number, price, bedrooms, project_id, projects(name)').eq('status', 'available'),
        supabase.from('projects').select('id, name, location, latitude, longitude'),
        db.from('leads').select('preferred_areas, unit_requirements').eq('id', lead.id).maybeSingle(),
        db.from('units').select('id, custom_fields').eq('status', 'available'),
      ]);
      const fields = settings.unitForms.fields;
      const feat = new Map<string, any>(((unitFeat ?? []) as any[]).map((u) => [u.id, cleanValues(u.custom_fields, fields)]));
      const geo = new Map(((projGeo ?? []) as any[]).map((p) => [p.id, p]));
      matches = rankPropertiesForLead(
        { budgetMin: lead.budget_min, budgetMax: lead.budget_max, preferredProjectId: lead.preferred_project_id ?? null, areas: Array.isArray(extra?.preferred_areas) ? extra.preferred_areas : [], requirements: cleanRequirements(extra?.unit_requirements, fields) },
        ((units ?? []) as any[]).map((u) => { const g: any = geo.get(u.project_id) ?? {}; return { id: u.id, price: u.price, bedrooms: u.bedrooms, projectId: u.project_id, status: 'available', locationText: [g.location, g.name].filter(Boolean).join(', '), lat: g.latitude != null ? Number(g.latitude) : null, lng: g.longitude != null ? Number(g.longitude) : null, features: feat.get(u.id) ?? {} }; }),
        { limit: 8, fields },
      ).map((u: any) => { const raw: any = (units ?? []).find((x: any) => x.id === u.id); return { id: u.id, unit_number: raw?.unit_number, projectName: raw?.projects?.name, projectId: u.projectId, price: u.price, match: u.match }; });
    }
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          {lead ? <RecommendedProperties matches={matches} mapHref={`/map?lead=${lead.id}`} /> : <div className="panel p-6 text-sm text-charcoal-600/70">Η επαφή δεν έχει lead — τα ταιριάσματα βγαίνουν από το budget και τις προτιμήσεις του lead.</div>}
        </div>
        <div className="panel p-6">
          <h4 className="mb-3">Προβολές</h4>
          {(viewings ?? []).length === 0 ? <p className="text-sm text-charcoal-600/60">Καμία προβολή.</p> : (
            <ul className="divide-y divide-stone-line">
              {(viewings ?? []).map((v: any) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{formatDateTime(v.scheduled_at)}</span>
                    <span className="block text-xs text-charcoal-600/70">
                      {v.unit_id && v.project_id ? <Link href={`/projects/${v.project_id}/units/${v.unit_id}`} className="hover:underline">{v.projects?.name} · {v.units?.unit_number}</Link> : v.projects?.name ?? '—'}
                      {v.agent?.full_name ? ` · ${v.agent.full_name}` : ''}{v.notes ? ` · ${v.notes}` : ''}
                    </span>
                  </span>
                  <span className="badge-neutral">{VIEWING[v.status] ?? v.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  async function Deals() {
    const leadIds = (leads ?? []).map((l: any) => l.id);
    const [{ data: negs }, { data: resv }, { data: contracts }, { data: invoices }, { data: inv }] = await Promise.all([
      leadIds.length ? supabase.from('negotiations').select('id, lead_id, offered_price, counter_offer, agreed_price, created_at, units(unit_number)').in('lead_id', leadIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [] as any[] }),
      supabase.from('reservations').select('id, status, deposit_amount, deposit_paid, reserved_at, expires_at, units(id, unit_number, project_id, projects(name))').eq('buyer_contact_id', contact!.id).order('reserved_at', { ascending: false }),
      supabase.from('contracts').select('id, status, total_price, signed_at, created_at, units(id, unit_number, project_id, projects(name))').eq('buyer_contact_id', contact!.id).order('created_at', { ascending: false }),
      db.from('invoices').select('id, kind, number, issue_date, total, status').eq('contact_id', contact!.id).order('issue_date', { ascending: false }),
      contact!.is_investor ? supabase.from('investors').select('id').eq('contact_id', contact!.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const cIds = ((contracts ?? []) as any[]).map((x) => x.id);
    const [{ data: sched }, { data: pays }, { data: holdings }] = await Promise.all([
      cIds.length ? supabase.from('payment_schedules').select('id, contract_id, installment_number, description, due_date, amount').in('contract_id', cIds).order('installment_number') : Promise.resolve({ data: [] as any[] }),
      cIds.length ? supabase.from('payments').select('id, contract_id, payment_schedule_id, amount_paid, paid_at, method').in('contract_id', cIds).order('paid_at', { ascending: false }) : Promise.resolve({ data: [] as any[] }),
      (inv as any)?.id ? supabase.from('investor_holdings').select('id, capital_invested, ownership_percentage, projects(name), units(unit_number)').eq('investor_id', (inv as any).id) : Promise.resolve({ data: [] as any[] }),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    return (
      <div className="space-y-6">
        <div className="panel p-6">
          <h4 className="mb-3">Leads</h4>
          {(leads ?? []).length === 0 ? <p className="text-sm text-charcoal-600/60">Κανένα lead.</p> : (
            <table className="table-base w-full"><thead><tr><th>Ημερομηνία</th><th>Κατάσταση</th><th>Έργο</th><th>Budget</th><th>Πηγή</th></tr></thead>
              <tbody>{(leads ?? []).map((l: any) => (
                <tr key={l.id}><td><Link href={`/crm/leads/${l.id}`} className="text-forest hover:underline">{formatDate(l.created_at)}</Link></td><td>{LEAD[l.status] ?? l.status}</td><td>{l.projects?.name ?? '—'}</td>
                  <td className="figure">{l.budget_max ? `€${formatNumber(Number(l.budget_min ?? 0))}–${formatNumber(Number(l.budget_max))}` : '—'}</td><td className="capitalize">{l.source}</td></tr>
              ))}</tbody></table>
          )}
          {(negs ?? []).length > 0 && (
            <div className="mt-4">
              <p className="eyebrow mb-1">Διαπραγματεύσεις</p>
              <ul className="space-y-1 text-sm">{(negs ?? []).map((n: any) => (
                <li key={n.id} className="flex flex-wrap justify-between gap-2"><span>{formatDate(n.created_at)}{n.units?.unit_number ? ` · ${n.units.unit_number}` : ''}</span>
                  <span className="figure text-charcoal-600">προσφορά {formatCurrency(n.offered_price)} · αντιπρόταση {formatCurrency(n.counter_offer)} · συμφωνία {formatCurrency(n.agreed_price)}</span></li>
              ))}</ul>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="panel p-6">
            <h4 className="mb-3">Κρατήσεις</h4>
            {(resv ?? []).length === 0 ? <p className="text-sm text-charcoal-600/60">Καμία κράτηση.</p> : (
              <ul className="divide-y divide-stone-line text-sm">{(resv ?? []).map((r: any) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{r.units ? <Link href={`/projects/${r.units.project_id}/units/${r.units.id}`} className="font-medium hover:underline">{r.units.projects?.name} · {r.units.unit_number}</Link> : '—'}
                    <span className="block text-xs text-charcoal-600/70">{formatDate(r.reserved_at)}{r.expires_at && r.status === 'active' ? ` · λήγει ${formatDate(r.expires_at)}` : ''}</span></span>
                  <span className="text-right text-xs">{RES[r.status] ?? r.status}<span className="block">{formatCurrency(r.deposit_amount)} {r.deposit_paid ? '· πληρώθηκε' : r.deposit_amount ? '· εκκρεμεί' : ''}</span></span>
                </li>
              ))}</ul>
            )}
          </div>
          <div className="panel p-6">
            <h4 className="mb-3">Παραστατικά</h4>
            {(invoices ?? []).length === 0 ? <p className="text-sm text-charcoal-600/60">Κανένα.</p> : (
              <ul className="divide-y divide-stone-line text-sm">{(invoices ?? []).map((i: any) => (
                <li key={i.id} className="flex justify-between gap-2 py-2"><Link href={`/financials/invoices/${i.id}`} className="hover:underline">{i.number} · {formatDate(i.issue_date)}</Link><span className="figure">{formatCurrency(Number(i.total))}</span></li>
              ))}</ul>
            )}
          </div>
        </div>

        {((contracts ?? []) as any[]).map((k) => {
          const rows = ((sched ?? []) as any[]).filter((s) => s.contract_id === k.id);
          const paid = ((pays ?? []) as any[]).filter((p) => p.contract_id === k.id);
          const total = paid.reduce((s, p) => s + Number(p.amount_paid), 0);
          return (
            <div key={k.id} className="panel p-6">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h4>Συμβόλαιο · {k.units ? <Link href={`/projects/${k.units.project_id}/units/${k.units.id}`} className="hover:underline">{k.units.projects?.name} · {k.units.unit_number}</Link> : '—'}</h4>
                <span className="text-sm">{CON[k.status] ?? k.status} · <span className="figure">{formatCurrency(total)} πληρωμένα{k.total_price != null ? ` / ${formatCurrency(Number(k.total_price))}` : ''}</span></span>
              </div>
              {rows.length === 0 ? <p className="text-sm text-charcoal-600/60">Χωρίς δόσεις.</p> : (
                <table className="table-base w-full"><thead><tr><th>#</th><th>Δόση</th><th>Λήξη</th><th className="text-right">Ποσό</th><th className="text-right">Πληρώθηκε</th></tr></thead>
                  <tbody>{rows.map((s) => {
                    const p = paid.filter((x) => x.payment_schedule_id === s.id).reduce((a, x) => a + Number(x.amount_paid), 0);
                    const late = !!s.due_date && s.due_date < today && p < Number(s.amount);
                    return <tr key={s.id}><td className="figure">{s.installment_number}</td><td>{s.description ?? '—'}</td><td className={`figure ${late ? 'text-signal-danger' : ''}`}>{s.due_date ? formatDate(s.due_date) : '—'}</td><td className="figure text-right">{formatCurrency(Number(s.amount))}</td><td className="figure text-right">{p ? formatCurrency(p) : '—'}</td></tr>;
                  })}</tbody></table>
              )}
            </div>
          );
        })}

        {(holdings ?? []).length > 0 && (
          <div className="panel p-6">
            <h4 className="mb-3">Επενδύσεις</h4>
            <table className="table-base w-full"><thead><tr><th>Έργο</th><th>Μονάδα</th><th>Κεφάλαιο</th><th>Ποσοστό</th></tr></thead>
              <tbody>{(holdings ?? []).map((h: any) => <tr key={h.id}><td>{h.projects?.name ?? '—'}</td><td>{h.units?.unit_number ?? '—'}</td><td className="figure">{formatCurrency(Number(h.capital_invested ?? 0))}</td><td className="figure">{h.ownership_percentage ?? '—'}%</td></tr>)}</tbody></table>
          </div>
        )}
      </div>
    );
  }

  async function Documents() {
    const [{ data: own }, { data: units }, { data: contracts }] = await Promise.all([
      supabase.from('documents').select('id, title, category, bucket, storage_path, created_at').eq('entity_type', 'contact').eq('entity_id', contact!.id).order('created_at', { ascending: false }),
      supabase.from('units').select('id, unit_number').eq('buyer_contact_id', contact!.id),
      supabase.from('contracts').select('id').eq('buyer_contact_id', contact!.id),
    ]);
    const unitIds = ((units ?? []) as any[]).map((u) => u.id);
    const cIds = ((contracts ?? []) as any[]).map((x) => x.id);
    const [{ data: ud }, { data: cd }] = await Promise.all([
      unitIds.length ? supabase.from('documents').select('id, title, category, bucket, storage_path, created_at, entity_id').eq('entity_type', 'unit').in('entity_id', unitIds) : Promise.resolve({ data: [] as any[] }),
      cIds.length ? supabase.from('documents').select('id, title, category, bucket, storage_path, created_at').eq('entity_type', 'contract').in('entity_id', cIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const map = (d: any, source: string | null): DocRow => ({ id: d.id, title: d.title, category: d.category, bucket: d.bucket, path: d.storage_path, createdAt: d.created_at, source });
    const unitNo = new Map(((units ?? []) as any[]).map((u) => [u.id, u.unit_number]));
    return <ContactDocuments contactId={contact!.id} canEdit={canEdit} own={((own ?? []) as any[]).map((d) => map(d, null))}
      related={[...((ud ?? []) as any[]).map((d) => map(d, `μονάδα ${unitNo.get(d.entity_id) ?? ''}`)), ...((cd ?? []) as any[]).map((d) => map(d, 'συμβόλαιο'))]} />;
  }

  async function People() {
    const [{ data: out }, { data: inc }] = await Promise.all([
      db.from('contact_relations').select('id, relation, is_decision_maker, note, related_contact_id, related_name, related_phone, related_email, other:related_contact_id(full_name, email, phone)').eq('contact_id', contact!.id).order('created_at'),
      db.from('contact_relations').select('id, relation, is_decision_maker, note, contact_id, other:contact_id(full_name, email, phone)').eq('related_contact_id', contact!.id).order('created_at'),
    ]);
    const rows: RelationRow[] = [
      ...((out ?? []) as any[]).map((r) => ({ id: r.id, direction: 'out' as const, relation: r.relation, decisionMaker: r.is_decision_maker, note: r.note, contactId: r.related_contact_id, name: r.other?.full_name ?? r.related_name ?? '—', phone: r.other?.phone ?? r.related_phone, email: r.other?.email ?? r.related_email })),
      ...((inc ?? []) as any[]).map((r) => ({ id: r.id, direction: 'in' as const, relation: r.relation, decisionMaker: false, note: r.note, contactId: r.contact_id, name: r.other?.full_name ?? '—', phone: r.other?.phone ?? null, email: r.other?.email ?? null })),
    ];
    return <div className="max-w-3xl"><ContactRelations contactId={contact!.id} rows={rows} canEdit={canEdit} missing={migMissing} /></div>;
  }
}
