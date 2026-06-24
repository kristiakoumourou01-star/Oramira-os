import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BedDouble, Bath, Ruler, Layers, Wrench } from 'lucide-react';
import { UnitStatusBadge } from '@/components/units/UnitStatusBadge';
import { ReservationPanel } from '@/components/units/ReservationPanel';
import { HandoverControl } from '@/components/units/HandoverControl';
import { DocumentList } from '@/components/ui/DocumentList';
import { getDocumentUrl } from '@/app/actions/storage';

export default async function UnitDetailPage({ params }: { params: { id: string; unitId: string } }) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: unit } = await supabase
    .from('units')
    .select(
      `id, project_id, unit_number, floor, type, sqm, price, bedrooms, bathrooms, description, internal_specs,
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

  const [{ data: schedules }, { data: payments }, { data: defects }, { data: contacts }, { data: documents }] =
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
          <h1 className="text-3xl">Unit {unit.unit_number}</h1>
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
            {unit.price != null ? `€${Number(unit.price).toLocaleString()}` : '—'}
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
                  €{totalPaid.toLocaleString()} paid
                  {contract.total_price != null && ` / €${Number(contract.total_price).toLocaleString()}`}
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
                      <td className="figure text-charcoal-600">{s.due_date ? new Date(s.due_date).toLocaleDateString() : '—'}</td>
                      <td className="figure">€{Number(s.amount).toLocaleString()}</td>
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
                      <span className="text-charcoal-600/70">{new Date(p.paid_at).toLocaleDateString()} · {p.method ?? 'payment'}</span>
                      <span className="figure text-charcoal">€{Number(p.amount_paid).toLocaleString()}</span>
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
                      <p className="text-xs text-charcoal-600/60">{new Date(d.created_at).toLocaleDateString()}</p>
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

          <div className="panel p-6">
            <h4 className="mb-4">Unit documents</h4>
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
