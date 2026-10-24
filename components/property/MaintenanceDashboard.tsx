'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { assignTicketContractor, setTicketStatus } from '@/app/actions/property';
import { TicketStatusBadge, PriorityBadge } from '@/components/homeowner/TicketStatusBadge';
import { formatDate } from '@/lib/format';

export interface AdminTicket {
  id: string;
  title: string;
  category: string | null;
  status: string;
  priority: string;
  created_at: string;
  unit_number: string | null;
  project_name: string | null;
  owner_name: string | null;
  contractor_id: string | null;
  contractor_name: string | null;
}
export interface ContractorOption { id: string; company_name: string }

const STATUSES = ['open', 'acknowledged', 'in_progress', 'awaiting_parts', 'resolved', 'closed', 'reopened'] as const;
const OPEN = ['open', 'acknowledged', 'in_progress', 'awaiting_parts', 'reopened'];
const FILTERS = ['open', 'all', 'emergency'] as const;

export function MaintenanceDashboard({ tickets, contractors }: { tickets: AdminTicket[]; contractors: ContractorOption[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('open');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const shown = tickets.filter((t) =>
    filter === 'all' ? true : filter === 'emergency' ? t.priority === 'emergency' : OPEN.includes(t.status),
  );

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => { await fn(); router.refresh(); });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`badge capitalize ${filter === f ? 'badge-forest' : 'badge-neutral'}`}>
            {f} <span className="figure ml-1 opacity-70">{f === 'all' ? tickets.length : f === 'emergency' ? tickets.filter((t) => t.priority === 'emergency').length : tickets.filter((t) => OPEN.includes(t.status)).length}</span>
          </button>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <table className="table-base w-full">
          <thead><tr><th>Issue</th><th>Property</th><th>Owner</th><th>Priority</th><th>Status</th><th>Contractor</th></tr></thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id} className="hover:bg-stone/60">
                <td>
                  <Link href={`/homeowner/maintenance/${t.id}`} className="font-medium text-forest hover:underline">{t.title}</Link>
                  <p className="text-xs capitalize text-charcoal-600/60">{t.category ?? 'general'} · {formatDate(t.created_at)}</p>
                </td>
                <td className="text-xs text-charcoal-600">{t.project_name ?? ''}{t.unit_number ? ` · ${t.unit_number}` : ''}</td>
                <td className="text-xs text-charcoal-600">{t.owner_name ?? '—'}</td>
                <td><PriorityBadge priority={t.priority} /></td>
                <td>
                  <select value={t.status} disabled={isPending} onChange={(e) => run(() => setTicketStatus(t.id, e.target.value as any))} className="input max-w-[140px] py-1 text-xs capitalize">
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </td>
                <td>
                  <select value={t.contractor_id ?? ''} disabled={isPending} onChange={(e) => { const v = e.target.value; if (v) run(() => assignTicketContractor(t.id, v)); }} className="input max-w-[150px] py-1 text-xs">
                    <option value="">Assign…</option>
                    {contractors.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-sm text-charcoal-600/70">No tickets in this view.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
