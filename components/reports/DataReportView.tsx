'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadTextTranslator } from '@/components/i18n/text-translator';
import { Download, Printer, Search, FileSpreadsheet } from 'lucide-react';
import { PopSelect } from '@/components/ui/PopSelect';
import { Pager } from '@/components/ui/SidePanel';
import { formatCurrency, formatDate, formatDecimal, formatMonthYear, formatNumber, formatDateTime } from '@/lib/format';
import { buildXlsx } from '@/lib/xlsx-write';
import type { CellFmt, DataReport, ReportColumn, ReportRow } from '@/lib/reports-shared';

/** Μορφοποίηση τιμής κελιού (ίδια σε οθόνη, export και εκτύπωση). */
export function fmtCell(v: string | number | null | undefined, fmt?: CellFmt): string {
  if (v === null || v === undefined || v === '') return fmt && fmt !== 'text' ? '—' : '';
  const n = Number(v);
  switch (fmt) {
    case 'money': return formatCurrency(n);
    case 'int': return formatNumber(n);
    case 'pct': return `${formatDecimal(n, Number.isInteger(n) ? 0 : 1)}%`;
    case 'days': return `${formatDecimal(n, 1)} ημ.`;
    case 'm2': return `${formatNumber(n)} m²`;
    case 'date': return formatDate(String(v));
    case 'month': return formatMonthYear(String(v));
    default: return String(v);
  }
}
const isNum = (c: ReportColumn) => !!c.fmt && !['date', 'month', 'text'].includes(c.fmt);

/**
 * Πίνακας αναφοράς (όπως στο FitnessCRM): «Εμφάνιση N εγγραφές», αναζήτηση,
 * ταξινόμηση, σελιδοποίηση και export CSV / Excel / εκτύπωση.
 */
