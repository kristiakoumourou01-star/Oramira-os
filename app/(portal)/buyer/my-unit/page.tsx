import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBuyerUnit } from '@/lib/buyer';
import { Building2, BedDouble, Bath, Ruler, Layers } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { UnitStatusBadge } from '@/components/units/UnitStatusBadge';
import { DocumentList } from '@/components/ui/DocumentList';
import { getDocumentUrl } from '@/app/actions/storage';
import { formatCurrency } from '@/lib/format';

export default async function MyUnitPage() {
  const profile = await requireRole(['buyer', 'admin', 'sales', 'management']);
  const unit = await getBuyerUnit(profile.contactId);

  if (!unit) {
    return (
      <EmptyState
        icon={Building2}
        title="No unit linked yet"
        description="Your unit details will appear here once your reservation is confirmed."
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: floorplan } = unit.floorplan_document_id
    ? await supabase
        .from('documents')
        .select('id, title, category, storage_path, bucket, created_at')
        .eq('id', unit.floorplan_document_id)
        .maybeSingle()
    : { data: null };

  const finishes = Object.entries(unit.internal_specs ?? {});

  const facts: { label: string; value: string; icon?: typeof Layers }[] = [
    ...(unit.type ? [{ label: 'Type', value: unit.type }] : []),
    ...(unit.floor != null ? [{ label: 'Floor', value: String(unit.floor), icon: Layers }] : []),
    ...(unit.sqm != null ? [{ label: 'Internal area', value: `${unit.sqm} m²`, icon: Ruler }] : []),
    ...(unit.bedrooms != null ? [{ label: 'Bedrooms', value: String(unit.bedrooms), icon: BedDouble }] : []),
    ...(unit.bathrooms != null ? [{ label: 'Bathrooms', value: String(unit.bathrooms), icon: Bath }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">{unit.project_name}{unit.building_name ? ` · ${unit.building_name}` : ''}{unit.phase_name ? ` · ${unit.phase_name}` : ''}</p>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl">Unit {unit.unit_number}</h1>
          <UnitStatusBadge status={unit.status} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {unit.description && (
            <div className="panel p-6">
              <h4 className="mb-2">About your home</h4>
              <p className="text-sm leading-relaxed text-charcoal-600/80">{unit.description}</p>
            </div>
          )}

          <div className="panel p-6">
            <h4 className="mb-4">At a glance</h4>
            <div className="grid grid-cols-3 gap-4">
              {facts.map((f) => (
                <div key={f.label} className="rounded border border-stone-line p-4">
                  <p className="eyebrow">{f.label}</p>
                  <p className="figure mt-1 text-lg text-charcoal">{f.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-6">
            <h4 className="mb-4">Internal finishes & specifications</h4>
            {finishes.length === 0 ? (
              <p className="text-sm text-charcoal-600/70">Your specification schedule will be published here.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {finishes.map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-stone-line pb-2">
                    <dt className="capitalize text-charcoal-600/70">{k.replace(/_/g, ' ')}</dt>
                    <dd className="text-charcoal">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="panel p-6">
            <h4 className="mb-4">Floorplan</h4>
            {floorplan ? (
              <DocumentList documents={[floorplan]} getSignedUrl={getDocumentUrl.bind(null, (floorplan.bucket as any) ?? 'project-media')} />
            ) : (
              <p className="text-sm text-charcoal-600/70">Your floorplan will be available to download here shortly.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-6">
            <p className="eyebrow mb-2">Purchase price</p>
            <p className="figure text-3xl text-forest">
              {unit.price != null ? `${formatCurrency(Number(unit.price))}` : '—'}
            </p>
          </div>

          <div className="panel p-6">
            <h4 className="mb-4">Status</h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-charcoal-600/70">Reservation</span>
                {unit.reservation ? (
                  <span className={unit.reservation.deposit_paid ? 'badge-forest' : 'badge-champagne'}>
                    {unit.reservation.status === 'active' && !unit.reservation.deposit_paid ? 'Deposit pending' : unit.reservation.status}
                  </span>
                ) : (
                  <span className="badge-neutral">None</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-charcoal-600/70">Contract</span>
                <span className={unit.contract?.status === 'signed' ? 'badge-forest' : 'badge-neutral'}>
                  {unit.contract ? unit.contract.status : 'Not started'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-charcoal-600/70">Handover</span>
                <span className="badge-neutral capitalize">{unit.handover_status.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
