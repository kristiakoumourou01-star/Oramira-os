import Link from 'next/link';
import { Flame, Clock, Timer, CalendarCheck, Handshake, ShieldAlert, TrendingUp, Video, ArrowRight, Zap } from 'lucide-react';
import type { SalesCommand, UrgencyLead, FollowUpItem } from '@/lib/sales-command';
import { formatDayMonth, formatDayMonthTime, formatTime, formatCurrency } from '@/lib/format';

const fmtMin = (m: number | null) => (m == null ? '—' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 1440)}d`);
const leadHref = (id: string | null) => (id ? `/crm/leads/${id}` : '#');

// Static class maps — Tailwind can't see dynamically built class names.
const ICON_TONE: Record<string, string> = { olive: 'text-olive', forest: 'text-forest', 'signal-danger': 'text-signal-danger', 'champagne-600': 'text-champagne-600' };
const STAT_TONE: Record<string, { wrap: string; text: string }> = {
  'signal-danger': { wrap: 'bg-signal-danger/10 text-signal-danger', text: 'text-signal-danger' },
  forest: { wrap: 'bg-forest/10 text-forest', text: 'text-forest' },
  'champagne-600': { wrap: 'bg-champagne-50 text-champagne-600', text: 'text-champagne-600' },
};

const Section = ({ icon: Icon, title, count, tone = 'olive', children }: { icon: any; title: string; count?: number; tone?: string; children: React.ReactNode }) => (
  <div className="panel p-6">
    <div className="mb-4 flex items-center justify-between">
      <h4 className="flex items-center gap-2 text-[15px] font-semibold text-forest"><Icon size={16} className={ICON_TONE[tone] ?? 'text-olive'} strokeWidth={1.8} /> {title}</h4>
      {count != null && count > 0 && <span className="figure rounded-full bg-forest/10 px-2.5 py-0.5 text-xs text-forest">{count}</span>}
    </div>
    {children}
  </div>
);
const Empty = ({ text }: { text: string }) => <p className="text-sm text-charcoal-600/60">{text}</p>;
const PRIO: Record<FollowUpItem['priority'], string> = { high: 'bg-signal-danger/10 text-signal-danger', medium: 'bg-champagne-50 text-champagne-600', low: 'bg-forest/10 text-forest' };

function UrgencyRow({ l, kind }: { l: UrgencyLead; kind: 'wait' | 'stall' | 'hot' }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <Link href={leadHref(l.id)} className="text-sm text-charcoal hover:text-champagne-600">{l.name}</Link>
        <p className="truncate text-xs text-charcoal-600/60">
          {kind === 'wait' && l.waitedMinutes != null ? `Waiting ${fmtMin(l.waitedMinutes)} for first response` : kind === 'stall' && l.stalledDays != null ? `No contact in ${l.stalledDays}d` : (l.reasons[0] ?? 'Needs attention')}
          {l.owner ? ` · ${l.owner}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {l.budget != null && <span className="figure hidden text-xs text-charcoal-600/60 sm:inline">{formatCurrency(l.budget)}</span>}
        <span className="figure rounded-md bg-champagne-50 px-1.5 py-0.5 text-xs text-champagne-600" title="Urgency score">{l.urgency}</span>
      </div>
    </li>
  );
}

/** Sales Command Center — execution-first, revenue-first cockpit. Six boards:
 *  lead urgency, follow-up deadlines, viewing prep, negotiations, reservation
 *  expiry, and agent performance. Read-only; deep-links into each record. */
