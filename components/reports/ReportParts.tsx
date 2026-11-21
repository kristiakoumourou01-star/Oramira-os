'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2, PhoneCall } from 'lucide-react';
import { PopSelect } from '@/components/ui/PopSelect';
import { DataReportView, fmtCell } from '@/components/reports/DataReportView';
import { saveMarketingSpend, deleteMarketingSpend } from '@/app/actions/marketing-spend';
import { CHANNEL_NAME } from '@/lib/campaigns-shared';
import { LEAD_SOURCES, PERIODS, type BuiltReport, type ReportChart as Chart, type ReportFilterKey, type ReportFilters, type ReportSummary } from '@/lib/reports-shared';

/** Κουτάκια σύνοψης πάνω από την αναφορά. */
export function SummaryTiles({ items }: { items: ReportSummary[] }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="min-w-0 rounded-[14px] border border-stone-line bg-white p-3 shadow-sm sm:p-4">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.05em] text-charcoal-600">{s.label}</p>
          <p className="mt-1 truncate text-[20px] font-semibold tabular-nums text-charcoal sm:text-[24px]">{typeof s.value === 'number' || s.value === null ? fmtCell(s.value, s.fmt ?? 'int') : s.value}</p>
          {s.hint && <p className="text-[12px] text-charcoal-600">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}

