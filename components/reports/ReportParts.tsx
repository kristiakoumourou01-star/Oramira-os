'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PhoneCall, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { PopSelect } from '@/components/ui/PopSelect';
import { DataReportView, fmtCell } from '@/components/reports/DataReportView';
import { CHANNEL_NAME } from '@/lib/campaigns-shared';
import { formatDayMonth } from '@/lib/format';
import { PRESETS, deltaPct, type BuiltReport, type Metric, type ReportFilterKey, type ReportFilters, type ReportSummary, type Trend, type Breakdown } from '@/lib/reports-shared';

const card = 'rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]';
const val = (v: number | string | null, fmt?: Metric['fmt']) => (typeof v === 'number' || v === null ? fmtCell(v, fmt ?? 'int') : v);

/** Κουτάκια σύνοψης (χωρίς σύγκριση) — Οικονομικά, Custom report. */
export function SummaryTiles({ items }: { items: ReportSummary[] }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="min-w-0 rounded-[14px] border border-stone-line bg-white p-3 shadow-sm sm:p-4">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.05em] text-charcoal-600">{s.label}</p>
          <p className="mt-1 truncate text-[20px] font-semibold tabular-nums text-charcoal sm:text-[24px]">{val(s.value, s.fmt)}</p>
          {s.hint && <p className="text-[12px] text-charcoal-600">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}

