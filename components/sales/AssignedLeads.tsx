'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Hand, UserCheck } from 'lucide-react';
import type { AssignedLeadRow } from '@/lib/sales-hub-shared';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';
import { Pager } from '@/components/ui/SidePanel';

const SRC: Record<string, string> = { website: 'Website', meta: 'Meta', google: 'Google', organic: 'Organic', referral: 'Σύσταση', whatsapp: 'WhatsApp', walk_in: 'Walk-in', portal: 'Portal', other: 'Άλλο' };
const PERIODS = [['7', '7 μέρες'], ['30', '30 μέρες'], ['60', '60 μέρες']] as const;

/**
 * Για τον Owner / Manager: ποιος συνεργάτης ανέλαβε ποιο lead (μόνος του από τα
 * «Νέα leads» ή με ανάθεση από άλλον) και πότε — με σύνοψη ανά συνεργάτη.
 */
export function AssignedLeads({ rows }: { rows: AssignedLeadRow[] }) {
  const [agent, setAgent] = useState<string>('all');
  const [period, setPeriod] = useState<string>('30');
  const [page, setPage] = useState(0);
  const size = 25;
  const tag = DATE_TAG[currentLocale().lang];
  const since = Date.now() - Number(period) * 86400000;
  const inPeriod = useMemo(() => rows.filter((r) => Date.parse(r.assignedAt ?? r.createdAt) >= since), [rows, since]);
  const byAgent = useMemo(() => {
    const m = new Map<string, { id: string; name: string; total: number; self: number; notContacted: number }>();
    for (const r of inPeriod) {
      if (!r.assignedTo) continue;
      const x = m.get(r.assignedTo) ?? { id: r.assignedTo, name: r.assignedToName ?? '—', total: 0, self: 0, notContacted: 0 };
      x.total += 1; if (r.assignedBy === r.assignedTo) x.self += 1; if (!r.contacted) x.notContacted += 1;
      m.set(r.assignedTo, x);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [inPeriod]);
  const list = agent === 'all' ? inPeriod : inPeriod.filter((r) => r.assignedTo === agent);
  const pages = Math.max(1, Math.ceil(list.length / size));
  const shown = list.slice(page * size, (page + 1) * size);
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(tag, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-charcoal-600">Ποιος ανέλαβε ποιο lead και πότε. Πατήστε έναν συνεργάτη για να δείτε μόνο τα δικά του.</p>
        <span className="inline-flex rounded-xl border border-stone-line bg-white p-1">
          {PERIODS.map(([k, label]) => (
            <button key={k} type="button" onClick={() => { setPeriod(k); setPage(0); }} className={`rounded-lg px-3 py-1 text-[13px] ${period === k ? 'bg-forest text-white' : 'text-charcoal hover:bg-forest/[0.06]'}`}>{label}</button>
          ))}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={() => { setAgent('all'); setPage(0); }}
          className={`rounded-2xl border p-4 text-left transition ${agent === 'all' ? 'border-forest/40 bg-gradient-to-br from-white to-forest/[0.10]' : 'border-stone-line bg-white hover:border-forest/30'}`}>
          <p className="text-xs text-charcoal-600">Όλοι</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-charcoal">{inPeriod.length}</p>
          <p className="text-xs text-charcoal-600">leads με υπεύθυνο</p>
        </button>
        {byAgent.map((a) => (
          <button key={a.id} type="button" onClick={() => { setAgent(a.id); setPage(0); }}
            className={`rounded-2xl border p-4 text-left transition ${agent === a.id ? 'border-forest/40 bg-gradient-to-br from-white to-forest/[0.10]' : 'border-stone-line bg-white hover:border-forest/30'}`}>
            <p className="truncate text-sm font-medium text-charcoal" data-no-tr>{a.name}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-charcoal">{a.total}</p>
            <p className="text-xs text-charcoal-600"><span>τα ανέλαβε μόνος/η:</span> <span className="tabular-nums">{a.self}</span></p>
            {a.notContacted > 0 && <p className="text-xs text-signal-danger"><span>χωρίς επικοινωνία:</span> <span className="tabular-nums">{a.notContacted}</span></p>}
          </button>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="o-table">
            <thead><tr><th>Lead</th><th>Πηγή</th><th>Υπεύθυνος</th><th>Πώς</th><th>Πότε</th><th>Επικοινωνία</th></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-charcoal-600">Δεν υπάρχουν αναθέσεις σε αυτό το διάστημα.</td></tr>}
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/crm/leads/${r.id}`} className="font-medium text-charcoal hover:text-forest" data-no-tr>{r.name ?? '—'}</Link></td>
                  <td>{r.source ? SRC[r.source] ?? r.source : '—'}</td>
                  <td data-no-tr>{r.assignedToName ?? '—'}</td>
                  <td>
                    {r.assignedBy && r.assignedBy === r.assignedTo
                      ? <span className="inline-flex items-center gap-1 text-charcoal"><Hand size={13} /> <span>Ανάληψη</span></span>
                      : <span className="inline-flex items-center gap-1 text-charcoal-600"><UserCheck size={13} /> <span>Ανάθεση από</span> <span data-no-tr>{r.assignedByName ?? 'σύστημα'}</span></span>}
                  </td>
                  <td className="tabular-nums">{when(r.assignedAt ?? r.createdAt)}</td>
                  <td>{r.contacted ? <span className="text-charcoal">Ναι</span> : <span className="text-signal-danger">Όχι ακόμη</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager from={list.length ? page * size + 1 : 0} to={Math.min(list.length, (page + 1) * size)} total={list.length} page={page} pages={pages} onPage={setPage} />
      </div>
    </div>
  );
}
