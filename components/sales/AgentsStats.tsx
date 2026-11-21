'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus, Wallet } from 'lucide-react';
import { pct, type AgentStat, type SourceCost } from '@/lib/sales-hub-shared';
import { saveSourceCost } from '@/app/actions/lead-source-costs';
import { formatCurrency } from '@/lib/format';
import { PopSelect } from '@/components/ui/PopSelect';
import { Pager } from '@/components/ui/SidePanel';

const SRC: Record<string, string> = { website: 'Website', meta: 'Meta', google: 'Google', organic: 'Organic', referral: 'Σύσταση', whatsapp: 'WhatsApp', walk_in: 'Walk-in', portal: 'Portal', other: 'Άλλο' };
const dash = <span className="text-charcoal-600/50">—</span>;
function mins(m: number | null) {
  if (m === null) return dash;
  if (m < 60) return <span>{`${m} λεπτά`}</span>;
  if (m < 1440) return <span>{`${Math.round(m / 60)} ώρες`}</span>;
  return <span>{`${Math.round(m / 1440)} μέρες`}</span>;
}
function rate(a: number, b: number) {
  const p = pct(a, b);
  if (p === null) return dash;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-stone-100 sm:inline-block"><span className="block h-full rounded-full bg-forest" style={{ width: `${Math.max(3, p)}%` }} /></span>
      <span className="tabular-nums">{p}%</span>
    </span>
  );
}

