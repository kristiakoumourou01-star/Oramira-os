import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BedDouble, Bath, Ruler, Layers, Wrench } from 'lucide-react';
import { UnitStatusBadge } from '@/components/units/UnitStatusBadge';
import { ReservationPanel } from '@/components/units/ReservationPanel';
import { HandoverControl } from '@/components/units/HandoverControl';
import { DocumentList } from '@/components/ui/DocumentList';
import { UnitSpecsForm } from '@/components/units/UnitSpecsForm';
import { HouseLifecycle } from '@/components/units/HouseLifecycle';
import { getDocumentUrl } from '@/app/actions/storage';
import { formatDate, formatNumber, formatCurrency } from '@/lib/format';

export default async function UnitDetailPage({ params }: { params: { id: string; unitId: string } }) {
  await requirePermission('projects');
  const supabase = await createSupabaseServerClient();

  const { data: unit } = await supabase
    .from('units')
    .select(
      `id, project_id, unit_number, floor, type, sqm, price, bedrooms, bathrooms, description, internal_specs,
       internal_sqm, covered_veranda_sqm, uncovered_veranda_sqm, storage_sqm, parking_spaces,
       plot_size_sqm, garden_sqm, has_pool,
       construction_progress, utility_water, utility_electricity, utility_internet, handover_checklist,
       status, handover_status, handover_date, warranty_start_date, warranty_period_months, buyer_contact_id,
       buildings(name), project_phases(name), projects(name)`
    )
    .eq('id', params.unitId)
    .single();
  if (!unit || unit.project_id !== params.id) notFound();

  const { data: homeownerRow } = await supabase
    .from('homeowners')
    .select('id')
    .eq('unit_id', unit.id)
    .maybeSingle();

  const { data: reservationRaw } = await supabase
    .from('reservations')
    .select('id, buyer_contact_id, deposit_amount, deposit_paid, status, expires_at, converted_contract_id, contacts(full_name)')
    .eq('unit_id', unit.id)
    .order('reserved_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, status, total_price')
    .eq('unit_id', unit.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: schedules }, { data: payments }, { data: defects }, { data: contacts }, { data: documents }, { data: ownership }] =
    await Promise.all([
      contract
        ? supabase.from('payment_schedules').select('id, installment_number, description, due_date, amount').eq('contract_id', contract.id).order('installment_number')
        : Promise.resolve({ data: [] as any[] }),
      contract
        ? supabase.from('payments').select('id, amount_paid, paid_at, method').eq('contract_id', contract.id).order('paid_at', { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('maintenance_tickets').select('id, title, status, priority, created_at').eq('unit_id', unit.id).order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, full_name, email').or('is_lead.eq.true,is_buyer.eq.true').order('full_name').limit(200),
      supabase.from('documents').select('id, title, category, storage_path, bucket, created_at').eq('entity_type', 'unit').eq('entity_id', unit.id),
      supabase.from('unit_ownership_history').select('id, transfer_date, note, created_at, prev:previous_contact_id(full_name), next:new_contact_id(full_name)').eq('unit_id', unit.id).order('created_at', { ascending: false }),
    ]);

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

  return (
    <div className="space-y-6">
      <Link href={`/projects/${unit.project_id}`} className="inline-flex items-center gap-1 text-sm text-charcoal-600/70 hover:text-forest">
        <ArrowLeft size={14} strokeWidth={1.75} /> {(unit as any).projects?.name ?? 'Project'}
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow mb-1">
            {(unit as any).buildings?.name ?? 'Unassigned building'}
            {(unit as any).project_phases?.name ? ` · ${(unit as any).project_phases.name}` : ''}
          </p>
          <h1 className="text-3xl">House {unit.unit_number}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-charcoal-600/80">
            {unit.type && <span>{unit.type}</span>}
            {unit.floor != null && <span className="flex items-center gap-1"><Layers size={13} strokeWidth={1.75} /> Floor {unit.floor}</span>}
            {unit.sqm != null && <span className="flex items-center gap-1"><Ruler size={13} strokeWidth={1.75} /> <span className="figure">{unit.sqm}</span> m²</span>}
            {unit.bedrooms != null && <span className="flex items-center gap-1"><BedDouble size={13} strokeWidth={1.75} /> {unit.bedrooms}</span>}
            {unit.bathrooms != null && <span className="flex items-center gap-1"><Bath size={13} strokeWidth={1.75} /> {unit.bathrooms}</span>}
          </div>
        </div>
        <div className="text-right">
          <UnitStatusBadge status={unit.status} />
          <p className="figure mt-2 text-2xl text-forest">
            {unit.price != null ? `${formatCurrency(Number(unit.price))}` : '—'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {unit.description && (
            <div className="panel p-6">
              <h4 className="mb-2">Overview</h4>
              <p className="text-sm text-charcoal-600/80">{unit.description}</p>
            </div>
          )}

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

          <div className="panel p-6">
            <h4 className="mb-4">Internal specifications</h4>
            {specEntries.length === 0 ? (
              <p className="text-sm text-charcoal-600/70">No internal specs recorded.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {specEntries.map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-stone-line pb-1.5">
                    <dt className="capitalize text-charcoal-600/70">{k.replace(/_/g, ' ')}</dt>
                    <dd className="text-charcoal">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* Payment plan + payment history (linked through the contract) */}
          <div className="panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <h4>Payment plan</h4>
              {contract && (
                <span className="figure text-sm text-charcoal-600/70">
                  €{formatNumber(totalPaid)} paid
                  {contract.total_price != null && ` / ${formatCurrency(Number(contract.total_price))}`}
                </span>
              )}
            </div>
            {!contract ? (
              <p className="text-sm text-charcoal-600/70">No contract yet — payment plan appears once a reservation is converted.</p>
            ) : (schedules ?? []).length === 0 ? (
              <p className="text-sm text-charcoal-600/70">No installments scheduled on this contract yet.</p>
            ) : (
              <table className="table-base w-full">
                <thead><tr><th>#</th><th>Description</th><th>Due</th><th>Amount</th></tr></thead>
                <tbody>
                  {(schedules ?? []).map((s) => (
                    <tr key={s.id}>
                      <td className="figure">{s.installment_number}</td>
                      <td>{s.description ?? '—'}</td>
                      <td className="figure text-charcoal-600">{s.due_date ? formatDate(s.due_date) : '—'}</td>
                      <td className="figure">€{formatNumber(Number(s.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(payments ?? []).length > 0 && (
              <div className="mt-4 border-t border-stone-line pt-3">
                <p className="eyebrow mb-2">Payment history</p>
                <ul className="space-y-1.5 text-sm">
                  {(payments ?? []).map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span className="text-charcoal-600/70">{formatDate(p.paid_at)} · {p.method ?? 'payment'}</span>
                      <span className="figure text-charcoal">€{formatNumber(Number(p.amount_paid))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Defect history */}
          <div className="panel p-6">
            <h4 className="mb-4 flex items-center gap-2"><Wrench size={15} strokeWidth={1.75} className="text-olive" /> Defect history</h4>
            {(defects ?? []).length === 0 ? (
              <p className="text-sm text-charcoal-600/70">No maintenance tickets raised for this unit.</p>
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
            <h4 className="mb-4">Ownership history</h4>
            {(ownership ?? []).length === 0 ? (
              <p className="text-sm text-charcoal-600/70">No ownership transfers recorded.</p>
            ) : (
              <ol className="space-y-3 border-l border-stone-line pl-4">
                {(ownership ?? []).map((o: any) => (
                  <li key={o.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-champagne" />
                    <p className="text-sm text-charcoal">
                      {o.prev?.full_name ? `${o.prev.full_name} → ` : ''}<span className="font-medium">{o.next?.full_name ?? 'Unassigned'}</span>
                    </p>
                    {o.note && <p className="text-xs text-charcoal-600/70">{o.note}</p>}
                    <p className="text-xs text-charcoal-600/50">{formatDate(o.transfer_date ?? o.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="panel p-6">
            <h4 className="mb-4">House documents</h4>
            <DocumentList documents={documents ?? []} getSignedUrl={getDocumentUrl.bind(null, 'contracts')} />
          </div>
        </div>

        <div className="space-y-6">
          <ReservationPanel
            unitId={unit.id}
            projectId={unit.project_id}
            unitStatus={unit.status}
            reservation={reservation}
            contacts={contacts ?? []}
            contractStatus={contract?.status ?? null}
          />
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
    </div>
  );
}
