import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import type { LeadListItem } from '@/lib/leads';
import { PriorityBadge } from './PriorityBadge';
import { LeadQuickActions } from './LeadQuickActions';

const DAY = 24 * 60 * 60 * 1000;

function reasonFor(l: LeadListItem): string {
  const now = Date.now();
  if (l.next_follow_up && new Date(l.next_follow_up).getTime() <= now) {
    const overdueDays = Math.floor((now - new Date(l.next_follow_up).getTime()) / DAY);
    return overdueDays > 0 ? `Follow-up ${overdueDays}d overdue` : 'Follow-up due today';
  }
  const ref = l.last_contacted_at ?? l.created_at;
  const days = Math.floor((now - new Date(ref).getTime()) / DAY);
  return `No contact in ${days} days`;
}

/**
 * The rep's daily worklist — leads with a due/overdue follow-up or that have
 * gone quiet (5+ days), surfaced above the full table so nothing slips.
 */
export function NeedsActionToday({ leads }: { leads: LeadListItem[] }) {
  if (leads.length === 0) return null;

  return (
    <section className="rounded-md border border-champagne/40 bg-champagne-50/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <AlertCircle size={16} className="text-champagne-600" strokeWidth={1.75} />
        <h4 className="text-charcoal">Needs action today</h4>
        <span className="badge-champagne">{leads.length}</span>
      </div>
      <ul className="space-y-2">
        {leads.map((lead) => (
          <li key={lead.id} className="flex items-center justify-between gap-3 rounded border border-stone-line bg-white px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <PriorityBadge score={lead.priority} />
              <div className="min-w-0">
                <Link href={`/crm/leads/${lead.id}`} className="font-medium text-forest hover:underline">
                  {lead.full_name ?? 'Unnamed'}
                </Link>
                <p className="text-xs text-signal-warning">{reasonFor(lead)}</p>
              </div>
            </div>
            <LeadQuickActions lead={lead} />
          </li>
        ))}
      </ul>
    </section>
  );
}
