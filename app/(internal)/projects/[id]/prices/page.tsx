import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgSettings } from '@/lib/org-settings';
import { cleanPlan } from '@/lib/pricing-shared';
import { PriceListEditor, type PriceRow, type PriceVersion } from '@/components/pricing/PriceListEditor';
import { PaymentPlanEditor } from '@/components/pricing/PaymentPlanEditor';
import { ReservationsList, type ActiveReservation } from '@/components/pricing/ReservationsList';

export const dynamic = 'force-dynamic';

/** Projects → έργο → Τιμοκατάλογος (βήμα 11β): τιμές, εκδόσεις, κρατήσεις, πρόγραμμα πληρωμών. */
export default async function ProjectPricesPage({ params }: { params: { id: string } }) {
  const profile = await requirePermission('projects');
  const canEdit = effectiveCan(profile.role, profile.moduleAccess, 'projects', 'edit', profile.permissions);
  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase.from('projects').select('id, name').eq('id', params.id).maybeSingle();
  if (!project) notFound();

  const [{ data: units }, { data: planRow, error: planErr }, { data: hist }, { data: lists }, settings] = await Promise.all([
    supabase.from('units').select('id, unit_number, floor, type, sqm, bedrooms, price, status, buildings(name)').eq('project_id', project.id),
    (supabase as any).from('projects').select('payment_plan').eq('id', project.id).maybeSingle(),
    (supabase as any).from('unit_price_history').select('unit_id, old_price, new_price, changed_at').eq('project_id', project.id).neq('source', 'created').order('changed_at', { ascending: false }).limit(3000),
    (supabase as any).from('price_lists').select('id, name, note, items, created_at, profiles:created_by(full_name)').eq('project_id', project.id).order('created_at', { ascending: false }).limit(10),
    getOrgSettings(),
  ]);
  const missing = !!planErr;

  const last = new Map<string, PriceRow['last']>();
  for (const h of (hist ?? []) as any[]) if (!last.has(h.unit_id)) last.set(h.unit_id, { at: h.changed_at, old: h.old_price == null ? null : Number(h.old_price), new: h.new_price == null ? null : Number(h.new_price) });
  const rows: PriceRow[] = ((units ?? []) as any[]).map((u) => ({
    id: u.id, unit_number: u.unit_number, building: u.buildings?.name ?? null, floor: u.floor, type: u.type,
    sqm: u.sqm == null ? null : Number(u.sqm), bedrooms: u.bedrooms, price: u.price == null ? null : Number(u.price), status: u.status, last: last.get(u.id) ?? null,
  }));
  const versions: PriceVersion[] = ((lists ?? []) as any[]).map((v) => ({ id: v.id, name: v.name, note: v.note, createdAt: v.created_at, by: v.profiles?.full_name ?? null, items: Array.isArray(v.items) ? v.items : [] }));

  const unitIds = rows.map((u) => u.id);
  const { data: resv } = unitIds.length
    ? await supabase.from('reservations').select('id, unit_id, buyer_contact_id, deposit_amount, deposit_paid, reserved_at, expires_at, contacts(full_name)').in('unit_id', unitIds).eq('status', 'active')
    : { data: [] as any[] };
  const byId = new Map(rows.map((u) => [u.id, u]));
  const reservations: ActiveReservation[] = ((resv ?? []) as any[]).map((r) => ({
    id: r.id, unitId: r.unit_id, unitNumber: byId.get(r.unit_id)?.unit_number ?? '—', buyerId: r.buyer_contact_id, buyer: r.contacts?.full_name ?? null,
    deposit: r.deposit_amount == null ? null : Number(r.deposit_amount), depositPaid: !!r.deposit_paid, reservedAt: r.reserved_at, expiresAt: r.expires_at,
    price: byId.get(r.unit_id)?.price ?? null,
  }));
  const plan = cleanPlan(planRow?.payment_plan);
  const avgPrice = (() => { const p = rows.map((u) => u.price).filter((x): x is number => !!x); return p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : null; })();

  return (
    <div className="space-y-5">
      <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1 text-sm text-charcoal-600/70 hover:text-forest">
        <ArrowLeft size={14} strokeWidth={1.75} /> {project.name}
      </Link>
      <div>
        <h1 className="text-3xl">Τιμοκατάλογος</h1>
        <p className="text-sm text-charcoal-600/70">Τιμές και ιστορικό αλλαγών, εκδόσεις για αποστολή, ενεργές κρατήσεις και πρόγραμμα πληρωμών του έργου.</p>
      </div>
      {missing && <p className="rounded-md bg-champagne-50 px-4 py-2 text-sm text-champagne-600">Το ιστορικό τιμών, οι εκδόσεις και τα προγράμματα πληρωμών ενεργοποιούνται μόλις τρέξει το migration 0065.</p>}

      <PriceListEditor projectId={project.id} projectName={project.name} units={rows} versions={versions} canEdit={canEdit} />

      <div className="grid gap-5 lg:grid-cols-2">
        <ReservationsList projectId={project.id} items={reservations} settings={settings.reservations} canEdit={canEdit} />
        <div className="panel space-y-3 p-5">
          <div>
            <h4>Πρόγραμμα πληρωμών του έργου</h4>
            <p className="text-xs text-charcoal-600/70">Ισχύει για κάθε μονάδα, εκτός αν της ορίσετε δικό της στη σελίδα της. Όταν μια κράτηση γίνει συμβόλαιο, οι δόσεις δημιουργούνται αυτόματα από εδώ.</p>
          </div>
          <PaymentPlanEditor key={JSON.stringify(plan)} initial={plan} target={{ kind: 'project', projectId: project.id }} price={avgPrice} canEdit={canEdit && !missing} />
        </div>
      </div>
    </div>
  );
}