/** Διαχείριση leads → Agents: στατιστικά ανά συνεργάτη σε έναν καθαρό πίνακα. */
export function AgentsStats({ rows, unassigned, hasCosts, costs, sources, canEditCosts }: { rows: AgentStat[]; unassigned: number; hasCosts: boolean; costs: SourceCost[]; sources: string[]; canEditCosts: boolean }) {
  const [per, setPer] = useState(10);
  const [pageNo, setPageNo] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const pg = Math.min(pageNo, pages - 1);
  const page = rows.slice(pg * per, pg * per + per);
  const tot = useMemo(() => rows.reduce((s, r) => ({ assigned: s.assigned + r.assigned, contacted: s.contacted + r.contacted, viewings: s.viewings + r.viewings, won: s.won + r.won, cost: r.cost === null ? s.cost : (s.cost ?? 0) + r.cost }), { assigned: 0, contacted: 0, viewings: 0, won: 0, cost: null as number | null }), [rows]);

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 flex-col rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-2 p-4 text-[14px] text-charcoal-600 sm:p-5">
          <span>Εμφάνιση</span>
          <PopSelect ariaLabel="Εγγραφές ανά σελίδα" width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); setPageNo(0); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          <span>εγγραφές</span>
          {unassigned > 0 && <span className="ml-auto rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[12px] font-medium text-amber-800">{`${unassigned} leads χωρίς υπεύθυνο`}</span>}
        </div>
        <div className="overflow-x-auto border-t border-stone-line">
          <table className="o-table">
            <thead><tr>
              <th>Agent</th><th className="text-right">Leads</th><th>Επικοινωνία</th><th>Προβολή</th><th>Πώληση</th>
              <th className="text-right">Χρόνος απάντησης</th><th className="text-right">Σημειώσεις</th><th className="text-right">Activities</th><th className="text-right">Εκπρόθεσμα</th>
              <th className="text-right">Κόστος / lead</th><th className="text-right">Κόστος / πώληση</th>
            </tr></thead>
            <tbody>
              {page.map((r) => (
                <tr key={r.agentId}>
                  <td className="o-strong" data-no-tr>{r.name}</td>
                  <td className="text-right font-semibold tabular-nums">{r.assigned}</td>
                  <td>{rate(r.contacted, r.assigned)}</td>
                  <td>{rate(r.viewings, r.assigned)}</td>
                  <td>{rate(r.won, r.assigned)} {r.won > 0 && <span className="ml-1 text-xs text-charcoal-600/70 tabular-nums">({r.won})</span>}</td>
                  <td className="text-right">{mins(r.responseMin)}</td>
                  <td className="text-right tabular-nums">{r.notes}</td>
                  <td className="text-right tabular-nums">{r.activitiesDone}</td>
                  <td className={`text-right tabular-nums ${r.overdue ? 'font-semibold text-signal-danger' : ''}`}>{r.overdue}</td>
                  <td className="text-right tabular-nums">{r.cost !== null && r.assigned ? formatCurrency(Math.round(r.cost / r.assigned)) : dash}</td>
                  <td className="text-right tabular-nums">{r.cost !== null && r.won ? formatCurrency(Math.round(r.cost / r.won)) : dash}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={11} className="py-10 text-center text-sm text-charcoal-600">Κανένα lead με υπεύθυνο σε αυτό το διάστημα.</td></tr>}
              {rows.length > 1 && (
                <tr className="bg-stone-50/70">
                  <td className="o-strong">Σύνολο</td>
                  <td className="text-right font-semibold tabular-nums">{tot.assigned}</td>
                  <td>{rate(tot.contacted, tot.assigned)}</td><td>{rate(tot.viewings, tot.assigned)}</td><td>{rate(tot.won, tot.assigned)}</td>
                  <td /><td /><td /><td />
                  <td className="text-right tabular-nums">{tot.cost !== null && tot.assigned ? formatCurrency(Math.round(tot.cost / tot.assigned)) : dash}</td>
                  <td className="text-right tabular-nums">{tot.cost !== null && tot.won ? formatCurrency(Math.round(tot.cost / tot.won)) : dash}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager from={rows.length ? pg * per + 1 : 0} to={Math.min(rows.length, pg * per + per)} total={rows.length} page={pg} pages={pages} onPage={setPageNo} />
      </div>
      <p className="text-xs text-charcoal-600/70">
        <span>Leads που ήρθαν στο διάστημα, ανά υπεύθυνο. Επικοινωνία = υπάρχει κλήση, σημείωση ή ολοκληρωμένη κίνηση. Χρόνος απάντησης = διάμεσος χρόνος από την ανάθεση ως την πρώτη επαφή.</span>
        {!hasCosts && <span>{' '}Το κόστος ανά lead εμφανίζεται όταν καταχωρίσετε κόστος πηγών.</span>}
      </p>
      {canEditCosts && <CostEditor costs={costs} sources={sources} />}
    </div>
  );
}

function CostEditor({ costs, sources }: { costs: SourceCost[]; sources: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [src, setSrc] = useState(sources[0] ?? '');
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const save = (s: string, m: string, a: number | null) => start(async () => { const r = await saveSourceCost(s, m, a); if (!r.ok) { setErr(r.error); return; } setErr(null); setAmount(''); router.refresh(); });
  const opts = [...new Set([...sources, ...costs.map((c) => c.source)])];
  return (
    <section className="rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <button type="button" onClick={() => setOpen((x) => !x)} className="flex w-full items-center gap-2 px-4 py-3 text-left sm:px-5">
        <Wallet size={16} className="text-forest" />
        <span className="font-semibold text-charcoal">Κόστος ανά πηγή</span>
        <span className="text-[13px] text-charcoal-600">{`${costs.length} καταχωρήσεις`}</span>
        <ChevronDown size={16} className={`ml-auto text-charcoal-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-stone-line p-4 sm:p-5">
          <p className="text-[13px] text-charcoal-600">Πόσα ξοδέψατε ανά μήνα σε κάθε πηγή (διαφημίσεις, portals). Μοιράζεται στα leads της πηγής εκείνου του μήνα.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-charcoal-600/80"><span className="mb-1 block">Πηγή</span>
              <PopSelect width="min-w-[140px]" ariaLabel="Πηγή" value={src} onChange={setSrc} options={opts.map((x) => [x, SRC[x] ?? x] as [string, string])} /></label>
            <label className="text-xs text-charcoal-600/80"><span className="mb-1 block">Μήνας</span>
              <input type="month" className="input h-8 py-1 text-[13px]" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
            <label className="text-xs text-charcoal-600/80"><span className="mb-1 block">Ποσό €</span>
              <input inputMode="decimal" className="input h-8 w-28 py-1 text-[13px]" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} /></label>
            <button type="button" disabled={pending || !src || !amount} onClick={() => save(src, month, Number(amount.replace(',', '.')))} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-3 text-[13px] font-medium text-white hover:bg-forest/90 disabled:opacity-60"><Plus size={14} /> Αποθήκευση</button>
          </div>
          {err && <p className="text-sm text-signal-danger">{err}</p>}
          {costs.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-stone-line">
              <table className="o-table">
                <thead><tr><th>Πηγή</th><th>Μήνας</th><th className="text-right">Ποσό</th><th className="text-right">Ενέργειες</th></tr></thead>
                <tbody>{costs.slice(0, 24).map((c) => (
                  <tr key={c.id}><td>{SRC[c.source] ?? c.source}</td><td className="tabular-nums">{c.month}</td><td className="text-right tabular-nums">{formatCurrency(c.amount)}</td>
                    <td className="text-right"><button type="button" disabled={pending} onClick={() => save(c.source, c.month, null)} className="text-[13px] text-charcoal-600 hover:text-signal-danger">Διαγραφή</button></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
