'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Zap, AlertTriangle, CalendarCheck, CalendarClock, TrendingUp, FileText, RotateCw, Clock, Sparkles, MessageCircle } from 'lucide-react';
import type { LeadListItem } from '@/lib/leads-shared';
import { PriorityBadge } from './PriorityBadge';
import { LeadQuickActions } from './LeadQuickActions';
import { reassignLead } from '@/app/actions/leads';
import { formatNumber, formatCurrency } from '@/lib/format';
import { nextBestAction, type NbaKey, type NbaTone } from '@/lib/next-best-action';

const NBA_ICON: Record<NbaKey, any> = {
  respond: Zap, reply: MessageCircle, follow_up_overdue: AlertTriangle, confirm_viewing: CalendarCheck, book_viewing: CalendarClock,
  viewing_followup: CalendarCheck, advance_deal: TrendingUp, progress_contract: FileText, re_engage: RotateCw, follow_up: Clock, nurture: Sparkles,
};
const NBA_TONE: Record<NbaTone, string> = {
  urgent: 'border-signal-danger/25 bg-champagne-50 text-signal-danger',
  warm: 'border-forest/20 bg-forest/[0.06] text-forest',
  cool: 'border-stone-line bg-sand-100 text-charcoal-600',
};

export interface Agent { id: string; full_name: string | null }

const URGENCY = [
  { key: 'overdue', label: 'Overdue', danger: true },
  { key: 'today', label: 'Today', danger: false },
  { key: 'tomorrow', label: 'Tomorrow', danger: false },
] as const;

const STATUS_SECTIONS = [
  { key: 'new', label: 'New Leads' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'engaged', label: 'Engaged' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'viewing', label: 'Viewing Scheduled' },
  { key: 'offer', label: 'Offer Stage' },
  { key: 'negotiating', label: 'Negotiation' },
  { key: 'reserved', label: 'Reservation / Deposit' },
  { key: 'no_response', label: 'No Response' },
  { key: 'retargeting', label: 'Retargeting Pool' },
] as const;

function localDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function budgetLabel(min: number | null, max: number | null) {
  if (!min && !max) return null;
  if (min && !max) return `${formatCurrency(min)}+`;
  if (!min && max) return `up to ${formatCurrency(max)}`;
  return `${formatCurrency(min!)}–${formatNumber(max!)}`;
}

/** Inline reassign control (admin/staff can move any lead to another agent). */
function AssignSelect({ leadId, ownerId, agents }: { leadId: string; ownerId: string | null; agents: Agent[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <select
      value={ownerId ?? ''}
      disabled={isPending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const v = e.target.value;
        if (!v || v === ownerId) return;
        startTransition(async () => { await reassignLead(leadId, v); router.refresh(); });
      }}
      className="max-w-[120px] truncate rounded border border-stone-line bg-white px-1.5 py-1 text-xs text-charcoal-600"
      title="Assign to"
    >
      <option value="">Unassigned</option>
      {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? 'Agent'}</option>)}
    </select>
  );
}

