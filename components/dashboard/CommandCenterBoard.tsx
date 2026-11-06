import Link from 'next/link';
import { ListChecks, AlertTriangle, Banknote, Users, FileWarning, Handshake, Wrench, Brain, ArrowRight } from 'lucide-react';
import type { CommandCenter, PriorityModule } from '@/lib/command-center-shared';
import { formatCurrency } from '@/lib/format';

const MOD: Record<PriorityModule, { label: string; cls: string }> = {
  lead: { label: 'Lead', cls: 'bg-champagne-50 text-champagne-600' },
  task: { label: 'Task', cls: 'bg-forest/10 text-forest' },
  approval: { label: 'Approval', cls: 'bg-olive/10 text-olive' },
  maintenance: { label: 'Maintenance', cls: 'bg-sky-500/10 text-sky-700' },
  finance: { label: 'Finance', cls: 'bg-signal-danger/10 text-signal-danger' },
};

const Block = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <div className="rounded-xl bg-white p-3.5 shadow-[0_1px_2px_rgba(31,77,58,0.04),0_6px_16px_rgba(31,77,58,0.06),inset_0_0_0_1px_rgba(31,77,58,0.04)]">
    <p className="mb-2.5 flex items-center gap-2 border-b border-stone-line/70 pb-2 text-[12px] font-semibold uppercase tracking-wide text-charcoal"><Icon size={13} strokeWidth={2} className="text-forest" /> {title}</p>
    {children}
  </div>
);
const Empty = ({ text }: { text: string }) => <p className="text-xs text-charcoal-600/55">{text}</p>;

/** The full Executive Command Center board (its own page). Read-only, deep-links. */
export function CommandCenterBoard({ data }: { data: CommandCenter }) {
  const cf = data.cashflow;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Block icon={ListChecks} title={`Top priorities · ${data.queueSize} queued`}>
          {data.topPriorities.length === 0 ? <Empty text="Nothing pressing across the business." /> : (
            <ol className="space-y-2">
              {data.topPriorities.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2.5">
                  <span className="figure w-4 shrink-0 text-xs text-charcoal-600/40">{i + 1}</span>
                  <Link href={p.href} className="min-w-0 flex-1"><span className="block truncate text-sm text-charcoal hover:text-champagne-600">{p.title}</span><span className="text-[11px] text-charcoal-600/55">{p.subtitle}</span></Link>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${MOD[p.module].cls}`}>{MOD[p.module].label}</span>
                  <span className="figure w-7 shrink-0 text-right text-xs text-forest">{p.score}</span>
                </li>
              ))}
            </ol>
          )}
        </Block>

        <Block icon={AlertTriangle} title="Biggest risks">
          {data.risks.length === 0 ? <Empty text="No material risks flagged." /> : (
            <ul className="space-y-2">
              {data.risks.map((r) => (
                <li key={r.label} className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${r.severity === 'high' ? 'bg-signal-danger ws-pulse-danger' : 'bg-signal-warning'}`} />
                  <span><span className="text-sm font-medium text-charcoal">{r.label}</span><br /><span className="text-[11px] text-charcoal-600/60">{r.detail}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block icon={Banknote} title="Cashflow risk">
          <div className="mb-2 grid grid-cols-3 gap-2 text-center">
            {([['30d', cf.net30], ['60d', cf.net60], ['90d', cf.net90]] as const).map(([label, v]) => (
              <div key={label} className="rounded-lg bg-sand-100/70 p-2">
                <p className="text-[10px] uppercase tracking-wide text-charcoal-600/50">Net {label}</p>
                <p className={`figure text-sm ${v >= 0 ? 'text-signal-success' : 'text-signal-danger'}`}>{formatCurrency(v)}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-charcoal-600/70">{cf.note}{cf.overdueReceivables > 0 ? ` ${formatCurrency(cf.overdueReceivables)} overdue to collect.` : ''}</p>
        </Block>

        <Block icon={Users} title="Team bottlenecks">
          {data.bottlenecks.length === 0 ? <Empty text="No one is overloaded right now." /> : (
            <ul className="space-y-1.5">
              {data.bottlenecks.map((b) => (
                <li key={b.name} className="flex items-center justify-between text-sm">
                  <span className="text-charcoal">{b.name}</span>
                  <span className="flex gap-2 text-[11px]">
                    {b.overdueTasks > 0 && <span className="text-signal-danger">{b.overdueTasks} overdue</span>}
                    {b.unresponded > 0 && <span className="text-champagne-600">{b.unresponded} unanswered</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block icon={FileWarning} title="Urgent contracts">
          {data.urgentContracts.length === 0 ? <Empty text="No contracts need attention." /> : (
            <ul className="space-y-1.5">
              {data.urgentContracts.map((c) => (
                <li key={c.label} className="flex items-center justify-between text-sm">
                  <span className="truncate text-charcoal">{c.label}</span>
                  <span className={`figure shrink-0 text-[11px] ${c.days <= 0 ? 'text-signal-danger' : c.days <= 7 ? 'text-champagne-600' : 'text-charcoal-600/60'}`}>{c.days <= 0 ? 'now' : `${c.days}d`}</span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block icon={Handshake} title="Urgent deals & maintenance">
          {data.urgentDeals.length === 0 && data.urgentMaintenance.length === 0 ? <Empty text="No urgent deals or tickets." /> : (
            <ul className="space-y-1.5">
              {data.urgentDeals.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/crm/leads/${d.id}`} className="truncate text-charcoal hover:text-champagne-600">{d.name}</Link>
                  <span className="shrink-0 text-[11px] text-charcoal-600/55">{d.reason}</span>
                </li>
              ))}
              {data.urgentMaintenance.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5 truncate text-charcoal"><Wrench size={11} className="text-sky-600" /> {m.title}</span>
                  <span className={`shrink-0 text-[11px] ${m.priority === 'emergency' ? 'text-signal-danger' : 'text-champagne-600'}`}>{m.priority} · {m.ageDays}d</span>
                </li>
              ))}
            </ul>
          )}
        </Block>
      </div>

      <div className="rounded-xl border border-champagne/30 bg-champagne-50/50 p-3.5">
        <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-forest"><Brain size={14} strokeWidth={1.9} /> {data.learning.headline}</p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {data.learning.items.map((it, i) => <li key={i} className="flex items-start gap-1.5 text-xs text-charcoal-600/80"><ArrowRight size={11} className="mt-0.5 shrink-0 text-champagne-600" /> {it}</li>)}
        </ul>
      </div>
    </div>
  );
}
