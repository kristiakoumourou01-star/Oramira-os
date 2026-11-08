import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BedDouble, Bath, Ruler, Layers, Wrench, Phone, Mail } from 'lucide-react';
import { UnitStatusBadge } from '@/components/units/UnitStatusBadge';
import { ReservationPanel } from '@/components/units/ReservationPanel';
import { PriceHistory } from '@/components/pricing/PriceHistory';
import { PaymentPlanEditor } from '@/components/pricing/PaymentPlanEditor';
import { CreateScheduleButton } from '@/components/pricing/CreateScheduleButton';
import { cleanPlan } from '@/lib/pricing-shared';
import { HandoverControl } from '@/components/units/HandoverControl';
import { DocumentList } from '@/components/ui/DocumentList';
import { UnitSpecsForm } from '@/components/units/UnitSpecsForm';
import { HouseLifecycle } from '@/components/units/HouseLifecycle';
import { ConstructionUpdates } from '@/components/construction/ConstructionUpdates';
import { loadUpdates } from '@/lib/construction';
import { UnitGallery } from '@/components/units/UnitGallery';
import { RoomsEditor } from '@/components/units/RoomsEditor';
import { CommissionCalculator } from '@/components/units/CommissionCalculator';
import { AgentPicker } from '@/components/units/AgentPicker';
import { LocationCard } from '@/components/units/LocationCard';
import { BookViewingButton, type ViewingContactOption } from '@/components/units/BookViewingButton';
import { DuplicateUnitButton } from '@/components/units/DuplicateUnitButton';
import { EditUnitButton } from '@/components/units/EditUnitButton';
import { MatchAudienceActions } from '@/components/units/MatchAudienceActions';
import { UnitFieldsForm } from '@/components/units/UnitFieldsForm';
import { typeKeyOf, cleanValues, type FieldValue } from '@/lib/unit-forms-shared';
import { getDocumentUrl } from '@/app/actions/storage';
import { effectiveCan } from '@/lib/permissions';
import { getOrgSettings } from '@/lib/org-settings';
import { getBranding } from '@/lib/branding';
import { watermarkPlan } from '@/lib/watermark-shared';
import { loadUnitMedia, matchingLeadsForUnit, cleanRooms } from '@/lib/unit-page';
import { formatDate, formatDateTime, formatNumber, formatCurrency } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'details', label: 'Λεπτομέρειες' },
  { key: 'matches', label: 'Αγοραστές που ταιριάζουν' },
  { key: 'viewings', label: 'Προβολές' },
  { key: 'documents', label: 'Έγγραφα' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const VIEWING_STATUS: Record<string, string> = { scheduled: 'Προγραμματισμένη', attended: 'Έγινε', no_show: 'Δεν ήρθε', cancelled: 'Ακυρώθηκε' };

export default async function UnitDetailPage({ params, searchParams }: { params: { id: string; unitId: string }; searchParams: { tab?: string } }) {
  const profile = await requirePermission('projects');
  const canEdit = effectiveCan(profile.role, profile.moduleAccess, 'projects', 'edit', profile.permissions);
  const canBook = effectiveCan(profile.role, profile.moduleAccess, 'leads', 'edit', profile.permissions);
  const canSeeLeads = effectiveCan(profile.role, profile.moduleAccess, 'leads', 'view', profile.permissions);
  const tab: TabKey = (TABS.find((t) => t.key === searchParams.tab)?.key ?? 'details') as TabKey;
  const supabase = await createSupabaseServerClient();

  const { data: unit } = await supabase
    .from('units')
    .select(
      `id, project_id, building_id, unit_number, floor, type, sqm, price, bedrooms, bathrooms, description, internal_specs,
       internal_sqm, covered_veranda_sqm, uncovered_veranda_sqm, storage_sqm, parking_spaces,
       plot_size_sqm, garden_sqm, has_pool,
       construction_progress, utility_water, utility_electricity, utility_internet, handover_checklist,
       status, handover_status, handover_date, warranty_start_date, warranty_period_months, buyer_contact_id,
       buildings(name), project_phases(name), projects(name, location)`
    )
    .eq('id', params.unitId)
    .single();
  if (!unit || unit.project_id !== params.id) notFound();

  // Payment plans (migration 0065): the unit's own, else the project's.
  const { data: planRow } = await (supabase as any).from('units').select('payment_plan, projects(payment_plan)').eq('id', unit.id).maybeSingle();
  const unitPlan = planRow?.payment_plan ? cleanPlan(planRow.payment_plan) : null;
  const projectPlan = cleanPlan(planRow?.projects?.payment_plan);
  // Step-8 columns (migration 0059) are read separately so the page works before it runs.
  const { data: extra } = await supabase.from('units').select('rooms, responsible_agent_id, commission_pct').eq('id', unit.id).maybeSingle();
  const { data: cf, error: cfErr } = await (supabase as any).from('units').select('custom_fields').eq('id', unit.id).maybeSingle();
  const { data: geo } = await supabase.from('projects').select('latitude, longitude').eq('id', unit.project_id).maybeSingle();
  const unitExtra = (extra ?? {}) as { rooms?: unknown; responsible_agent_id?: string | null; commission_pct?: number | null };
  const geoRow = (geo ?? {}) as { latitude?: number | null; longitude?: number | null };

  const [{ data: homeownerRow }, { data: reservationRaw }, { data: contract }, media, { data: staff }, settings] = await Promise.all([
    supabase.from('homeowners').select('id').eq('unit_id', unit.id).maybeSingle(),
    supabase
      .from('reservations')
      .select('id, buyer_contact_id, deposit_amount, deposit_paid, status, expires_at, converted_contract_id, contacts(full_name)')
      .eq('unit_id', unit.id)
      .order('reserved_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('contracts').select('id, status, total_price').eq('unit_id', unit.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    loadUnitMedia(unit.id),
    supabase.from('profiles').select('id, full_name, role').in('role', ['admin', 'sales', 'management']).order('full_name'),
    getOrgSettings(),
  ]);
  const { data: unitBuildings } = await supabase.from('buildings').select('id, name').eq('project_id', unit.project_id).order('name');
  const branding = await getBranding();
  const wm = watermarkPlan(settings.watermark, branding.companyName, settings.appearance.logoOnLight ?? branding.logoUrl);
  // Only ship the (possibly large) logo to the browser when it will be drawn.
  const watermark = { ...wm, logoUrl: wm.mode === 'logo' ? wm.logoUrl : null, logo: null };
  const updates = tab === 'details' ? await loadUpdates({ projectId: unit.project_id, unitId: unit.id, buildingId: (unit as any).building_id ?? null, limit: 20 }) : { items: [], missing: false };
  const agents = ((staff ?? []) as any[]).map((s) => ({ id: s.id as string, name: (s.full_name ?? 'Χωρίς όνομα') as string }));

  const [{ data: schedules }, { data: payments }, { data: defects }, { data: contacts }, { data: documents }, { data: ownership }, { data: viewings }] =
    await Promise.all([
      contract
        ? supabase.from('payment_schedules').select('id, installment_number, description, due_date, amount').eq('contract_id', contract.id).order('installment_number')
        : Promise.resolve({ data: [] as any[] }),
      contract
        ? supabase.from('payments').select('id, amount_paid, paid_at, method').eq('contract_id', contract.id).order('paid_at', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('maintenance_tickets').select('id, title, status, priority, created_at').eq('unit_id', unit.id).order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, full_name, email').or('is_lead.eq.true,is_buyer.eq.true').order('full_name').limit(500),
      supabase.from('documents').select('id, title, category, storage_path, bucket, created_at').eq('entity_type', 'unit').eq('entity_id', unit.id),
      supabase.from('unit_ownership_history').select('id, transfer_date, note, created_at, prev:previous_contact_id(full_name), next:new_contact_id(full_name)').eq('unit_id', unit.id).order('created_at', { ascending: false }),
      supabase.from('viewings').select('id, scheduled_at, status, notes, contact_id, lead_id, agent_id, contacts(full_name, phone, email)').eq('unit_id', unit.id).order('scheduled_at', { ascending: false }),
    ]);

  const unitForms = settings.unitForms;
  const unitTypeKey = typeKeyOf(unit.type, unitForms.types);
  const unitValues: Record<string, FieldValue> = cleanValues(cf?.custom_fields, unitForms.fields);
  const matches = canSeeLeads ? await matchingLeadsForUnit({ id: unit.id, price: unit.price != null ? Number(unit.price) : null, bedrooms: unit.bedrooms, sqm: unit.sqm != null ? Number(unit.sqm) : null, project_id: unit.project_id, status: unit.status, features: unitValues }) : [];

  // Clients for «Κλείσε προβολή»: matching buyers first, then everyone else.
  const seen = new Set<string>();
  const viewingContacts: ViewingContactOption[] = [];
  for (const m of matches) if (!seen.has(m.contactId)) { seen.add(m.contactId); viewingContacts.push({ contactId: m.contactId, leadId: m.leadId, label: `${m.name}${m.email ? ` — ${m.email}` : ''} · ταιριάζει ${m.match.score}%` }); }
  for (const c of (contacts ?? []) as any[]) if (!seen.has(c.id)) { seen.add(c.id); viewingContacts.push({ contactId: c.id, leadId: null, label: `${c.full_name ?? c.email}${c.full_name ? ` — ${c.email}` : ''}` }); }

  const reservation = reservationRaw
    ? {
        id: reservationRaw.id,
        buyer_contact_id: reservationRaw.buyer_contact_id,
        buyer_name: (reservationRaw as any).contacts?.full_name ?? null,
        deposit_amount: reservationRaw.deposit_amount,
        deposit_paid: reservationRaw.deposit_paid,
        status: reservationRaw.status,
        expires_at: reservationRaw.expires_at,
        converted_contract_id: reservationRaw.converted_contract_id,
      }
    : null;

  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount_paid), 0);
  const specs = (unit.internal_specs ?? {}) as Record<string, unknown>;
  const specEntries = Object.entries(specs);
  const price = unit.price != null ? Number(unit.price) : null;
  const sqm = unit.sqm != null ? Number(unit.sqm) : unit.internal_sqm != null ? Number(unit.internal_sqm) : null;
  const perSqm = price && sqm ? Math.round(price / sqm) : null;
  const here = `/projects/${unit.project_id}/units/${unit.id}`;
  const upcoming = ((viewings ?? []) as any[]).filter((v) => v.status === 'scheduled' && Date.parse(v.scheduled_at) >= Date.now()).length;
  const agentName = (id: string | null) => agents.find((a) => a.id === id)?.name ?? '—';
  const project = (unit as any).projects ?? {};

  return (
    <div className="space-y-6">
      <Link href={`/projects/${unit.project_id}`} className="inline-flex items-center gap-1 text-sm text-charcoal-600/70 hover:text-forest">
        <ArrowLeft size={14} strokeWidth={1.75} /> {project.name ?? 'Έργο'}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow">
            {(unit as any).buildings?.name ?? 'Χωρίς κτίριο'}
            {(unit as any).project_phases?.name ? ` · ${(unit as any).project_phases.name}` : ''}
          </p>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl">Μονάδα {unit.unit_number}</h1>{canEdit && <EditUnitButton unit={unit as any} buildings={(unitBuildings ?? []) as any} />}</div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-charcoal-600/80">
            {unit.type && <span>{unit.type}</span>}
            {unit.floor != null && <span className="flex items-center gap-1"><Layers size={13} strokeWidth={1.75} /> Όροφος {unit.floor}</span>}
            {sqm != null && <span className="flex items-center gap-1"><Ruler size={13} strokeWidth={1.75} /> <span className="figure">{formatNumber(sqm)}</span> m²</span>}
            {unit.bedrooms != null && <span className="flex items-center gap-1"><BedDouble size={13} strokeWidth={1.75} /> {unit.bedrooms}</span>}
            {unit.bathrooms != null && <span className="flex items-center gap-1"><Bath size={13} strokeWidth={1.75} /> {unit.bathrooms}</span>}
          </div>
          <AgentPicker unitId={unit.id} projectId={unit.project_id} agents={agents} value={unitExtra.responsible_agent_id ?? null} canEdit={canEdit} />
        </div>
        <div className="space-y-2 text-right">
          <UnitStatusBadge status={unit.status} />
          <p className="figure flex items-center justify-end gap-2 text-2xl text-forest">{price != null ? formatCurrency(price) : '—'} <PriceHistory unitId={unit.id} /></p>
          {perSqm != null && <p className="figure text-sm text-charcoal-600">{formatCurrency(perSqm)} / m²</p>}
          <div className="flex flex-wrap justify-end gap-2">
            {canEdit && <DuplicateUnitButton unitId={unit.id} projectId={unit.project_id} unitNumber={unit.unit_number} />}
            {canBook && <BookViewingButton unitId={unit.id} projectId={unit.project_id} contacts={viewingContacts} agents={agents} defaultAgent={unitExtra.responsible_agent_id ?? null} />}
          </div>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-stone-line">
        {TABS.filter((t) => t.key !== 'matches' || canSeeLeads).map((t) => {
          const count = t.key === 'matches' ? matches.length : t.key === 'viewings' ? upcoming : t.key === 'documents' ? (documents ?? []).length + media.items.filter((m) => m.kind === 'floor_plan').length : 0;
          return (
            <Link key={t.key} href={t.key === 'details' ? here : `${here}?tab=${t.key}`} scroll={false}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === t.key ? 'border-forest font-medium text-forest' : 'border-transparent text-charcoal-600 hover:text-charcoal'}`}>
              {t.label}{count > 0 && <span className="ml-1.5 rounded-full bg-stone px-1.5 text-[11px] text-charcoal-600">{count}</span>}
            </Link>
          );
        })}
      </nav>

      {tab === 'details' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <UnitGallery items={media.items} unitId={unit.id} projectId={unit.project_id} canEdit={canEdit} missing={media.missing} watermark={watermark} />

            {unit.description && (
              <div className="panel p-6">
                <h4 className="mb-2">Περιγραφή</h4>
                <p className="whitespace-pre-line text-sm text-charcoal-600/80">{unit.description}</p>
              </div>
            )}

            <UnitFieldsForm unitId={unit.id} projectId={unit.project_id} cfg={unitForms} typeKey={unitTypeKey} values={unitValues} canEdit={canEdit} missing={!!cfErr} />

            <RoomsEditor unitId={unit.id} projectId={unit.project_id} initial={cleanRooms(unitExtra.rooms)} canEdit={canEdit} missing={extra === null} />

            <UnitSpecsForm
              unitId={unit.id}
              projectId={unit.project_id}
              specs={{
                internal_sqm: unit.internal_sqm,
                covered_veranda_sqm: unit.covered_veranda_sqm,
                uncovered_veranda_sqm: unit.uncovered_veranda_sqm,
                storage_sqm: unit.storage_sqm,
                parking_spaces: unit.parking_spaces,
                plot_size_sqm: unit.plot_size_sqm,
                garden_sqm: unit.garden_sqm,
                has_pool: unit.has_pool,
                handover_date: unit.handover_date,
              }}
            />

            {specEntries.length > 0 && (
              <div className="panel p-6">
                <h4 className="mb-4">Τεχνικά χαρακτηριστικά</h4>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {specEntries.map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-stone-line pb-1.5">
                      <dt className="capitalize text-charcoal-600/70">{k.replace(/_/g, ' ')}</dt>
                      <dd className="text-charcoal">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Payment plan + payment history (linked through the contract) */}
            <div className="panel p-6">
              <div className="mb-4 flex items-center justify-between">
                <h4>Πρόγραμμα πληρωμών</h4>
                {contract && (
                  <span className="figure text-sm text-charcoal-600/70">
                    {formatCurrency(totalPaid)} πληρωμένα
                    {contract.total_price != null && ` / ${formatCurrency(Number(contract.total_price))}`}
                  </span>
                )}
              </div>
              {!contract ? (
                !unitPlan && !projectPlan.length ? (
                  <p className="text-sm text-charcoal-600/70">Δεν υπάρχει συμβόλαιο ακόμη. Ορίστε το πρόγραμμα πληρωμών του έργου στον <Link href={`/projects/${unit.project_id}/prices`} className="underline hover:text-forest">Τιμοκατάλογο</Link>.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-charcoal-600/70">Προγραμματισμένες δόσεις για την τιμή της μονάδας. Γίνονται δόσεις του συμβολαίου όταν η κράτηση γίνει συμβόλαιο.</p>
                    <PaymentPlanEditor key={JSON.stringify(unitPlan)} initial={unitPlan ?? projectPlan} projectPlan={projectPlan} target={{ kind: 'unit', projectId: unit.project_id, unitId: unit.id, custom: !!unitPlan }} price={price} canEdit={canEdit} />
                  </div>
                )
              ) : (schedules ?? []).length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-charcoal-600/70">Δεν έχουν οριστεί δόσεις σε αυτό το συμβόλαιο.</p>
                  {canEdit && (unitPlan ?? projectPlan).length > 0 && <CreateScheduleButton contractId={contract.id} />}
                </div>
              ) : (
                <table className="table-base w-full">
                  <thead><tr><th>#</th><th>Περιγραφή</th><th>Λήξη</th><th>Ποσό</th></tr></thead>
                  <tbody>
                    {(schedules ?? []).map((s) => (
                      <tr key={s.id}>
                        <td className="figure">{s.installment_number}</td>
                        <td>{s.description ?? '—'}</td>
                        <td className="figure text-charcoal-600">{s.due_date ? formatDate(s.due_date) : '—'}</td>
                        <td className="figure">{formatCurrency(Number(s.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {(payments ?? []).length > 0 && (
                <div className="mt-4 border-t border-stone-line pt-3">
                  <p className="eyebrow mb-2">Ιστορικό πληρωμών</p>
                  <ul className="space-y-1.5 text-sm">
                    {(payments ?? []).map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span className="text-charcoal-600/70">{formatDate(p.paid_at)} · {p.method ?? 'πληρωμή'}</span>
                        <span className="figure text-charcoal">{formatCurrency(Number(p.amount_paid))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="panel p-6">
              <h4 className="mb-4 flex items-center gap-2"><Wrench size={15} strokeWidth={1.75} className="text-olive" /> Ιστορικό βλαβών</h4>
              {(defects ?? []).length === 0 ? (
                <p className="text-sm text-charcoal-600/70">Κανένα αίτημα συντήρησης για αυτή τη μονάδα.</p>
              ) : (
                <ul className="divide-y divide-stone-line">
                  {(defects ?? []).map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium text-charcoal">{d.title}</p>
                        <p className="text-xs text-charcoal-600/60">{formatDate(d.created_at)}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="badge-neutral capitalize">{d.priority}</span>
                        <span className="badge-neutral capitalize">{d.status.replace(/_/g, ' ')}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ConstructionUpdates projectId={unit.project_id} buildings={[]} units={[{ id: unit.id, unit_number: unit.unit_number, building_id: null }]}
              items={updates.items} missing={updates.missing} canEdit={canEdit} watermark={watermark} fixedUnit={{ id: unit.id, unit_number: unit.unit_number }} />

            <HouseLifecycle
              unitId={unit.id}
              projectId={unit.project_id}
              constructionProgress={unit.construction_progress ?? 0}
              water={unit.utility_water ?? 'not_connected'}
              electricity={unit.utility_electricity ?? 'not_connected'}
              internet={unit.utility_internet ?? 'not_connected'}
              checklist={Array.isArray(unit.handover_checklist) ? (unit.handover_checklist as any[]) : []}
            />

            <div className="panel p-6">
              <h4 className="mb-4">Ιστορικό ιδιοκτησίας</h4>
              {(ownership ?? []).length === 0 ? (
                <p className="text-sm text-charcoal-600/70">Καμία μεταβίβαση.</p>
              ) : (
                <ol className="space-y-3 border-l border-stone-line pl-4">
                  {(ownership ?? []).map((o: any) => (
                    <li key={o.id} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-champagne" />
                      <p className="text-sm text-charcoal">
                        {o.prev?.full_name ? `${o.prev.full_name} → ` : ''}<span className="font-medium">{o.next?.full_name ?? '—'}</span>
                      </p>
                      {o.note && <p className="text-xs text-charcoal-600/70">{o.note}</p>}
                      <p className="text-xs text-charcoal-600/50">{formatDate(o.transfer_date ?? o.created_at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <ReservationPanel
              unitId={unit.id}
              projectId={unit.project_id}
              unitStatus={unit.status}
              reservation={reservation}
              contacts={(contacts ?? []) as any[]}
              contractStatus={contract?.status ?? null}
             defaultHoldDays={settings.reservations.holdDays} />
            <CommissionCalculator unitId={unit.id} projectId={unit.project_id} price={price} initialPct={unitExtra.commission_pct != null ? Number(unitExtra.commission_pct) : null} vatRate={settings.invoices.defaultVat} canEdit={canEdit} />
            <LocationCard projectId={unit.project_id} projectName={project.name ?? ''} location={project.location ?? null} lat={geoRow.latitude != null ? Number(geoRow.latitude) : null} lng={geoRow.longitude != null ? Number(geoRow.longitude) : null} canEdit={canEdit} back={here} />
            <HandoverControl
              unitId={unit.id}
              projectId={unit.project_id}
              handoverStatus={unit.handover_status}
              handoverDate={unit.handover_date}
              warrantyStartDate={unit.warranty_start_date}
              warrantyPeriodMonths={unit.warranty_period_months}
              hasBuyer={!!unit.buyer_contact_id}
              homeownerActivated={!!homeownerRow}
            />
          </div>
        </div>
      )}

      {tab === 'matches' && canSeeLeads && (
        <div className="panel overflow-x-auto p-0">
          <div className="border-b border-stone-line px-6 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4>Αγοραστές που ταιριάζουν</h4>
                <p className="text-xs text-charcoal-600/60">Ανοιχτά leads που ταιριάζουν σε αυτή τη μονάδα: προϋπολογισμός, περιοχή που θέλουν (σε σχέση με την τοποθεσία του έργου), έργο που προτιμούν και ό,τι ζητούν στα πεδία της μονάδας (θέα, επίπλωση κ.λπ.){unit.status !== 'available' ? ' (η μονάδα δεν είναι διαθέσιμη — η λίστα δείχνει ποιοι θα ταίριαζαν)' : ''}.</p>
              </div>
              {matches.length > 0 && <MatchAudienceActions contactIds={[...new Set(matches.map((m) => m.contactId))]} name={`${(unit as any).projects?.name ?? ''} ${unit.unit_number}`.trim()} />}
            </div>
          </div>
          {matches.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-charcoal-600/70">Κανένα ανοιχτό lead δεν ταιριάζει ακόμη. Συμπληρώστε προϋπολογισμό στα leads για καλύτερο ταίριασμα.</p>
          ) : (
            <table className="table-base w-full min-w-[640px]">
              <thead><tr><th>Πελάτης</th><th>Προϋπολογισμός</th><th>Περιοχές</th><th>Ταίριασμα</th><th>Γιατί</th><th /></tr></thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.leadId}>
                    <td>
                      <Link href={`/crm/${m.contactId}`} className="font-medium text-forest hover:underline">{m.name}</Link>
                      <div className="flex gap-3 text-[11px] text-charcoal-600/70">
                        {m.phone && <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 hover:text-forest"><Phone size={11} /> {m.phone}</a>}
                        {m.email && <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 hover:text-forest"><Mail size={11} /> {m.email}</a>}
                      </div>
                    </td>
                    <td className="figure text-sm text-charcoal-600">{m.budgetMin || m.budgetMax ? `${m.budgetMin ? formatCurrency(m.budgetMin) : '—'} – ${m.budgetMax ? formatCurrency(m.budgetMax) : '—'}` : '—'}</td>
                    <td className="text-xs text-charcoal-600">{m.areas.length ? m.areas.join(', ') : 'Οπουδήποτε'}</td>
                    <td><span className={m.match.tier === 'strong' ? 'badge-forest' : 'badge-champagne'}>{m.match.score}%</span></td>
                    <td className="text-xs text-charcoal-600">{m.match.reasons.join(' · ')}</td>
                    <td className="text-right">{canBook && <BookViewingButton unitId={unit.id} projectId={unit.project_id} contacts={viewingContacts} agents={agents} defaultAgent={unitExtra.responsible_agent_id ?? null} preset={viewingContacts.find((c) => c.leadId === m.leadId) ?? null} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'viewings' && (
        <div className="panel overflow-x-auto p-0">
          <div className="flex items-center justify-between border-b border-stone-line px-6 py-4">
            <h4>Προβολές αυτής της μονάδας</h4>
          </div>
          {(viewings ?? []).length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-charcoal-600/70">Καμία προβολή ακόμη. Πατήστε «Κλείσε προβολή» πάνω δεξιά.</p>
          ) : (
            <table className="table-base w-full min-w-[640px]">
              <thead><tr><th>Πότε</th><th>Πελάτης</th><th>Πωλητής</th><th>Κατάσταση</th><th>Σημείωση</th></tr></thead>
              <tbody>
                {((viewings ?? []) as any[]).map((v) => (
                  <tr key={v.id}>
                    <td className="text-sm">{formatDateTime(v.scheduled_at)}</td>
                    <td><Link href={`/crm/${v.contact_id}`} className="text-sm font-medium text-forest hover:underline">{v.contacts?.full_name ?? '—'}</Link></td>
                    <td className="text-sm text-charcoal-600">{agentName(v.agent_id)}</td>
                    <td><span className={v.status === 'attended' ? 'badge-forest' : v.status === 'scheduled' ? 'badge-champagne' : 'badge-neutral'}>{VIEWING_STATUS[v.status] ?? v.status}</span></td>
                    <td className="text-xs text-charcoal-600">{v.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'documents' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="panel p-6">
            <h4 className="mb-4">Έγγραφα μονάδας</h4>
            <DocumentList documents={documents ?? []} getSignedUrl={getDocumentUrl.bind(null, 'contracts')} />
          </div>
          <div className="panel p-6">
            <h4 className="mb-4">Κατόψεις</h4>
            {media.items.filter((m) => m.kind === 'floor_plan').length === 0 ? (
              <p className="text-sm text-charcoal-600/70">Καμία κάτοψη. Ανεβάστε από την καρτέλα «Λεπτομέρειες» → Φωτογραφίες & βίντεο → Κάτοψη.</p>
            ) : (
              <ul className="space-y-2">
                {media.items.filter((m) => m.kind === 'floor_plan').map((m) => (
                  <li key={m.id}><a href={m.url ?? '#'} target="_blank" rel="noreferrer" className="text-sm text-forest hover:underline">{m.caption ?? (m.isPdf ? 'Κάτοψη (PDF)' : 'Κάτοψη')}</a></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