export function DataReportView({ report, title, canExport, pageSize = 25, renderCell, empty }: { report: DataReport; title: string; canExport: boolean; pageSize?: number; renderCell?: (col: ReportColumn, row: ReportRow) => React.ReactNode | undefined; empty?: string }) {
  // Τα αρχεία (CSV / Excel / PDF) βγαίνουν στη γλώσσα του χρήστη, όπως και η οθόνη.
  const [tr, setTr] = useState<(v: string) => string>(() => (v: string) => v);
  useEffect(() => { let ok = true; loadTextTranslator().then((f) => { if (ok) setTr(() => f); }).catch(() => {}); return () => { ok = false; }; }, []);
  const cellOut = (c: ReportColumn, v: string | number | null | undefined) => (c.data ? fmtCell(v, c.fmt) : tr(fmtCell(v, c.fmt)));
  const [q, setQ] = useState('');
  const [per, setPer] = useState(pageSize);
  const [pg, setPg] = useState(0);
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 } | null>(null);
  const cols = report.columns;
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    let r = report.rows.filter((x) => !t || cols.some((c) => fmtCell(x[c.key], c.fmt).toLowerCase().includes(t)));
    if (sort) {
      const c = cols.find((x) => x.key === sort.k);
      r = [...r].sort((a, b) => {
        const x = a[sort.k], y = b[sort.k];
        if (x == null || x === '') return 1; if (y == null || y === '') return -1;
        const d = c && isNum(c) ? Number(x) - Number(y) : String(x).localeCompare(String(y), 'el', { numeric: true });
        return d * sort.dir;
      });
    }
    return r;
  }, [report.rows, cols, q, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const p = Math.min(pg, pages - 1);
  const shown = rows.slice(p * per, p * per + per);
  const exportCols = cols.filter((c) => c.label);

  const csv = (sep: string) => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [exportCols.map((c) => esc(tr(c.label))).join(sep), ...rows.map((r) => exportCols.map((c) => esc(cellOut(c, r[c.key]))).join(sep))].join('\r\n');
  };
  const xlsx = () => {
    const data = [exportCols.map((c) => tr(c.label)), ...rows.map((r) => exportCols.map((c) => { const v = r[c.key]; return isNum(c) && v != null && v !== '' ? Number(v) : cellOut(c, v); }))];
    const bytes = buildXlsx([{ name: tr(title).slice(0, 31), rows: data, widths: exportCols.map(() => 18) }]);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = `oramira-${slug}-${day}.xlsx`; a.click(); URL.revokeObjectURL(url);
  };
  const file = (name: string, body: string, type: string) => {
    const url = URL.createObjectURL(new Blob(['﻿' + body], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  };
  const slug = tr(title).toLowerCase().replace(/[^a-z0-9α-ω]+/gi, '-').replace(/^-|-$/g, '') || 'report';
  const day = new Date().toISOString().slice(0, 10);
  const print = () => {
    const w = window.open('', '_blank'); if (!w) return;
    const e = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const head = exportCols.map((c) => `<th style="text-align:${isNum(c) ? 'right' : 'left'}">${e(tr(c.label))}</th>`).join('');
    const body = rows.map((r) => `<tr>${exportCols.map((c) => `<td style="text-align:${isNum(c) ? 'right' : 'left'}">${e(cellOut(c, r[c.key]))}</td>`).join('')}</tr>`).join('');
    const sum = report.summary.map((s) => `<div class="k"><b>${e(tr(s.value))}</b><span>${e(tr(s.label))}</span></div>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${e(tr(title))}</title><style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;margin:32px}h1{font-size:22px;margin:0 0 4px}p{color:#666;margin:0 0 16px;font-size:12px}.s{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 16px}.k{border:1px solid #ddd;border-radius:10px;padding:8px 12px}.k b{display:block;font-size:16px}.k span{font-size:11px;color:#666}table{width:100%;border-collapse:collapse;font-size:12px}th{border-bottom:2px solid #222;padding:7px 8px;font-weight:600}td{padding:6px 8px;border-bottom:1px solid #eee}</style></head><body><h1>${e(tr(title))}</h1><p>${e(formatDateTime(new Date()))}${report.note ? ' · ' + e(tr(report.note)) : ''}</p><div class="s">${sum}</div><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="min-w-0 rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center gap-2 p-4 text-[14px] text-charcoal-600 sm:p-5">
        <span>Προβάλλονται</span>
        <PopSelect ariaLabel="Εγγραφές ανά σελίδα" width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); setPg(0); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
        <span>εγγραφές</span>
        <span className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <label className="relative w-full sm:w-[200px]"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" /><input value={q} onChange={(e) => { setQ(e.target.value); setPg(0); }} placeholder="Αναζήτηση…" className="input h-8 py-1 pl-8 text-[13px]" /></label>
          {canExport && <>
            <button type="button" onClick={() => file(`oramira-${slug}-${day}.csv`, csv(','), 'text/csv;charset=utf-8')} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-2.5 text-[13px] font-medium text-charcoal hover:border-forest/40"><Download size={14} /> CSV</button>
            <button type="button" onClick={xlsx} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-2.5 text-[13px] font-medium text-charcoal hover:border-forest/40"><FileSpreadsheet size={14} /> Excel (.xlsx)</button>
            <button type="button" onClick={print} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-2.5 text-[13px] font-medium text-charcoal hover:border-forest/40"><Printer size={14} /> PDF</button>
          </>}
        </span>
      </div>
      <div className="overflow-x-auto border-t border-stone-line">
        <table className="o-table">
          <thead><tr>
            {cols.map((c) => (
              <th key={c.key} className={`${c.label ? 'cursor-pointer select-none hover:text-forest' : 'w-10'} ${isNum(c) || c.align === 'right' ? 'text-right' : ''}`} onClick={() => c.label && setSort((s) => (s?.k === c.key ? { k: c.key, dir: s.dir === 1 ? -1 : 1 } : { k: c.key, dir: isNum(c) ? -1 : 1 }))}>
                {c.label}{sort?.k === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>
                {cols.map((c, j) => {
                  const custom = renderCell?.(c, r);
                  const right = isNum(c) || c.align === 'right';
                  return <td key={c.key} className={`${right ? 'text-right tabular-nums' : ''} ${j === 0 ? 'o-strong' : ''}`} {...(c.data ? { 'data-no-tr': true } : {})}>{custom !== undefined ? custom : fmtCell(r[c.key], c.fmt)}</td>;
                })}
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={cols.length} className="!py-10 text-center">{empty ?? 'Δεν υπάρχουν δεδομένα για αυτά τα φίλτρα.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length ? <Pager from={p * per + 1} to={Math.min(rows.length, p * per + per)} total={rows.length} page={p} pages={pages} onPage={setPg} /> : <p className="border-t border-stone-line px-5 py-3 text-sm text-charcoal-600">Καμία εγγραφή</p>}
    </div>
  );
}
