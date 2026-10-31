import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHomeownerUnit } from '@/lib/homeowner';
import Link from 'next/link';
import { ShieldCheck, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { WarrantyClaimButton } from '@/components/homeowner/WarrantyClaimButton';
import { TicketStatusBadge } from '@/components/homeowner/TicketStatusBadge';
import { formatDate } from '@/lib/format';

export default async function WarrantyCenterPage() {
  const profile = await requireRole(['homeowner', 'admin', 'sales', 'management']);
  const unit = await getHomeownerUnit(profile.contactId);

  if (!unit) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Warranty Center"
        description="Your warranty cover and certificates will appear here once your home is handed over."
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: warranties }, { data: claims }] = await Promise.all([
    supabase.from('warranties').select('id, category, starts_on, ends_on, notes').eq('unit_id', unit.id).order('ends_on'),
    supabase.from('maintenance_tickets').select('id, title, status, created_at, warranty_id').eq('unit_id', unit.id).not('warranty_id', 'is', null).order('created_at', { ascending: false }),
  ]);

  const now = new Date();
  const soon = new Date();
  soon.setMonth(soon.getMonth() + 2);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">{unit.project_name} · Unit {unit.unit_number}</p>
        <h1 className="font-display text-3xl">Warranty Center</h1>
      </div>

      <div className="panel p-6">
        <h4 className="mb-4">Your cover</h4>
        {(warranties ?? []).length === 0 ? (
          <p className="text-sm text-charcoal-600/70">Your warranty certificates will be published here at handover.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {(warranties ?? []).map((w) => {
              const ends = new Date(w.ends_on);
              const active = ends >= now;
              const expiringSoon = active && ends <= soon;
              return (
                <div key={w.id} className="rounded-md border border-stone-line p-5">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className={active ? 'text-signal-success' : 'text-charcoal-600/40'} strokeWidth={1.75} />
                      <p className="text-sm font-medium capitalize text-charcoal">{w.category}</p>
                    </div>
                    <span className={active ? (expiringSoon ? 'badge-champagne' : 'badge-forest') : 'badge-neutral'}>
                      {active ? (expiringSoon ? 'Expiring soon' : 'Active') : 'Expired'}
                    </span>
                  </div>
                  <p className="text-xs text-charcoal-600/70">
                    <span className="figure">{formatDate(w.starts_on)}</span> – <span className="figure">{formatDate(ends)}</span>
                  </p>
                  {w.notes && <p className="mt-2 text-xs text-charcoal-600/80">{w.notes}</p>}
                  {active && (
                    <div className="mt-3 border-t border-stone-line pt-3">
                      <WarrantyClaimButton warrantyId={w.id} unitId={unit.id} label={`Covered item: ${w.category}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel p-6">
        <h4 className="mb-4">Warranty claims</h4>
        {(claims ?? []).length === 0 ? (
          <p className="text-sm text-charcoal-600/70">No warranty claims filed. If a covered item fails, file a claim above and we&apos;ll handle it.</p>
        ) : (
          <ul className="divide-y divide-stone-line">
            {(claims ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/homeowner/maintenance/${c.id}`} className="flex items-center justify-between py-3 transition-colors hover:bg-stone/60">
                  <div>
                    <p className="text-sm font-medium text-charcoal">{c.title}</p>
                    <p className="text-xs text-charcoal-600/60">{formatDate(c.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TicketStatusBadge status={c.status} />
                    <ChevronRight size={16} className="text-charcoal-600/40" strokeWidth={1.75} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
