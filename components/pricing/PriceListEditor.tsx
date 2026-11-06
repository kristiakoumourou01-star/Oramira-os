'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Download, Printer, Save, Wand2, X, Check, Archive } from 'lucide-react';
import { setPrices, savePriceList } from '@/app/actions/pricing';
import { PriceHistory } from '@/components/pricing/PriceHistory';
import { buildXlsx } from '@/lib/xlsx-write';
import { applyBulk, pctChange, type BulkMode, type BulkOp } from '@/lib/pricing-shared';
import { STATUS_STYLE, floorLabel, statusOf } from '@/lib/unit-board-shared';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';

export interface PriceRow {
  id: string; unit_number: string; building: string | null; floor: number | null; type: string | null;
  sqm: number | null; bedrooms: number | null; price: number | null; status: string;
  last: { at: string; old: number | null; new: number | null } | null;
}
export interface PriceVersion { id: string; name: string; note: string | null; createdAt: string; by: string | null; items: any[] }

const MODES: { value: BulkMode; label: string; unit: string }[] = [
  { value: 'pct', label: 'Αλλαγή κατά %', unit: '%' },
  { value: 'amount', label: 'Αλλαγή κατά ποσό', unit: '€' },
  { value: 'per_sqm', label: 'Τιμή ανά m²', unit: '€/m²' },
  { value: 'set', label: 'Ίδια τιμή σε όλες', unit: '€' },
];
const natural = (a: string, b: string) => a.localeCompare(b, 'el', { numeric: true });
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'timokatalogos';