/** Οριζόντιες μπάρες (1–2 σειρές) στο χρώμα της εταιρείας — διαβάζονται και σε κινητό. */
export function ReportChart({ chart }: { chart: Chart }) {
  const max = Math.max(1, ...chart.series.flatMap((s) => s.values));
  const idx = chart.labels.map((_, i) => i).filter((i) => chart.series.some((s) => s.values[i] > 0));
  if (!idx.length) return null;
  const top = idx.slice(0, 15);
  const tone = ['bg-forest', 'bg-forest/35'];
  return (
    <div className="rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-semibold text-charcoal">{chart.title}</p>
        {chart.series.length > 1 && <span className="flex gap-3 text-[12px] text-charcoal-600">{chart.series.map((s, k) => <span key={s.name} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${tone[k]}`} />{s.name}</span>)}</span>}
      </div>
      <div className="space-y-2.5">
        {top.map((i) => (
          <div key={i} className="grid grid-cols-[minmax(0,110px)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,180px)_1fr]">
            <span className="truncate text-[13px] text-charcoal" {...(chart.dataLabels ? { 'data-no-tr': true } : {})}>{chart.labelFmt === 'month' ? fmtCell(chart.labels[i], 'month') : chart.labels[i]}</span>
            <span className="space-y-1">
              {chart.series.map((s, k) => (
                <span key={s.name} className="flex items-center gap-2">
                  <span className="h-2.5 rounded-full bg-stone-100" style={{ width: '100%' }}><span className={`block h-full rounded-full ${tone[k]}`} style={{ width: `${Math.max(s.values[i] > 0 ? 2 : 0, (s.values[i] / max) * 100)}%` }} /></span>
                  <span className="w-20 shrink-0 text-right text-[12px] tabular-nums text-charcoal-600 sm:w-24">{fmtCell(s.values[i], chart.fmt ?? 'int')}</span>
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Φίλτρα αναφοράς — γράφονται στη διεύθυνση, ο server ξαναϋπολογίζει. */
export function ReportFilterBar({ keys, value, projects, agents }: { keys: ReportFilterKey[]; value: ReportFilters; projects: [string, string][]; agents: [string, string][] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string>) => {
    const u = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) u.set(k, v); else u.delete(k); }
    start(() => router.replace(`${path}?${u.toString()}`, { scroll: false }));
  };
  if (!keys.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      {keys.includes('period') && (
        <span className="flex flex-wrap gap-1.5">
          {PERIODS.map(([k, l]) => <button key={k} type="button" onClick={() => set({ period: k, ...(k === 'custom' ? {} : { from: '', to: '' }) })} className={`h-8 rounded-full border px-3 text-[13px] transition-colors ${value.period === k ? 'border-forest bg-forest text-white' : 'border-stone-line bg-white text-charcoal hover:border-forest/40'}`}>{l}</button>)}
        </span>
      )}
      {keys.includes('period') && value.period === 'custom' && (
        <span className="flex items-center gap-1.5">
          <input type="date" aria-label="Από" className="input h-8 w-auto py-1 text-[13px]" defaultValue={value.from ?? ''} onChange={(e) => set({ from: e.target.value })} />
          <span className="text-charcoal-600">–</span>
          <input type="date" aria-label="Έως" className="input h-8 w-auto py-1 text-[13px]" defaultValue={value.to ?? ''} onChange={(e) => set({ to: e.target.value })} />
        </span>
      )}
      <span className="flex flex-wrap gap-2 sm:ml-auto">
        {keys.includes('project') && <PopSelect searchable ariaLabel="Έργο" width="min-w-[160px]" value={value.project} onChange={(v) => set({ project: v })} options={[['', 'Όλα τα έργα'], ...projects]} />}
        {keys.includes('agent') && <PopSelect searchable ariaLabel="Πωλητής" width="min-w-[160px]" value={value.agent} onChange={(v) => set({ agent: v })} options={[['', 'Όλη η ομάδα'], ...agents]} />}
        {keys.includes('channel') && <PopSelect ariaLabel="Κανάλι" width="min-w-[140px]" value={value.channel} onChange={(v) => set({ channel: v })} options={[['', 'Όλα τα κανάλια'], ...(['email', 'sms', 'whatsapp', 'push'] as const).map((c) => [c, CHANNEL_NAME[c]] as [string, string])]} />}
      </span>
    </div>
  );
}

/** Οι πίνακες της αναφοράς (με επιλογή προβολής) — και το κόστος marketing στα Leads. */
export function ReportBody({ reportKey, report, title, canExport, canEdit, initialView }: { reportKey: string; report: BuiltReport; title: string; canExport: boolean; canEdit: boolean; initialView?: string }) {
  const [view, setView] = useState(report.views.some((v) => v.key === initialView) ? initialView! : report.views[0]?.key);
  const v = report.views.find((x) => x.key === view) ?? report.views[0];
  const router = useRouter();
  const [, start] = useTransition();
  if (!v) return null;
  const spend = reportKey === 'leads' && v.key === 'spend';
  const summary = report.summary.map((s) => ({ label: s.label, value: typeof s.value === 'number' || s.value === null ? fmtCell(s.value, s.fmt ?? 'int') : s.value }));
  return (
    <div className="space-y-3">
      {report.views.length > 1 && (
        <span className="inline-flex max-w-full flex-wrap rounded-[10px] border border-stone-line bg-white p-0.5">
          {report.views.map((x) => <button key={x.key} type="button" onClick={() => setView(x.key)} className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${x.key === v.key ? 'bg-forest text-white' : 'text-charcoal-600 hover:text-charcoal'}`}>{x.label}</button>)}
        </span>
      )}
      {spend && canEdit && <SpendForm onDone={() => router.refresh()} />}
      <DataReportView key={v.key} title={`${title} — ${v.label}`} canExport={canExport} empty={v.empty}
        report={{ columns: v.columns, rows: v.rows, summary, note: report.note }}
        renderCell={spend ? (c, r) => (c.key === '_id' ? (canEdit ? <button type="button" aria-label="Διαγραφή" title="Διαγραφή" onClick={() => { if (confirm('Διαγραφή αυτής της καταχώρισης;')) start(async () => { await deleteMarketingSpend(String(r._id)); router.refresh(); }); }} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-rose-50 hover:text-signal-danger"><Trash2 size={15} /></button> : null) : undefined) : undefined} />
    </div>
  );
}

function SpendForm({ onDone }: { onDone: () => void }) {
  const [m, setM] = useState(new Date().toISOString().slice(0, 7));
  const [src, setSrc] = useState('meta');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => { const r = await saveMarketingSpend({ month: m, source: src, amount: Number(amount), note }); if (!r.ok) { setErr(r.error); return; } setErr(null); setAmount(''); setNote(''); onDone(); });
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <label className="block"><span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Μήνας</span><input type="month" className="input h-9 w-auto py-1 text-sm" value={m} onChange={(e) => setM(e.target.value)} /></label>
      <div><span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Πηγή</span><PopSelect width="min-w-[170px]" value={src} onChange={setSrc} options={LEAD_SOURCES} /></div>
      <label className="block"><span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Ποσό (€)</span><input type="number" min="0" className="input h-9 w-32 py-1 text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label className="block min-w-[160px] flex-1"><span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Σημείωση</span><input className="input h-9 py-1 text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="π.χ. Καμπάνια Meta — Λεμεσός" /></label>
      <button type="button" disabled={pending || !amount || !m} onClick={save} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-forest px-3 text-[14px] font-medium text-white hover:bg-forest/90 disabled:opacity-50"><Plus size={15} /> Καταχώριση κόστους</button>
      {err && <p className="w-full text-sm text-signal-danger">{err}</p>}
    </div>
  );
}

/** Κουμπί «Λίστα κλήσεων» για αναφορές με επαφές. */
export function CallListButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-line bg-white px-3 py-1.5 text-[13px] font-medium text-charcoal hover:border-forest/40"><PhoneCall size={14} /> Λίστα κλήσεων</button>;
}
