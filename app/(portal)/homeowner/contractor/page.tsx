import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHomeownerUnit } from '@/lib/homeowner';
import { HardHat } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ContractorVisitList, type VisitRow } from '@/components/homeowner/ContractorVisitList';

export default async function ContractorCoordinationPage() {
  const profile = await requireRole(['homeowner', 'admin', 'sales', 'management']);
  const unit = await getHomeownerUnit(profile.contactId);

  if (!unit) {
    return (
      <EmptyState
        icon={HardHat}
        title="Contractor Coordination"
        description="When a contractor is assigned to your home, you'll see who they are and when they're visiting here."
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: visits }, { data: activeTickets }] = await Promise.all([
    supabase
      .from('contractor_visits')
      .select('id, scheduled_for, completed_at, status, notes, contractors(company_name), maintenance_tickets(title)')
      .eq('unit_id', unit.id)
      .order('scheduled_for', { ascending: false }),
    supabase
      .from('maintenance_tickets')
      .select('id, title, status, contractor_id, contractors(company_name)')
      .eq('unit_id', unit.id)
      .not('contractor_id', 'is', null)
      .not('status', 'in', '("resolved","closed")'),
  ]);

  const visitRows: VisitRow[] = (visits ?? []).map((v) => ({
    id: v.id,
    scheduled_for: v.scheduled_for,
    completed_at: v.completed_at,
    status: v.status,
    notes: v.notes,
    contractor_name: (v as any).contractors?.company_name ?? null,
    ticket_title: (v as any).maintenance_tickets?.title ?? null,
  }));

  // Distinct contractors currently engaged on this home.
  const assigned = new Map<string, string>();
  for (const t of activeTickets ?? []) {
    if (t.contractor_id) assigned.set(t.contractor_id, (t as any).contractors?.company_name ?? 'Contractor');
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">{unit.project_name} · Unit {unit.unit_number}</p>
        <h1 className="font-display text-3xl">Contractor Coordination</h1>
      </div>

      <div className="panel p-6">
        <h4 className="mb-4">Currently engaged</h4>
        {assigned.size === 0 ? (
          <p className="text-sm text-charcoal-600/70">No contractor is currently working on your home.</p>
        ) : (
          <ul className="divide-y divide-stone-line">
            {Array.from(assigned.entries()).map(([id, name]) => (
              <li key={id} className="flex items-center gap-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sand-100 text-forest">
                  <HardHat size={16} strokeWidth={1.75} />
                </div>
                <p className="text-sm font-medium text-charcoal">{name}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel p-6">
        <h4 className="mb-4">Visit schedule & history</h4>
        <ContractorVisitList visits={visitRows} />
      </div>
    </div>
  );
}