function download(name: string, rows: (string | number | null)[][]) {
  const bytes = buildXlsx([{ name: 'Τιμοκατάλογος', rows, widths: [12, 14, 10, 18, 8, 10, 14, 14, 10] }]);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url; a.download = `${slug(name)}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const HEAD = ['Μονάδα', 'Κτίριο', 'Όροφος', 'Τύπος', 'Υ/Δ', 'm²', 'Τιμή (€)', '€/m²', 'Κατάσταση'];
const toRow = (u: { unit_number: string; building: string | null; floor: number | null; type: string | null; bedrooms: number | null; sqm: number | null; price: number | null; status: string }) => [
  u.unit_number, u.building, u.floor === null ? null : floorLabel(u.floor), u.type, u.bedrooms, u.sqm, u.price,
  u.price && u.sqm ? Math.round(u.price / u.sqm) : null, STATUS_STYLE[statusOf(u.status)].label,
];

/** Τιμοκατάλογος έργου: τιμές, €/m², μαζικές αλλαγές με αιτιολογία, εκδόσεις, Excel. */
export function PriceListEditor({ projectId, projectName, units, versions, canEdit }: { projectId: string; projectName: string; units: PriceRow[]; versions: PriceVersion[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edits, setEdits] = useState<Record<string, number | null>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [statusF, setStatusF] = useState<'all' | 'available' | 'unsold'>('all');
  const [q, setQ] = useState('');
  const [op, setOp] = useState<BulkOp>({ mode: 'pct', value: 5, round: 1000 });
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [vName, setVName] = useState('');
  const [showClient, setShowClient] = useState(false);

  const shown = useMemo(() => units
    .filter((u) => statusF === 'all' || (statusF === 'available' ? u.status === 'available' : !['sold', 'handed_over'].includes(u.status)))
    .filter((u) => !q.trim() || `${u.unit_number} ${u.building ?? ''} ${u.type ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => natural(a.building ?? '', b.building ?? '') || natural(a.unit_number, b.unit_number)), [units, statusF, q]);
  const changed = Object.entries(edits).filter(([id, p]) => { const u = units.find((x) => x.id === id); return u && p !== null && p !== u.price; });
  const priceOf = (u: PriceRow) => (u.id in edits ? edits[u.id] : u.price);
  const allSel = shown.length > 0 && shown.every((u) => sel.has(u.id));

  const totals = useMemo(() => {
    const avail = units.filter((u) => u.status === 'available');
    const val = avail.reduce((s, u) => s + (Number(priceOf(u)) || 0), 0);
    const per = avail.filter((u) => priceOf(u) && u.sqm);
    const avgSqm = per.length ? per.reduce((s, u) => s + Number(priceOf(u)) / Number(u.sqm), 0) / per.length : null;
    return { avail: avail.length, val, avgSqm };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, edits]);

  const applyToTargets = () => {
    const targets = sel.size ? units.filter((u) => sel.has(u.id)) : units.filter((u) => u.status === 'available');
    const next = { ...edits }; let skipped = 0;
    for (const u of targets) { const n = applyBulk(u.price, u.sqm, op); if (n === null) skipped++; else next[u.id] = n; }
    setEdits(next);
    setMsg({ ok: true, text: `Προεπισκόπηση για ${targets.length - skipped} μονάδες${skipped ? ` (${skipped} χωρίς τιμή ή m² παραλείφθηκαν)` : ''}. Ελέγξτε και πατήστε Αποθήκευση.` });
  };
  const save = () => start(async () => {
    const r = await setPrices(projectId, changed.map(([id, price]) => ({ id, price: Number(price) })), reason);
    if (r.ok) { setEdits({}); setSel(new Set()); setReason(''); setMsg({ ok: true, text: `Αποθηκεύτηκαν ${r.changed} τιμές. Το ιστορικό κάθε μονάδας ενημερώθηκε.` }); router.refresh(); }
    else setMsg({ ok: false, text: r.error });
  });
  const saveVersion = () => start(async () => {
    const r = await savePriceList(projectId, vName);
    if (r.ok) { setVName(''); setMsg({ ok: true, text: 'Η έκδοση αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: r.error });
  });
  const exportCurrent = () => {
    const list = showClient ? shown.filter((u) => u.status === 'available') : shown;
    download(`${projectName} τιμοκατάλογος ${new Date().toISOString().slice(0, 10)}`, [HEAD, ...list.map((u) => toRow({ ...u, price: priceOf(u) }))]);
  };

  return (
    <div className="space-y-4">
      <div className="panel print-area space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4>Τιμοκατάλογος</h4>
            <p className="text-xs text-charcoal-600/70">
              {projectName} · {totals.avail} διαθέσιμες · αξία {formatCurrency(totals.val)}{totals.avgSqm ? ` · μέσος όρος ${formatCurrency(Math.round(totals.avgSqm))}/m²` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <input className="input w-40 py-1 text-sm" placeholder="Αναζήτηση" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input w-auto py-1 text-sm" value={statusF} onChange={(e) => setStatusF(e.target.value as any)}>
              <option value="all">Όλες οι μονάδες</option>
              <option value="unsold">Όσες δεν πουλήθηκαν</option>
              <option value="available">Μόνο διαθέσιμες</option>
            </select>
            <label className="flex items-center gap-1 text-xs" title="Excel χωρίς πωλημένες/κρατημένες — για πελάτες"><input type="checkbox" checked={showClient} onChange={(e) => setShowClient(e.target.checked)} /> Για πελάτη</label>
            <button type="button" onClick={exportCurrent} className="btn-secondary px-3 py-1.5 text-xs"><Download size={13} /> Excel</button>
            <button type="button" onClick={() => window.print()} className="btn-secondary px-3 py-1.5 text-xs"><Printer size={13} /> Εκτύπωση</button>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-end gap-2 rounded-md bg-stone/60 p-3 print:hidden">
            <Wand2 size={15} className="mb-2 text-olive" />
            <label className="block"><span className="eyebrow mb-1 block">Μαζική αλλαγή</span>
              <select className="input w-auto py-1 text-sm" value={op.mode} onChange={(e) => setOp({ ...op, mode: e.target.value as BulkMode, value: e.target.value === 'pct' ? 5 : e.target.value === 'amount' ? 5000 : e.target.value === 'per_sqm' ? 3000 : 250000 })}>
                {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
            <label className="block"><span className="eyebrow mb-1 block">Τιμή ({MODES.find((m) => m.value === op.mode)!.unit})</span>
              <input className="input w-28 py-1 text-sm" type="number" value={op.value} onChange={(e) => setOp({ ...op, value: Number(e.target.value) })} />
            </label>
            <label className="block"><span className="eyebrow mb-1 block">Στρογγυλοποίηση</span>
              <select className="input w-auto py-1 text-sm" value={op.round} onChange={(e) => setOp({ ...op, round: Number(e.target.value) as BulkOp['round'] })}>
                <option value={0}>Καμία</option><option value={100}>€100</option><option value={500}>€500</option><option value={1000}>€1.000</option><option value={5000}>€5.000</option>
              </select>
            </label>
            <button type="button" onClick={applyToTargets} className="btn-secondary px-3 py-1.5 text-xs">
              Εφαρμογή σε {sel.size ? `${sel.size} επιλεγμένες` : 'όλες τις διαθέσιμες'}
            </button>
            {op.mode === 'pct' && op.value < 0 && <span className="pb-2 text-[11px] text-charcoal-600/70">Αρνητικό = μείωση</span>}
          </div>
        )}

        <div className="overflow-x-auto rounded-md border border-stone-line">
          <table className="w-full text-sm">
            <thead className="bg-sand-100 text-left text-xs text-charcoal-600">
              <tr>
                {canEdit && <th className="w-8 px-2 py-2 print:hidden"><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(shown.map((u) => u.id)))} /></th>}
                <th className="px-2 py-2">Μονάδα</th><th className="px-2 py-2">Κτίριο</th><th className="px-2 py-2">Όροφος</th><th className="px-2 py-2">Τύπος</th>
                <th className="px-2 py-2 text-right">Υ/Δ</th><th className="px-2 py-2 text-right">m²</th><th className="px-2 py-2">Κατάσταση</th>
                <th className="px-2 py-2 text-right">Τιμή</th><th className="px-2 py-2 text-right">€/m²</th><th className="px-2 py-2 print:hidden">Τελευταία αλλαγή</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-line">
              {shown.map((u) => {
                const st = STATUS_STYLE[statusOf(u.status)];
                const p = priceOf(u);
                const dirty = u.id in edits && edits[u.id] !== u.price;
                const d = dirty ? pctChange(u.price, edits[u.id]) : null;
                const lastD = u.last ? pctChange(u.last.old, u.last.new) : null;
                return (
                  <tr key={u.id} className={dirty ? 'bg-champagne-50/60' : ''}>
                    {canEdit && <td className="px-2 py-1.5 print:hidden"><input type="checkbox" checked={sel.has(u.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(u.id)) n.delete(u.id); else n.add(u.id); return n; })} /></td>}
                    <td className="px-2 py-1.5 font-medium"><Link href={`/projects/${projectId}/units/${u.id}`} className="hover:text-forest hover:underline">{u.unit_number}</Link></td>
                    <td className="px-2 py-1.5 text-charcoal-600">{u.building ?? '—'}</td>
                    <td className="px-2 py-1.5 text-charcoal-600">{u.floor === null ? '—' : floorLabel(u.floor)}</td>
                    <td className="px-2 py-1.5 text-charcoal-600">{u.type ?? '—'}</td>
                    <td className="figure px-2 py-1.5 text-right">{u.bedrooms ?? '—'}</td>
                    <td className="figure px-2 py-1.5 text-right">{u.sqm ? formatNumber(u.sqm) : '—'}</td>
                    <td className="px-2 py-1.5"><span className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: st.bg, color: st.fg }}>{st.label}</span></td>
                    <td className="px-2 py-1.5 text-right">
                      {canEdit ? (
                        <span className="inline-flex items-center gap-1">
                          {dirty && <span className="figure text-[11px] text-charcoal-600/60 line-through print:hidden">{u.price != null ? formatNumber(u.price) : ''}</span>}
                          <input className="input w-28 py-1 text-right text-sm figure print:border-0" type="number" min={0} value={p ?? ''}
                            onChange={(e) => setEdits((x) => ({ ...x, [u.id]: e.target.value === '' ? null : Number(e.target.value) }))} />
                          {d !== null && d !== 0 && <span className={`w-12 text-[11px] ${d > 0 ? 'text-signal-success' : 'text-signal-danger'}`}>{d > 0 ? '+' : ''}{d}%</span>}
                        </span>
                      ) : <span className="figure">{formatCurrency(p)}</span>}
                    </td>
                    <td className="figure px-2 py-1.5 text-right text-charcoal-600">{p && u.sqm ? formatNumber(Math.round(p / u.sqm)) : '—'}</td>
                    <td className="px-2 py-1.5 text-xs text-charcoal-600/70 print:hidden">
                      <span className="inline-flex items-center gap-2">
                        {u.last ? <>{formatDate(u.last.at)}{lastD !== null && lastD !== 0 && <span className={lastD > 0 ? 'text-signal-success' : 'text-signal-danger'}>{lastD > 0 ? '+' : ''}{lastD}%</span>}</> : '—'}
                        <PriceHistory unitId={u.id} />
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!shown.length && <tr><td colSpan={11} className="px-3 py-6 text-center text-sm text-charcoal-600/60">Καμία μονάδα.</td></tr>}
            </tbody>
          </table>
        </div>

        {msg && <p className={`text-sm print:hidden ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</p>}
        {canEdit && changed.length > 0 && (
          <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-md border border-champagne bg-white p-3 shadow-overlay print:hidden">
            <span className="text-sm font-medium">{changed.length} αλλαγές τιμής</span>
            <input className="input flex-1 py-1.5 text-sm" placeholder="Αιτιολογία (π.χ. «Αύξηση Νοεμβρίου 5%») — φαίνεται στο ιστορικό" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
            <button type="button" disabled={pending} onClick={save} className="btn-primary"><Check size={14} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
            <button type="button" onClick={() => { setEdits({}); setMsg(null); }} className="btn-secondary"><X size={14} /> Ακύρωση</button>
          </div>
        )}
      </div>

      <div className="panel space-y-3 p-5 print:hidden">
        <h4 className="flex items-center gap-2"><Archive size={15} /> Εκδόσεις τιμοκαταλόγου</h4>
        <p className="text-xs text-charcoal-600/70">Κρατήστε ένα αντίγραφο των τιμών όπως είναι σήμερα — για να ξέρετε τι στείλατε σε συνεργάτες και πελάτες.</p>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input className="input max-w-sm flex-1 py-1.5 text-sm" placeholder={`π.χ. Τιμοκατάλογος ${new Date().toLocaleDateString('el', { month: 'long', year: 'numeric' })}`} value={vName} onChange={(e) => setVName(e.target.value)} maxLength={120} />
            <button type="button" disabled={pending || !vName.trim()} onClick={saveVersion} className="btn-secondary px-3 py-1.5 text-xs"><Save size={13} /> Αποθήκευση έκδοσης</button>
          </div>
        )}
        {versions.length === 0 ? <p className="text-sm text-charcoal-600/60">Καμία έκδοση ακόμη.</p> : (
          <div className="divide-y divide-stone-line rounded-md border border-stone-line text-sm">
            {versions.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span><b className="font-medium">{v.name}</b> <span className="text-xs text-charcoal-600/70">· {formatDateTime(v.createdAt)}{v.by ? ` · ${v.by}` : ''} · {v.items.length} μονάδες</span></span>
                <button type="button" onClick={() => download(`${projectName} ${v.name}`, [HEAD, ...v.items.map((i: any) => toRow({ unit_number: i.unit_number, building: i.building, floor: i.floor, type: i.type, bedrooms: i.bedrooms, sqm: i.sqm, price: i.price, status: i.status }))])} className="text-xs text-forest hover:underline"><Download size={12} className="mr-1 inline" />Excel</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