function Delta({ cur, prev }: { cur: number | null; prev: number | null }) {
  const d = deltaPct(cur, prev);
  if (d === null) return null;
  const up = d >= 0;
  return <span className={`inline-flex items-center gap-0.5 text-[12px] font-medium tabular-nums ${up ? 'text-forest' : 'text-signal-danger'}`}>{up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{`${Math.abs(Math.round(d))}%`}</span>;
}

/** Γραμμή ημερομηνιών (όπως στο FitnessCRM): Από / Έως / Εφαρμογή, έτοιμα διαστήματα και σύγκριση με πέρσι. Γράφει στη διεύθυνση. */
export function DateBar({ f, keys, projects, agents }: { f: ReportFilters; keys: ReportFilterKey[]; projects: [string, string][]; agents: [string, string][] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [from, setFrom] = useState(f.range.from);
  const [to, setTo] = useState(f.range.to);
  const [custom, setCustom] = useState(f.preset === 'custom');
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string>) => {
    const u = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) u.set(k, v); else u.delete(k); }
    start(() => router.replace(`${path}?${u.toString()}`, { scroll: false }));
  };
  const chip = (on: boolean) => `h-8 rounded-full border px-3 text-[13px] transition-colors ${on ? 'border-forest bg-forest text-white' : 'border-stone-line bg-white text-charcoal hover:border-forest/40'}`;
  return (
    <div className={`${card} space-y-3 p-4 transition-opacity sm:p-5 ${pending ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-2 text-[14px] text-charcoal-600">
        <span>Από</span>
        <input type="date" aria-label="Από" className="input h-8 w-[150px] py-1 text-[13px]" value={from} onChange={(e) => { setFrom(e.target.value); setCustom(true); }} />
        <span>έως</span>
        <input type="date" aria-label="Έως" className="input h-8 w-[150px] py-1 text-[13px]" value={to} onChange={(e) => { setTo(e.target.value); setCustom(true); }} />
        <button type="button" disabled={!from || !to} onClick={() => set({ preset: 'custom', from, to })} className="inline-flex h-8 items-center rounded-[10px] bg-forest px-3 text-[14px] font-medium text-white hover:bg-forest/90 disabled:opacity-50">Εφαρμογή</button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map(([k, l]) => (
          <button key={k} type="button" className={chip(k === 'custom' ? custom : !custom && f.preset === k)}
            onClick={() => { if (k === 'custom') { setCustom(true); return; } setCustom(false); set({ preset: k, from: '', to: '' }); }}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-stone-line pt-3">
        <label className="inline-flex items-center gap-2 text-[13px] text-charcoal">
          <input type="checkbox" checked={f.compare} onChange={(e) => set({ compare: e.target.checked ? '' : '0' })} />
          <span>Σύγκριση με:</span> <span className="font-medium">ίδια περίοδο πέρσι</span>
        </label>
        <span className="flex flex-wrap gap-2 sm:ml-auto">
          {keys.includes('project') && <PopSelect searchable ariaLabel="Έργο" width="min-w-[160px]" value={f.project} onChange={(v) => set({ project: v })} options={[['', 'Όλα τα έργα'], ...projects]} />}
          {keys.includes('agent') && <PopSelect searchable ariaLabel="Πωλητής" width="min-w-[160px]" value={f.agent} onChange={(v) => set({ agent: v })} options={[['', 'Όλη η ομάδα'], ...agents]} />}
          {keys.includes('channel') && <PopSelect ariaLabel="Κανάλι" width="min-w-[140px]" value={f.channel} onChange={(v) => set({ channel: v })} options={[['', 'Όλα τα κανάλια'], ...(['email', 'sms', 'whatsapp', 'push'] as const).map((c) => [c, CHANNEL_NAME[c]] as [string, string])]} />}
        </span>
      </div>
    </div>
  );
}

/** Κουτάκια KPI με μεταβολή έναντι πέρσι. */
export function KpiTiles({ items, compare }: { items: Metric[]; compare: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
      {items.map((m) => (
        <div key={m.label} className="min-w-0 rounded-[14px] border border-stone-line bg-white p-3 shadow-sm sm:p-4">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.05em] text-charcoal-600">{m.label}</p>
          <p className="mt-1 truncate text-[20px] font-semibold tabular-nums text-charcoal sm:text-[24px]">{fmtCell(m.cur, m.fmt)}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-charcoal-600">
            {compare && m.prev !== null && <><Delta cur={m.cur} prev={m.prev} /><span>{`πέρσι ${fmtCell(m.prev, m.fmt)}`}</span></>}
            {m.hint && <span>{m.hint}</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Γράφημα τάσης: γραμμή της περιόδου και διακεκομμένη της ίδιας περιόδου πέρσι. */
export function TrendChart({ t, compare }: { t: Trend; compare: boolean }) {
  const W = 720, H = 220, L = 8, R = 8, T = 12, B = 26;
  const n = t.labels.length;
  const max = Math.max(1, ...t.cur, ...(compare ? t.prev : []));
  const x = (i: number) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const path = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lbl = (s: string) => (t.labelFmt === 'month' ? fmtCell(s, 'month') : formatDayMonth(s));
  const ticks = n <= 1 ? [0] : Array.from(new Set([0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1]));
  const totalCur = t.cur.reduce((a, b) => a + b, 0), totalPrev = t.prev.reduce((a, b) => a + b, 0);
  return (
    <div className={`${card} p-4 sm:p-5`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[15px] font-semibold text-charcoal">{t.title}</p>
        <span className="flex flex-wrap items-center gap-3 text-[12px] text-charcoal-600">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-forest" />Αυτή η περίοδος <b className="tabular-nums text-charcoal">{fmtCell(totalCur, t.fmt)}</b></span>
          {compare && <span className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-charcoal-600/50" />Ίδια περίοδος πέρσι <b className="tabular-nums text-charcoal">{fmtCell(totalPrev, t.fmt)}</b></span>}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[200px] w-full" preserveAspectRatio="none" role="img" aria-label={t.title}>
        {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1={L} x2={W - R} y1={y(max * g)} y2={y(max * g)} className="stroke-stone-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <path d={`${path(t.cur)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} className="fill-forest/[0.08]" />
        {compare && <path d={path(t.prev)} fill="none" className="stroke-charcoal-600/50" strokeWidth="1.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
        <path d={path(t.cur)} fill="none" className="stroke-forest" strokeWidth="2.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="relative mt-1 h-4 text-[11px] text-charcoal-600">
        {ticks.map((i) => <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(x(i) / W) * 100}%`, transform: i === 0 ? 'none' : i === n - 1 ? 'translateX(-100%)' : undefined }}>{lbl(t.labels[i])}</span>)}
      </div>
    </div>
  );
}

/** «Σύνολα σε σύγκριση»: ΓΡΑΜΜΗ | ΑΥΤΗ Η ΠΕΡΙΟΔΟΣ | ΙΔΙΑ ΠΕΡΙΟΔΟΣ ΠΕΡΣΙ | ΔΙΑΦΟΡΑ | ΔΙΑΦΟΡΑ %. */
export function TotalsCompared({ items, compare }: { items: Metric[]; compare: boolean }) {
  return (
    <div className={card}>
      <p className="px-5 pt-4 text-[15px] font-semibold text-charcoal">Σύνολα σε σύγκριση</p>
      <div className="mt-3 overflow-x-auto border-t border-stone-line">
        <table className="o-table">
          <thead><tr><th>Γραμμή</th><th className="text-right">Αυτή η περίοδος</th>{compare && <><th className="text-right">Ίδια περίοδος πέρσι</th><th className="text-right">Διαφορά</th><th className="text-right">Διαφορά %</th></>}</tr></thead>
          <tbody>
            {items.map((m) => {
              const diff = m.cur != null && m.prev != null ? m.cur - m.prev : null;
              const pct = deltaPct(m.cur, m.prev);
              return (
                <tr key={m.label}>
                  <td className="o-strong">{m.label}</td>
                  <td className="text-right tabular-nums">{fmtCell(m.cur, m.fmt)}</td>
                  {compare && <>
                    <td className="text-right tabular-nums text-charcoal-600">{fmtCell(m.prev, m.fmt)}</td>
                    <td className={`text-right tabular-nums ${diff == null ? '' : diff >= 0 ? 'text-forest' : 'text-signal-danger'}`}>{diff == null ? '—' : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${fmtCell(Math.abs(diff), m.fmt === 'pct' ? 'pct' : m.fmt)}`}</td>
                    <td className={`text-right tabular-nums ${pct == null ? '' : pct >= 0 ? 'text-forest' : 'text-signal-danger'}`}>{pct == null ? '—' : `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${fmtCell(Math.abs(Math.round(pct * 10) / 10), 'pct')}`}</td>
                  </>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Αναλύσεις (π.χ. «Πωλήσεις ανά έργο»): οριζόντιες μπάρες με ποσοστό. */
export function Breakdowns({ items }: { items: Breakdown[] }) {
  const shown = items.filter((b) => b.rows.length);
  if (!shown.length) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {shown.map((b) => {
        const total = b.rows.reduce((s, r) => s + r.value, 0) || 1;
        const max = Math.max(...b.rows.map((r) => r.value), 1);
        return (
          <div key={b.title} className={`${card} min-w-0 p-4 sm:p-5`}>
            <p className="mb-3 text-[15px] font-semibold text-charcoal">{b.title}</p>
            <div className="space-y-2.5">
              {b.rows.map((r) => (
                <div key={r.label}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="min-w-0 truncate text-charcoal" {...(b.data ? { 'data-no-tr': true } : {})}>{r.label}</span>
                    <span className="shrink-0 tabular-nums text-charcoal-600"><b className="font-semibold text-charcoal">{fmtCell(r.value, b.fmt)}</b> · {`${Math.round((r.value / total) * 100)}%`}</span>
                  </div>
                  <span className="mt-1 block h-1.5 rounded-full bg-stone-100"><span className="block h-full rounded-full bg-forest" style={{ width: `${(r.value / max) * 100}%` }} /></span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Ολόκληρο το σώμα μιας αναφοράς. */
export function ReportContent({ r, f, title, canExport, projects, agents }: { r: BuiltReport; f: ReportFilters; title: string; canExport: boolean; projects: [string, string][]; agents: [string, string][] }) {
  const [view, setView] = useState(r.details[0]?.key);
  const v = r.details.find((x) => x.key === view) ?? r.details[0];
  return (
    <div className="space-y-5">
      <DateBar key={`${f.range.from}_${f.range.to}_${f.preset}`} f={f} keys={r.filters} projects={projects} agents={agents} />
      <KpiTiles items={r.kpis} compare={f.compare} />
      {r.trend && <TrendChart t={r.trend} compare={f.compare} />}
      <TotalsCompared items={r.totals} compare={f.compare} />
      <Breakdowns items={r.breakdowns} />
      {v && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-2 text-[15px] font-semibold text-charcoal">{v.label}</p>
            {r.details.length > 1 && (
              <span className="inline-flex max-w-full flex-wrap rounded-[10px] border border-stone-line bg-white p-0.5">
                {r.details.map((x) => <button key={x.key} type="button" onClick={() => setView(x.key)} className={`rounded-lg px-3 py-1 text-[13px] font-medium transition-colors ${x.key === v.key ? 'bg-forest text-white' : 'text-charcoal-600 hover:text-charcoal'}`}>{x.label}</button>)}
              </span>
            )}
          </div>
          <DataReportView key={v.key} title={`${title} ${v.label}`} canExport={canExport} empty={v.empty}
            report={{ columns: v.columns, rows: v.rows, summary: r.kpis.map((m) => ({ label: m.label, value: fmtCell(m.cur, m.fmt) })), note: `${f.range.from} – ${f.range.to}` }} />
        </div>
      )}
      {r.note && <p className="text-[12px] text-charcoal-600">{r.note}</p>}
    </div>
  );
}

/** Κουμπί «Λίστα κλήσεων» για αναφορές με επαφές. */
export function CallListButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-2.5 text-[13px] font-medium text-charcoal hover:border-forest/40"><PhoneCall size={14} /> Λίστα κλήσεων</button>;
}
