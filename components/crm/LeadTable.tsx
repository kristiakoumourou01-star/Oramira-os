'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LeadListItem } from '@/lib/leads-shared';
import { PriorityBadge } from './PriorityBadge';
import { LeadQuickActions } from './LeadQuickActions';
import { formatDate, formatRelative, formatNumber, formatCurrency } from '@/lib/format';

const STATUSES = ['all', 'new', 'contacted', 'qualified', 'viewing', 'negotiating', 'reserved', 'won', 'lost', 'nurture'] as const;

const STATUS_CLASS: Record<string, string> = {
  new: 'badge-champagne',
  contacted: 'badge-neutral',
  qualified: 'badge-neutral',
  viewing: 'badge-champagne',
  negotiating: 'badge-champagne',
  reserved: 'badge-forest',
  won: 'badge-forest',
  lost: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge',
  nurture: 'badge-neutral',
};

function budgetLabel(min: number | null, max: number | null) {
  if (!min && !max) return '—';
  if (min && !max) return `${formatCurrency(min)}+`;
  if (!min && max) return `up to ${formatCurrency(max)}`;
  return `${formatCurrency(min!)}–${formatNumber(max!)}`;
}

/** The sales pipeline table — prioritised, clickable, with inline quick actions. */
export function LeadTable({ leads }: { leads: LeadListItem[] }) {
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>('all');
  const router = useRouter();
  const shown = filter === 'all' ? leads : leads.filter((l) => l.status === filter);
  const now = Date.now();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const count = s === 'all' ? leads.length : leads.filter((l) => l.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`badge capitalize ${filter === s ? 'badge-forest' : 'badge-neutral'}`}
            >
              {s} <span className="figure ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="panel overflow-visible">
        <table className="table-base w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Budget</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Next action</th>
              <th>Last contact</th>
              <th>Owner</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((lead) => {
              const overdue = lead.next_follow_up && new Date(lead.next_follow_up).getTime() <= now;
              return (
                <tr
                  key={lead.id}
                  onClick={() => router.push(`/crm/leads/${lead.id}`)}
                  className="cursor-pointer hover:bg-stone/60"
                >
                  <td>
                    <p className="font-medium text-forest">{lead.full_name ?? 'Unnamed'}</p>
                    <p className="text-xs text-charcoal-600/60">{lead.email}</p>
                  </td>
                  <td className="figure text-charcoal-600">{lead.phone ?? '—'}</td>
                  <td className="figure">{budgetLabel(lead.budget_min, lead.budget_max)}</td>
                  <td><span className={`${STATUS_CLASS[lead.status] ?? 'badge-neutral'} capitalize`}>{lead.status}</span></td>
                  <td><PriorityBadge score={lead.priority} /></td>
                  <td className={`figure text-xs ${overdue ? 'text-signal-danger' : 'text-charcoal-600/80'}`}>
                    {lead.next_follow_up ? formatDate(lead.next_follow_up) : '—'}
                  </td>
                  <td className="text-xs text-charcoal-600/80">
                    {lead.last_contacted_at ? formatRelative(lead.last_contacted_at) : 'Never'}
                  </td>
                  <td className="text-xs text-charcoal-600">{lead.owner_name ?? '—'}</td>
                  <td><LeadQuickActions lead={lead} /></td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-sm text-charcoal-600/70">No leads in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
