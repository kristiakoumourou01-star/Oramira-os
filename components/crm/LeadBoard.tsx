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
import { DEFAULT_PIPELINE_SETTINGS, lateBy, pipelineOf, stageIndex, type PipelineSettings } from '@/lib/pipeline-shared';

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

// Per-stage colour accents — a calm, distinct hue per pipeline stage so the
// board reads at a glance (dot + count badge + left rule), the way the
// dashboard uses colour. Kept muted to stay on-brand.
interface Accent { dot: string; badge: string; bar: string }
const DEFAULT_ACCENT: Accent = { dot: 'bg-stone-400', badge: 'badge-neutral', bar: 'border-l-stone-line' };
const STAGE_ACCENT: Record<string, Accent> = {
  overdue: { dot: 'bg-rose-500', badge: 'border-rose-200 bg-rose-50 text-rose-700', bar: 'border-l-rose-400' },
  today: { dot: 'bg-amber-500', badge: 'border-amber-200 bg-amber-50 text-amber-700', bar: 'border-l-amber-400' },
  tomorrow: { dot: 'bg-sky-500', badge: 'border-sky-200 bg-sky-50 text-sky-700', bar: 'border-l-sky-400' },
  unassigned: { dot: 'bg-stone-400', badge: 'badge-neutral', bar: 'border-l-stone-line' },
  new: { dot: 'bg-sky-500', badge: 'border-sky-200 bg-sky-50 text-sky-700', bar: 'border-l-sky-400' },
  contacted: { dot: 'bg-indigo-500', badge: 'border-indigo-200 bg-indigo-50 text-indigo-700', bar: 'border-l-indigo-400' },
  engaged: { dot: 'bg-violet-500', badge: 'border-violet-200 bg-violet-50 text-violet-700', bar: 'border-l-violet-400' },
  qualified: { dot: 'bg-emerald-500', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700', bar: 'border-l-emerald-400' },
  waiting: { dot: 'bg-amber-500', badge: 'border-amber-200 bg-amber-50 text-amber-700', bar: 'border-l-amber-400' },
  viewing: { dot: 'bg-teal-500', badge: 'border-teal-200 bg-teal-50 text-teal-700', bar: 'border-l-teal-400' },
  offer: { dot: 'bg-orange-500', badge: 'border-orange-200 bg-orange-50 text-orange-700', bar: 'border-l-orange-400' },
  negotiating: { dot: 'bg-rose-500', badge: 'border-rose-200 bg-rose-50 text-rose-700', bar: 'border-l-rose-400' },
  reserved: { dot: 'bg-forest', badge: 'badge-forest', bar: 'border-l-forest/50' },
  no_response: { dot: 'bg-stone-400', badge: 'badge-neutral', bar: 'border-l-stone-line' },
  retargeting: { dot: 'bg-fuchsia-500', badge: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700', bar: 'border-l-fuchsia-400' },
};

const URGENCY = [
  { key: 'overdue', label: 'Εκπρόθεσμη ενέργεια', danger: true },
  { key: 'today', label: 'Σήμερα', danger: false },
  { key: 'tomorrow', label: 'Αύριο', danger: false },
] as const;

/** Parked leads that are not part of any pipeline's stages. */
const CLOSED_SECTIONS = [
  { key: 'no_response', label: 'Χωρίς απάντηση' },
  { key: 'retargeting', label: 'Retargeting' },
  { key: 'reactivation', label: 'Επανενεργοποίηση' },
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

function LeadCard({ lead, agents, late }: { lead: LeadListItem; agents: Agent[]; late?: number | null }) {
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
        {late ? <span className="inline-flex items-center gap-0.5 rounded-md border border-signal-danger/30 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-signal-danger" title="Πέρασε το όριο ημερών του σταδίου"><AlertTriangle size={10} /> +{late} μέρ.</span> : null}
        {lead.is_returning && <span className="badge-champagne text-[10px]" title="Έχει ξαναγοράσει από εσάς">Επιστρέφων</span>}
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

function Section({ accentKey, label, danger, leads, agents, lateOf }: { accentKey: string; label: string; danger?: boolean; leads: LeadListItem[]; agents: Agent[]; lateOf?: (l: LeadListItem) => number | null }) {
  if (leads.length === 0) return null;
  const acc = STAGE_ACCENT[accentKey] ?? DEFAULT_ACCENT;
  return (
    <section className={`border-l-2 ${acc.bar} pl-3`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${acc.dot}`} />
        <h4 className={danger ? 'text-signal-danger' : 'text-charcoal'}>{label}</h4>
        <span className={`badge ${acc.badge}`}>{leads.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {leads.map((l) => <LeadCard key={l.id} lead={l} agents={agents} late={lateOf?.(l) ?? null} />)}
      </div>
    </section>
  );
}

/**
 * The leads board — priority buckets as cards. Urgency sections (Overdue/Today/
 * Tomorrow, driven by next_action_date) sit above the status pipeline sections.
 * An owner filter narrows to a single agent ("My leads") for personal focus.
 */
export function LeadBoard({ leads, agents, currentUserId, pipelines = DEFAULT_PIPELINE_SETTINGS }: { leads: LeadListItem[]; agents: Agent[]; currentUserId: string; pipelines?: PipelineSettings }) {
  const [pipeKey, setPipeKey] = useState<string>(pipelines.defaultKey);
  const [onlyLate, setOnlyLate] = useState(false);
  const pipe = pipelineOf(pipelines, pipeKey);
  const lateOf = (l: LeadListItem) => lateBy(pipelineOf(pipelines, l.pipeline ?? null), l.status, l.stage_entered_at ?? null);
  // Default to a personal view, but fall back to "All" when none are assigned to
  // me — so a freshly created lead is never hidden behind an empty "My leads".
  const hasMine = leads.some((l) => l.owner_id === currentUserId);
  const [owner, setOwner] = useState<'all' | 'mine' | string>(hasMine ? 'mine' : 'all');
  const today = localDate(0);
  const tomorrow = localDate(1);

  const inPipe = useMemo(() => leads.filter((l) => pipelineOf(pipelines, l.pipeline ?? null).key === pipe.key), [leads, pipelines, pipe.key]);
  const lateCount = inPipe.filter((l) => (lateOf(l) ?? 0) > 0).length;
  const filtered = useMemo(() => {
    const base = onlyLate ? inPipe.filter((l) => (lateOf(l) ?? 0) > 0) : inPipe;
    if (owner === 'all') return base;
    if (owner === 'mine') return base.filter((l) => l.owner_id === currentUserId);
    return base.filter((l) => l.owner_id === owner);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inPipe, owner, currentUserId, onlyLate]);

  function bucketOf(l: LeadListItem): string {
    if (!l.owner_id) return 'unassigned';
    if (['won', 'lost', 'nurture'].includes(l.status)) return 'done';
    if (l.next_action_date) {
      if (l.next_action_date < today) return 'overdue';
      if (l.next_action_date === today) return 'today';
      if (l.next_action_date === tomorrow) return 'tomorrow';
    }
    // Statuses the pipeline doesn't use show under the stage they belong to.
    const i = stageIndex(pipe, l.status);
    return i >= 0 ? pipe.stages[i].status : l.status;
  }

  const grouped = useMemo(() => {
    const m: Record<string, LeadListItem[]> = {};
    for (const l of filtered) (m[bucketOf(l)] ??= []).push(l);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, today, tomorrow]);

  return (
    <div className="space-y-6">
      {pipelines.pipelines.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {pipelines.pipelines.map((p) => {
            const n = leads.filter((l) => pipelineOf(pipelines, l.pipeline ?? null).key === p.key && !['won', 'lost'].includes(l.status)).length;
            return <button key={p.key} type="button" onClick={() => setPipeKey(p.key)} className={`rounded-md border px-3 py-1.5 text-sm ${pipe.key === p.key ? 'border-forest bg-forest text-white' : 'border-stone-line bg-white text-charcoal hover:border-forest/40'}`}>{p.name} <span className="opacity-70">{n}</span></button>;
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {lateCount > 0 && <button type="button" onClick={() => setOnlyLate((x) => !x)} className={`badge ${onlyLate ? 'border-signal-danger bg-signal-danger text-white' : 'border-signal-danger/30 bg-red-50 text-signal-danger'}`}><AlertTriangle size={11} className="mr-1 inline" />Καθυστερούν {lateCount}</button>}
        <button onClick={() => setOwner('mine')} className={`badge ${owner === 'mine' ? 'badge-forest' : 'badge-neutral'}`}>Τα δικά μου</button>
        <button onClick={() => setOwner('all')} className={`badge ${owner === 'all' ? 'badge-forest' : 'badge-neutral'}`}>Όλα</button>
        {agents.map((a) => (
          <button key={a.id} onClick={() => setOwner(a.id)} className={`badge ${owner === a.id ? 'badge-forest' : 'badge-neutral'}`}>
            {a.full_name ?? 'Agent'}
          </button>
        ))}
      </div>

      {grouped['unassigned'] && <Section accentKey="unassigned" label="Χωρίς υπεύθυνο" leads={grouped['unassigned']} agents={agents} lateOf={lateOf} />}
      {URGENCY.map((u) => <Section key={u.key} accentKey={u.key} label={u.label} danger={u.danger} leads={grouped[u.key] ?? []} agents={agents} lateOf={lateOf} />)}
      {pipe.stages.filter((st) => st.status !== 'won').map((st) => <Section key={st.status} accentKey={st.status} label={`${st.label}${st.maxDays ? ` · έως ${st.maxDays} μέρ.` : ''}`} leads={grouped[st.status] ?? []} agents={agents} lateOf={lateOf} />)}
      {CLOSED_SECTIONS.map((s) => <Section key={s.key} accentKey={s.key} label={s.label} leads={grouped[s.key] ?? []} agents={agents} />)}

      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-charcoal-600/70">Κανένα lead εδώ.</p>
      )}
    </div>
  );
}
