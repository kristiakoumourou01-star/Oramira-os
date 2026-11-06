import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHomeownerUnit } from '@/lib/homeowner';
import Link from 'next/link';
import { Wrench, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { NewTicketForm } from '@/components/homeowner/NewTicketForm';
import { TicketStatusBadge, PriorityBadge } from '@/components/homeowner/TicketStatusBadge';
import { formatDate } from '@/lib/format';

export default async function MaintenanceCenterPage() {
  const profile = await requireRole(['homeowner', 'admin', 'sales', 'management']);
  const unit = await getHomeownerUnit(profile.contactId);

  if (!unit) {
    return (
      <EmptyState
        icon={Wrench}
        title="Maintenance opens with your home"
        description="Once your handover is complete you can report issues and track repairs here."
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: tickets } = await supabase
    .from('maintenance_tickets')
    .select('id, title, category, status, priority, created_at')
    .eq('unit_id', unit.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">{unit.project_name} · Unit {unit.unit_number}</p>
          <h1 className="font-display text-3xl">Maintenance Center</h1>
        </div>
        <NewTicketForm unitId={unit.id} />
      </div>

      {!tickets || tickets.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No maintenance requests"
          description="Everything in good order. If something needs attention, report it and your Oramira team will arrange a contractor."
          action={<NewTicketForm unitId={unit.id} />}
        />
      ) : (
        <div className="panel divide-y divide-stone-line">
          {tickets.map((t) => (
            <Link key={t.id} href={`/homeowner/maintenance/${t.id}`} className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-stone/60">
              <div>
                <p className="text-sm font-medium text-charcoal">{t.title}</p>
                <p className="mt-0.5 text-xs capitalize text-charcoal-600/60">
                  {t.category ?? 'general'} · {formatDate(t.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={t.priority} />
                <TicketStatusBadge status={t.status} />
                <ChevronRight size={16} className="text-charcoal-600/40" strokeWidth={1.75} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