export function SalesCommandCenter({ data }: { data: SalesCommand }) {
  const c = data.counts;
  const summary = [
    { label: 'Urgent leads', value: c.urgent, tone: 'signal-danger', icon: Flame },
    { label: 'Follow-ups overdue', value: c.followUpsOverdue, tone: 'signal-danger', icon: Clock },
    { label: 'Viewings today', value: c.viewingsToday, tone: 'forest', icon: CalendarCheck },
    { label: 'Active negotiations', value: c.negotiations, tone: 'forest', icon: Handshake },
    { label: 'Reservations expiring', value: c.reservationsExpiring, tone: 'champagne-600', icon: ShieldAlert },
  ];

  return (
    <div className="space-y-6">
      {/* Executive strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {summary.map((s) => {
          const t = STAT_TONE[s.tone] ?? STAT_TONE.forest;
          return (
            <div key={s.label} className="panel flex items-center gap-3 p-4">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.wrap}`}><s.icon size={16} strokeWidth={1.8} /></span>
              <div><p className={`figure text-2xl leading-none ${t.text}`}>{s.value}</p><p className="text-[11px] text-charcoal-600/60">{s.label}</p></div>
            </div>
          );
        })}
      </div>

      {/* 1 · Lead Urgency Board */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Section icon={Zap} title="First-response overdue" tone="signal-danger" count={data.urgency.firstResponseOverdue.length}>
          {data.urgency.firstResponseOverdue.length === 0 ? <Empty text="Every new lead has been answered. 🎉" /> : (
            <ul className="divide-y divide-stone-line">{data.urgency.firstResponseOverdue.slice(0, 10).map((l) => <UrgencyRow key={l.id} l={l} kind="wait" />)}</ul>
          )}
        </Section>
        <Section icon={Flame} title="Hot leads" tone="champagne-600" count={data.urgency.hot.length}>
          {data.urgency.hot.length === 0 ? <Empty text="No hot leads waiting." /> : (
            <ul className="divide-y divide-stone-line">{data.urgency.hot.slice(0, 10).map((l) => <UrgencyRow key={l.id} l={l} kind="hot" />)}</ul>
          )}
        </Section>
        <Section icon={Timer} title="Stalled deals" tone="olive" count={data.urgency.stalled.length}>
          {data.urgency.stalled.length === 0 ? <Empty text="No stalled deals in the pipeline." /> : (
            <ul className="divide-y divide-stone-line">{data.urgency.stalled.slice(0, 10).map((l) => <UrgencyRow key={l.id} l={l} kind="stall" />)}</ul>
          )}
        </Section>
      </div>

      {/* 2 · Follow-up Deadlines */}
      <Section icon={Clock} title="Follow-up deadlines" tone="olive">
        <div className="grid gap-6 md:grid-cols-3">
          {([['Overdue', data.followUps.overdue], ['Today', data.followUps.today], ['Upcoming', data.followUps.upcoming]] as const).map(([label, items]) => (
            <div key={label}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-charcoal-600/50">{label} · {items.length}</p>
              {items.length === 0 ? <Empty text="Nothing here." /> : (
                <ul className="space-y-2">{items.slice(0, 8).map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2">
                    <Link href={leadHref(f.leadId)} className="min-w-0 flex-1"><span className="block truncate text-sm text-charcoal hover:text-champagne-600">{f.note}</span><span className="text-[11px] text-charcoal-600/55">{f.name ? `${f.name} · ` : ''}{formatDayMonthTime(new Date(f.dueAt))}</span></Link>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] capitalize ${PRIO[f.priority]}`}>{f.priority}</span>
                  </li>
                ))}</ul>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* 3 · Viewing Prep Board */}
      <Section icon={CalendarCheck} title="Viewing prep — today" tone="forest" count={data.viewingPrep.length}>
        {data.viewingPrep.length === 0 ? <Empty text="No viewings scheduled today." /> : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.viewingPrep.map((v) => (
              <div key={v.id} className="rounded-xl border border-stone-line bg-sand-100/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div><p className="text-sm font-medium text-charcoal">{v.contact}</p><p className="text-xs text-charcoal-600/60">{[v.project, v.unit].filter(Boolean).join(' · ') || 'Property TBC'}</p></div>
                  <span className="figure text-sm text-forest">{formatTime(new Date(v.time))}</span>
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {v.documents.map((d) => <span key={d} className="rounded bg-white px-1.5 py-0.5 text-[10px] text-charcoal-600/70 ring-1 ring-stone-line">{d}</span>)}
                </div>
                {v.notes && <p className="mb-2 line-clamp-2 text-xs italic text-charcoal-600/70">“{v.notes}”</p>}
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] ${v.reminderSent ? 'text-forest' : 'text-champagne-600'}`}>{v.reminderSent ? '✓ Reminder sent' : '⚠ Reminder pending'}</span>
                  <div className="flex items-center gap-2">
                    {v.meetingLink && <a href={v.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-700"><Video size={10} /> Join</a>}
                    <span className="flex items-center gap-1 text-[11px] font-medium text-forest">{v.nextAction} <ArrowRight size={11} /></span>
                  </div>
                </div>
                {v.leadId && <Link href={leadHref(v.leadId)} className="mt-1 block text-[11px] text-charcoal-600/50 hover:text-forest">Open lead →</Link>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 4 · Negotiation Tracker */}
      <Section icon={Handshake} title="Negotiation tracker" tone="olive" count={data.negotiations.length}>
        {data.negotiations.length === 0 ? <Empty text="No active negotiations." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-charcoal-600/50"><th className="pb-2 pr-3">Lead</th><th className="pb-2 pr-3">Unit</th><th className="pb-2 pr-3 text-right">Offered</th><th className="pb-2 pr-3 text-right">Counter</th><th className="pb-2 pr-3">Objections / latest</th><th className="pb-2 pr-3">Deadline</th><th className="pb-2">Next action</th></tr></thead>
              <tbody>
                {data.negotiations.map((n) => (
                  <tr key={n.id} className="border-t border-stone-line align-top">
                    <td className="py-2.5 pr-3"><Link href={leadHref(n.leadId)} className="text-charcoal hover:text-champagne-600">{n.name}</Link></td>
                    <td className="py-2.5 pr-3 text-charcoal-600/70">{n.unit ?? '—'}</td>
                    <td className="py-2.5 pr-3 text-right figure text-charcoal">{formatCurrency(n.offered)}</td>
                    <td className="py-2.5 pr-3 text-right figure text-champagne-600">{formatCurrency(n.counter)}</td>
                    <td className="py-2.5 pr-3 text-charcoal-600/70"><span className="line-clamp-1">{n.objections || n.latestComm || '—'}</span></td>
                    <td className="py-2.5 pr-3 text-charcoal-600/70">{n.nextActionDeadline ? formatDayMonth(new Date(n.nextActionDeadline)) : '—'}</td>
                    <td className="py-2.5 text-forest">{n.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* 5 · Reservation Expiry Tracker */}
      <Section icon={ShieldAlert} title="Reservation expiry tracker" tone="champagne-600" count={data.reservations.length}>
        {data.reservations.length === 0 ? <Empty text="No active reservations." /> : (
          <ul className="divide-y divide-stone-line">
            {data.reservations.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-charcoal">{r.buyer}{r.unit ? ` · ${r.unit}` : ''}</p>
                  <p className="text-xs text-charcoal-600/60">
                    Deposit {formatCurrency(r.deposit)} {r.depositPaid ? <span className="text-forest">(paid)</span> : <span className="text-signal-danger">(unpaid)</span>}
                    {r.contractPending ? ' · contract pending' : ' · contract issued'}
                  </p>
                  {r.urgentLegal && <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-signal-danger"><ShieldAlert size={11} /> {r.urgentLegal}</p>}
                </div>
                <span className={`figure shrink-0 rounded-md px-2 py-1 text-xs ${r.daysLeft == null ? 'bg-sand-100 text-charcoal-600/70' : r.daysLeft < 0 ? 'bg-signal-danger/10 text-signal-danger' : r.daysLeft <= 3 ? 'bg-champagne-50 text-champagne-600' : 'bg-forest/10 text-forest'}`}>
                  {r.daysLeft == null ? 'no expiry' : r.daysLeft < 0 ? `expired ${Math.abs(r.daysLeft)}d ago` : r.daysLeft === 0 ? 'expires today' : `${r.daysLeft}d left`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 6 · Agent Performance Board */}
      <Section icon={TrendingUp} title="Agent performance" tone="forest">
        {data.agents.length === 0 ? <Empty text="No agent activity yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-charcoal-600/50"><th className="pb-2 pr-3">Agent</th><th className="pb-2 pr-3 text-right">Resp. speed</th><th className="pb-2 pr-3 text-right">Conv.</th><th className="pb-2 pr-3 text-right">Pipeline</th><th className="pb-2 pr-3 text-right">Viewings</th><th className="pb-2 pr-3 text-right">Reservations</th><th className="pb-2 text-right">Commission pending</th></tr></thead>
              <tbody>
                {data.agents.map((a) => (
                  <tr key={a.agentId} className="border-t border-stone-line">
                    <td className="py-2.5 pr-3 text-charcoal">{a.name}</td>
                    <td className="py-2.5 pr-3 text-right figure text-charcoal-600">{fmtMin(a.responseSpeedMin)}</td>
                    <td className="py-2.5 pr-3 text-right figure text-forest">{a.conversionPct}%</td>
                    <td className="py-2.5 pr-3 text-right figure text-charcoal">{formatCurrency(a.pipelineValue)}</td>
                    <td className="py-2.5 pr-3 text-right figure text-charcoal-600">{a.viewingsBooked}</td>
                    <td className="py-2.5 pr-3 text-right figure text-charcoal-600">{a.reservationsClosed}</td>
                    <td className="py-2.5 text-right figure text-champagne-600">{formatCurrency(a.commissionPending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
