import Link from 'next/link';
import { ContactRolesPanel, ContactHistory } from '@/components/crm/ContactRolesPanel';
import { loadContactEvents, loadStaff } from '@/lib/contacts-hub';
import { rolesFromRow, ROLE_EL, type ContactStatus } from '@/lib/contacts-hub-shared';
import { loadContactDuplicates } from '@/lib/duplicates';
import { DuplicateBanner } from '@/components/crm/DuplicateBanner';
import { notFound } from 'next/navigation';
import { Languages, MessageCircle, Clock, ShieldCheck, ShieldAlert, CalendarDays, Mail, Home, Pencil } from 'lucide-react';
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
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'overview', label: 'Πληροφορίες' },
  { key: 'documents', label: 'Έγγραφα' },
  { key: 'people', label: 'Οικογένεια & συνεργάτες' },
  { key: 'deals', label: 'Αγορά & πληρωμές' },
  { key: 'properties', label: 'Ακίνητα & viewings' },
  { key: 'activity', label: 'Επικοινωνία' },
  { key: 'kyc', label: 'Ταυτότητα & AML' },
] as const;
// Όπως στο FitnessCRM: κύριες καρτέλες (pill) και, στο «Προφίλ», υπο-καρτέλες.
const MAIN = [
  { key: 'profile', label: 'Προφίλ', tabs: ['overview', 'documents', 'people'] },
  { key: 'deals', label: 'Αγορά & πληρωμές', tabs: ['deals'] },
  { key: 'properties', label: 'Ακίνητα & viewings', tabs: ['properties'] },
  { key: 'activity', label: 'Επικοινωνία', tabs: ['activity'] },
  { key: 'kyc', label: 'Ταυτότητα & AML', tabs: ['kyc'] },
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
export default async function ContactDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; edit?: string } }) {
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

  const [{ data: leads }, { data: kycRow, error: kycErr }, { count: relCount }, { count: docCount }, { count: viewCount }, { data: stageRows }] = await Promise.all([
    supabase.from('leads').select('id, status, source, budget_min, budget_max, timeline_to_buy, message, ai_score, ai_score_reasoning, ai_summary, ai_next_steps, ai_summary_generated_at, preferred_project_id, created_at, pipeline, stage_entered_at, lost_reason, lost_note, commission_invoice_id, projects:preferred_project_id(name)').eq('contact_id', contact.id).order('created_at', { ascending: false }),
    db.from('contact_kyc').select('*, verifier:verified_by(full_name)').eq('contact_id', contact.id).maybeSingle(),
    db.from('contact_relations').select('id', { count: 'exact', head: true }).or(`contact_id.eq.${contact.id},related_contact_id.eq.${contact.id}`),
    supabase.from('documents').select('id', { count: 'exact', head: true }).eq('entity_type', 'contact').eq('entity_id', contact.id),
    supabase.from('viewings').select('id', { count: 'exact', head: true }).eq('contact_id', contact.id),
    db.from('leads').select('id, stage').eq('contact_id', contact.id), // 0072
  ]);
  const stageById: Record<string, string | null> = Object.fromEntries(((stageRows ?? []) as any[]).map((r) => [r.id, r.stage]));
  const lead = (leads ?? [])[0] as any;
  const migMissing = !!kycErr && /does not exist|schema cache|Could not find/i.test(kycErr.message);
  const kyc = kycRow as any;
  const level = (kyc?.risk_level ?? null) as RiskLevel | null;
  const kycStatus = KYC_STATUS[kyc?.status ?? 'not_started'];
  const reviewOverdue = kyc?.review_due && kyc.review_due < new Date().toISOString().slice(0, 10);

  const { data: myContracts } = await db.from('contracts').select('id, total_price, status').eq('buyer_contact_id', contact.id).neq('status', 'cancelled');
  const cIds = ((myContracts ?? []) as any[]).map((x) => x.id);
  const { data: myPays } = cIds.length ? await db.from('payments').select('amount_paid').in('contract_id', cIds) : { data: [] };
  const contractValue = ((myContracts ?? []) as any[]).reduce((n, x) => n + Number(x.total_price ?? 0), 0);
  const paidSum = ((myPays ?? []) as any[]).reduce((n, x) => n + Number(x.amount_paid ?? 0), 0);
  const balance = Math.max(0, contractValue - paidSum);
  const STATUS_LABEL: Record<string, string> = { active: 'Ενεργός', inactive: 'Ανενεργός', do_not_contact: 'Όχι επικοινωνία', archived: 'Αρχειοθετημένος' };
  const joined = contact.created_at ? new Date(contact.created_at).toLocaleDateString(DATE_TAG[currentLocale().lang], { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const interest = lead?.projects?.name ?? (lead ? (LEAD[lead.status] ?? lead.status) : null);
  const counts: Partial<Record<TabKey, number>> = { properties: viewCount ?? 0, documents: docCount ?? 0, people: relCount ?? 0, deals: (leads ?? []).length };

  return (
    <div className="space-y-5">
      <Link href="/crm/customers" className="inline-flex items-center gap-1 text-[14px] text-charcoal-600 hover:text-charcoal">‹ Πίσω στους πελάτες</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-forest/[0.09] text-[16px] font-semibold text-forest">{(contact.full_name ?? '?').split(' ').map((x: string) => x[0]).slice(0, 2).join('').toUpperCase()}</span>
          <div className="min-w-0">
            <h1 className="font-display text-3xl text-charcoal" data-no-tr>{contact.full_name ?? 'Χωρίς όνομα'}</h1>
            <p className="text-[14px] text-charcoal-600" data-no-tr>{[contact.email, contact.phone].filter(Boolean).join(' · ') || '—'}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-charcoal-600"><CalendarDays size={13} /> Εγγραφή {joined}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {contact.phone && <a href={`https://wa.me/${String(contact.phone).replace(/[^\d]/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-stone-line bg-white px-3 py-2 text-sm text-charcoal hover:border-forest/40"><MessageCircle size={15} /> Μήνυμα</a>}
          <Link href={`/marketing?tab=email&ids=${contact.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-line bg-white px-3 py-2 text-sm text-charcoal hover:border-forest/40"><Mail size={15} /> Email</Link>
          <Link href={`${here}?tab=properties`} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-line bg-white px-3 py-2 text-sm text-charcoal hover:border-forest/40"><Home size={15} /> Ακίνητα</Link>
          <Link href="/calendar" className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-sm font-semibold text-white hover:bg-forest/90"><CalendarDays size={15} /> Νέο viewing</Link>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Κατάσταση', STATUS_LABEL[c.status ?? 'active'] ?? c.status],
          ['Ενδιαφέρον', interest ?? '—'],
          ['Ομάδα', (c.groups ?? []).join(', ') || 'Χωρίς ομάδα'],
          ['Υπόλοιπο', formatCurrency(balance)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-stone-line bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"><p className="text-[13px] text-charcoal-600">{k}</p><p className="mt-1 text-[19px] font-semibold leading-snug text-charcoal" data-no-tr>{v}</p></div>
        ))}
      </div>

      <DuplicateBanner contactId={contact.id} matches={dupes} canMerge={canEdit && ['admin', 'management', 'sales'].includes(profile.role)} />

      <div className="space-y-2">
        <nav className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-line bg-white p-1">
          {MAIN.map((m) => {
            const on = (m.tabs as readonly string[]).includes(tab);
            const n = m.tabs.reduce((x, k) => x + (counts[k as TabKey] ?? 0), 0);
            return <Link key={m.key} href={m.tabs[0] === 'overview' ? here : `${here}?tab=${m.tabs[0]}`} scroll={false} className={`rounded-lg px-3.5 py-1.5 text-[14px] font-medium transition ${on ? 'bg-forest/[0.09] text-forest' : 'text-charcoal-600 hover:text-charcoal'}`}>{m.label}{m.key !== 'profile' && n > 0 && <span className="ml-1.5 rounded-full bg-forest/10 px-1.5 text-[11px] text-forest">{n}</span>}</Link>;
          })}
        </nav>
        {['overview', 'documents', 'people'].includes(tab) && (
          <nav className="flex gap-1 border-b border-stone-line">
            {TABS.filter((t) => ['overview', 'documents', 'people'].includes(t.key)).map((t) => (
              <Link key={t.key} href={t.key === 'overview' ? here : `${here}?tab=${t.key}`} scroll={false} className={`-mb-px border-b-2 px-3 py-2 text-[14px] ${tab === t.key ? 'border-forest font-medium text-charcoal' : 'border-transparent text-charcoal-600 hover:text-charcoal'}`}>{t.label}{(counts[t.key] ?? 0) > 0 && <span className="ml-1 text-[12px] text-charcoal-600">({counts[t.key]})</span>}</Link>
            ))}
          </nav>
        )}
      </div>

      {tab === 'overview' && await Overview()}
      {tab === 'activity' && await Activity()}
      {tab === 'properties' && await Properties()}
      {tab === 'deals' && await Deals()}
      {tab === 'documents' && await Documents()}
      {tab === 'people' && await People()}
      {tab === 'kyc' && await Gdpr()}
      {tab === 'kyc' && (
        <KycPanel contactId={contact.id} initial={kyc ? cleanKyc(kyc) : EMPTY_KYC} aml={settings.aml} canEdit={canEdit} missing={migMissing} contactNationality={contact.nationality}
          meta={{ verifiedAt: kyc?.verified_at ?? null, verifiedBy: kyc?.verifier?.full_name ?? null, reviewDue: kyc?.review_due ?? null, updatedAt: kyc?.updated_at ?? null }} />
      )}
    </div>
  );

  /* ------------------------------------------------------------ tabs -- */

  async function Overview() {
    const hub = { staff: await loadStaff() };
    if (searchParams.edit === '1' && canEdit) {
      return (
        <div className="space-y-5">
          <div className="flex items-center justify-between"><h2 className="text-[18px] font-semibold text-charcoal">Επεξεργασία στοιχείων</h2><Link href={here} scroll={false} className="btn-primary text-sm">Τέλος</Link></div>
          <div className="grid gap-5 lg:grid-cols-2">
            <ContactRolesPanel contactId={contact!.id} roles={rolesFromRow(c)} status={(c.status ?? 'active') as ContactStatus} ownerId={c.owner_id ?? null} staff={hub.staff} canEdit={canEdit} />
            <ContactPreferences contactId={contact!.id} canEdit={canEdit && !migMissing} initial={{ language: c.preferred_language ?? null, channel: c.communication_preference ?? null, bestTime: c.best_time ?? null, bestTimeNote: c.best_time_note ?? null }} />
            <ContactMetaPanel contactId={contact!.id} initial={readMeta(contact)} defs={settings.tags} canEdit={canEdit} />
          </div>
          <p className="text-[13px] text-charcoal-600">Ταυτότητα, ημ. γέννησης, διεύθυνση και επάγγελμα αλλάζουν στην καρτέλα «Ταυτότητα & AML».</p>
        </div>
      );
    }
    const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
    const dmy = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString(DATE_TAG[currentLocale().lang], { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
    const nm = String(contact!.full_name ?? '').trim().split(/\s+/);
    const InfoCard = ({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) => (
      <div className="rounded-2xl border border-stone-line bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h3 className="mb-3 text-[18px] font-semibold text-charcoal">{title}</h3>
        <dl className="space-y-3">{rows.map(([k, v]) => <div key={k} className="flex items-baseline justify-between gap-4 text-[15px]"><dt className="text-charcoal-600">{k}</dt><dd className="text-right font-medium text-charcoal" data-no-tr>{v}</dd></div>)}</dl>
      </div>
    );
    const BUYER_TYPE: Record<string, string> = { investor: 'Επενδυτής', end_user: 'Ιδιοκατοίκηση', holiday: 'Εξοχικό', relocation: 'Μετεγκατάσταση', other: 'Άλλο' };
    const SRC: Record<string, string> = { website: 'Ιστοσελίδα', meta: 'Facebook / Instagram', google: 'Google', organic: 'Οργανικά', referral: 'Σύσταση', walk_in: 'Επίσκεψη', whatsapp: 'WhatsApp', other: 'Άλλο', manual: 'Καταχώριση' };
    const ownerName = hub.staff.find((x) => x.id === c.owner_id)?.name ?? '—';
    return (
      <div className="space-y-5">
      <div className="flex justify-end gap-2">
        {canEdit && <Link href={`${here}?edit=1`} scroll={false} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-line bg-white px-3 py-1.5 text-sm text-charcoal hover:border-forest/40"><Pencil size={14} /> Επεξεργασία</Link>}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <InfoCard title="Προσωπικά στοιχεία" rows={[
          ['Όνομα', dash(nm[0])], ['Επώνυμο', dash(nm.slice(1).join(' '))], ['Ημ. γέννησης', dmy(kyc?.date_of_birth)], ['Αρ. ταυτότητας / διαβατηρίου', dash(kyc?.id_number)],
          ['Εθνικότητα', dash(contact!.nationality ?? kyc?.nationality)], ['Τύπος αγοραστή', dash(BUYER_TYPE[c.buyer_type] ?? c.buyer_type)], ['Εγγραφή', joined], ['Επάγγελμα', dash(kyc?.occupation)],
        ]} />
        <InfoCard title="Επικοινωνία & διεύθυνση" rows={[
          ['Email', dash(contact!.email)], ['Κινητό', dash(contact!.phone)], ['Γλώσσα', dash(label(LANGUAGES, c.preferred_language) ?? c.preferred_language)],
          ['Προτιμώμενο κανάλι', dash(label(CHANNELS, c.communication_preference) ?? c.communication_preference)], ['Καλύτερη ώρα', dash(label(BEST_TIME, c.best_time))],
          ['Λαμβάνει marketing', c.marketing_opt_in ? 'Ναι' : 'Όχι'], ['Διεύθυνση', dash(kyc?.address)], ['Χώρα διαμονής', dash(kyc?.residence_country)],
        ]} />
        <InfoCard title="Ομαδοποίηση" rows={[
          ['Ομάδες', (c.groups ?? []).join(', ') || 'Χωρίς ομάδα'], ['Ιδιότητες', rolesFromRow(c).map((r) => ROLE_EL[r]).join(', ') || '—'],
          ['Υπεύθυνος', ownerName], ['Πηγή', dash(SRC[c.first_touch_source ?? 'manual'] ?? c.first_touch_source)], ['AML', dash(kycStatus?.label)],
        ]} />
        <div className="rounded-2xl border border-stone-line bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-3 text-[18px] font-semibold text-charcoal">Tags</h3>
          {(c.tags ?? []).length ? <div className="flex flex-wrap gap-1.5">{(c.tags as string[]).map((t) => <span key={t} className="rounded-full border border-stone-line px-2.5 py-0.5 text-[13px] text-charcoal" data-no-tr>{t}</span>)}</div> : <p className="text-[15px] text-charcoal-600">Δεν βρέθηκαν tags.</p>}
        </div>
      </div>
      <InfoCard title="Σχόλιο" rows={[['Σχόλιο', dash(lead?.message ?? kyc?.notes)]]} />

      </div>
    );
  }

  async function Gdpr() {
    const canErase = effectiveCan(profile.role, profile.moduleAccess, 'leads', 'delete', profile.permissions);
    const gdprHold = canErase && !c.anonymized_at ? await legalHold(contact!.id) : { hold: null, missing: false };
    return (
      <GdprPanel contactId={contact!.id}
        info={{ consentAt: c.consent_at ?? null, consentSource: c.consent_source ?? null, consentText: c.consent_text ?? null, marketing: !!c.marketing_opt_in, marketingAt: c.marketing_opt_in_at ?? null, anonymizedAt: c.anonymized_at ?? null }}
        hold={gdprHold.hold} missing={gdprHold.missing || !('anonymized_at' in c)} canEdit={canEdit} canErase={canErase} canExport={hasRight(profile, 'export_data')} />
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
    const { events, names } = await loadContactEvents(contact!.id);
    const { data: followUps } = await supabase.from('follow_up_tasks').select('id, note, due_at, is_done').eq('contact_id', contact!.id);
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><ContactTimeline contactId={contact!.id} leadId={lead?.id} entries={timeline} /></div>
        <div className="space-y-6">
          <div className="panel p-6"><h4 className="mb-3">Follow-ups</h4><TaskList table="follow_up_tasks" tasks={(followUps ?? []).map((t) => ({ id: t.id, title: t.note ?? 'Follow up', due_at: t.due_at, is_done: t.is_done }))} /></div>
          <ContactHistory events={events} names={names} />
        </div>
      </div>
    );
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
        {lead && (
          <div className="panel p-6">
            <div className="mb-4 flex items-center justify-between"><h4>Πορεία πώλησης</h4><Link href={`/crm/leads/${lead.id}`} className="text-xs text-forest hover:underline">Άνοιγμα lead →</Link></div>
            <StatusPipeline leadId={lead.id} currentStatus={lead.status} currentStage={stageById[lead.id] ?? null} pipeline={pipelineOf(settings.pipelines, lead.pipeline ?? null)} lostReasons={settings.pipelines.lostReasons}
              stageEnteredAt={lead.stage_entered_at ?? null} lostReason={lead.lost_reason ?? null} lostNote={lead.lost_note ?? null} commissionInvoiceId={lead.commission_invoice_id ?? null} />
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
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
          <h4 className="mb-3">Leads</h4>
          {(leads ?? []).length === 0 ? <p className="text-sm text-charcoal-600/60">Κανένα lead.</p> : (
            <div className="overflow-x-auto"><table className="table-base w-full"><thead><tr><th>Ημερομηνία</th><th>Κατάσταση</th><th>Έργο</th><th>Budget</th><th>Πηγή</th></tr></thead>
              <tbody>{(leads ?? []).map((l: any) => (
                <tr key={l.id}><td><Link href={`/crm/leads/${l.id}`} className="text-forest hover:underline">{formatDate(l.created_at)}</Link></td><td>{LEAD[l.status] ?? l.status}</td><td>{l.projects?.name ?? '—'}</td>
                  <td className="figure">{l.budget_max ? `€${formatNumber(Number(l.budget_min ?? 0))}–${formatNumber(Number(l.budget_max))}` : '—'}</td><td className="capitalize">{l.source}</td></tr>
              ))}</tbody></table></div>
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
                <div className="overflow-x-auto"><table className="table-base w-full"><thead><tr><th>#</th><th>Δόση</th><th>Λήξη</th><th className="text-right">Ποσό</th><th className="text-right">Πληρώθηκε</th></tr></thead>
                  <tbody>{rows.map((s) => {
                    const p = paid.filter((x) => x.payment_schedule_id === s.id).reduce((a, x) => a + Number(x.amount_paid), 0);
                    const late = !!s.due_date && s.due_date < today && p < Number(s.amount);
                    return <tr key={s.id}><td className="figure">{s.installment_number}</td><td>{s.description ?? '—'}</td><td className={`figure ${late ? 'text-signal-danger' : ''}`}>{s.due_date ? formatDate(s.due_date) : '—'}</td><td className="figure text-right">{formatCurrency(Number(s.amount))}</td><td className="figure text-right">{p ? formatCurrency(p) : '—'}</td></tr>;
                  })}</tbody></table></div>
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