function LeadCard({ lead, agents }: { lead: LeadListItem; agents: Agent[] }) {
  const router = useRouter();
  const budget = budgetLabel(lead.budget_min, lead.budget_max);
  return (
    <div
      onClick={() => router.push(`/crm/leads/${lead.id}`)}
      className="panel cursor-pointer p-4 transition-shadow hover:shadow-overlay"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-forest">{lead.full_name ?? 'Unnamed'}</p>
          <p className="truncate text-xs text-charcoal-600/60">{lead.phone ?? lead.email ?? '—'}</p>
        </div>
        <PriorityBadge score={lead.priority} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-charcoal-600/80">
        {(() => {
          const nba = nextBestAction({ status: lead.status, last_contacted_at: lead.last_contacted_at, created_at: lead.created_at, next_follow_up: lead.next_follow_up });
          const Icon = NBA_ICON[nba.key];
          return (
            <span title={nba.reason} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${NBA_TONE[nba.tone]}`}>
              <Icon size={11} strokeWidth={2} /> {nba.label}
            </span>
          );
        })()}
        {budget && <span className="figure text-charcoal-600/70">{budget}</span>}
      </div>

      <div className="flex items-center justify-between border-t border-stone-line pt-2">
        <div className="flex items-center gap-1 text-xs text-charcoal-600/70" onClick={(e) => e.stopPropagation()}>
          <User size={12} strokeWidth={1.75} />
          <AssignSelect leadId={lead.id} ownerId={lead.owner_id} agents={agents} />
        </div>
        <LeadQuickActions lead={lead} />
      </div>
    </div>
  );
}

function Section({ label, danger, leads, agents }: { label: string; danger?: boolean; leads: LeadListItem[]; agents: Agent[] }) {
  if (leads.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h4 className={danger ? 'text-signal-danger' : 'text-charcoal'}>{label}</h4>
        <span className={danger ? 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge' : 'badge-neutral'}>{leads.length}</span>
      </div>
      <div className={`grid grid-cols-3 gap-3 ${danger ? 'rounded-md border border-signal-danger/20 bg-champagne-50/30 p-3' : ''}`}>
        {leads.map((l) => <LeadCard key={l.id} lead={l} agents={agents} />)}
      </div>
    </section>
  );
}

/**
 * The leads board — priority buckets as cards. Urgency sections (Overdue/Today/
 * Tomorrow, driven by next_action_date) sit above the status pipeline sections.
 * An owner filter narrows to a single agent ("My leads") for personal focus.
 */
export function LeadBoard({ leads, agents, currentUserId }: { leads: LeadListItem[]; agents: Agent[]; currentUserId: string }) {
  // Default to a personal view, but fall back to "All" when none are assigned to
  // me — so a freshly created lead is never hidden behind an empty "My leads".
  const hasMine = leads.some((l) => l.owner_id === currentUserId);
  const [owner, setOwner] = useState<'all' | 'mine' | string>(hasMine ? 'mine' : 'all');
  const today = localDate(0);
  const tomorrow = localDate(1);

  const filtered = useMemo(() => {
    if (owner === 'all') return leads;
    if (owner === 'mine') return leads.filter((l) => l.owner_id === currentUserId);
    return leads.filter((l) => l.owner_id === owner);
  }, [leads, owner, currentUserId]);

  function bucketOf(l: LeadListItem): string {
    if (!l.owner_id) return 'unassigned';
    if (['won', 'lost', 'nurture'].includes(l.status)) return 'done';
    if (l.next_action_date) {
      if (l.next_action_date < today) return 'overdue';
      if (l.next_action_date === today) return 'today';
      if (l.next_action_date === tomorrow) return 'tomorrow';
    }
    return l.status;
  }

  const grouped = useMemo(() => {
    const m: Record<string, LeadListItem[]> = {};
    for (const l of filtered) (m[bucketOf(l)] ??= []).push(l);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, today, tomorrow]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setOwner('mine')} className={`badge ${owner === 'mine' ? 'badge-forest' : 'badge-neutral'}`}>My leads</button>
        <button onClick={() => setOwner('all')} className={`badge ${owner === 'all' ? 'badge-forest' : 'badge-neutral'}`}>All</button>
        {agents.map((a) => (
          <button key={a.id} onClick={() => setOwner(a.id)} className={`badge ${owner === a.id ? 'badge-forest' : 'badge-neutral'}`}>
            {a.full_name ?? 'Agent'}
          </button>
        ))}
      </div>

      {grouped['unassigned'] && <Section label="Unassigned" leads={grouped['unassigned']} agents={agents} />}
      {URGENCY.map((u) => <Section key={u.key} label={u.label} danger={u.danger} leads={grouped[u.key] ?? []} agents={agents} />)}
      {STATUS_SECTIONS.map((s) => <Section key={s.key} label={s.label} leads={grouped[s.key] ?? []} agents={agents} />)}

      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-charcoal-600/70">No leads in this view.</p>
      )}
    </div>
  );
}
