'use client';

import { useMemo, useState } from 'react';
import { Download, Printer, Search, FileSpreadsheet } from 'lucide-react';
import type { DataReport } from '@/lib/data-reports';

/** Πίνακας αναφοράς: σύνοψη, αναζήτηση, ταξινόμηση, export CSV/Excel και εκτύπωση/PDF. */
export function DataReportView({ report, title, canExport }: { report: DataReport; title: string; canExport: boolean }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 } | null>(null);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    let r = report.rows.filter((x) => !t || Object.values(x).some((v) => String(v ?? '').toLowerCase().includes(t)));
    if (sort) {
      const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
      r = [...r].sort((a, b) => { const x = a[sort.k], y = b[sort.k]; const nx = num(x), ny = num(y); const c = !Number.isNaN(nx) && !Number.isNaN(ny) && /\d/.test(String(x)) ? nx - ny : String(x ?? '').localeCompare(String(y ?? ''), 'el'); return c * sort.dir; });
    }
    return r;
  }, [report.rows, q, sort]);

  const csv = (sep: string) => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [report.columns.map((c) => esc(c.label)).join(sep), ...rows.map((r) => report.columns.map((c) => esc(r[c.key])).join(sep))].join('\r\n');
  };
  const file = (name: string, body: string, type: string) => {
    const url = URL.createObjectURL(new Blob(['﻿' + body], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  };
  const slug = title.toLowerCase().replace(/[^a-z0-9α-ω]+/gi, '-').replace(/^-|-$/g, '') || 'report';
  const day = new Date().toISOString().slice(0, 10);
  const print = () => {
    const w = window.open('', '_blank'); if (!w) return;
    const head = report.columns.map((c) => `<th style="text-align:${c.align ?? 'left'}">${c.label}</th>`).join('');
    const body = rows.map((r) => `<tr>${report.columns.map((c) => `<td style="text-align:${c.align ?? 'left'}">${String(r[c.key] ?? '').replace(/</g, '&lt;')}</td>`).join('')}</tr>`).join('');
    const sum = report.summary.map((s) => `<div class="k"><b>${s.value}</b><span>${s.label}</span></div>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2a24;margin:32px}h1{font-size:22px;margin:0 0 4px;color:#113124}p{color:#6b7280;margin:0 0 16px;font-size:12px}.s{display:flex;gap:12px;margin:0 0 16px}.k{border:1px solid #e5e0d6;border-radius:10px;padding:8px 12px}.k b{display:block;font-size:16px;color:#113124}.k span{font-size:11px;color:#6b7280}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#113124;color:#fff;padding:7px 8px;font-weight:600}td{padding:6px 8px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#f8f6f1}</style></head><body><h1>${title}</h1><p>Oramira · ${new Date().toLocaleString('el-GR')}${report.note ? ' · ' + report.note : ''}</p><div class="s">${sum}</div><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      {report.summary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {report.summary.map((s, i) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${['border-forest/20 bg-gradient-to-br from-forest/[0.08] to-white', 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white', 'border-amber-200 bg-gradient-to-br from-amber-50 to-white', 'border-sky-200 bg-gradient-to-br from-sky-50 to-white', 'border-violet-200 bg-gradient-to-br from-violet-50 to-white'][i % 5]}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70">{s.label}</p>
              <p className="mt-1.5 font-display text-2xl text-charcoal" data-no-tr>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" /><input className="input h-9 w-64 rounded-full py-1 pl-8 text-sm" placeholder="Αναζήτηση στην αναφορά…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <span className="text-xs text-charcoal-600/60">{rows.length} γραμμές{report.note ? ` · ${report.note}` : ''}</span>
        {canExport && (
          <span className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => file(`oramira-${slug}-${day}.csv`, csv(','), 'text/csv;charset=utf-8')} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest/40 bg-forest/[0.07] px-4 text-sm font-medium text-forest hover:bg-forest hover:text-white"><Download size={15} /> CSV</button>
            <button type="button" onClick={() => file(`oramira-${slug}-${day}.xls`, csv('\t'), 'application/vnd.ms-excel;charset=utf-8')} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-600 hover:text-white"><FileSpreadsheet size={15} /> Excel</button>
            <button type="button" onClick={print} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-semibold text-white shadow-sm hover:bg-forest/90"><Printer size={15} /> Εκτύπωση / PDF</button>
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-stone-line bg-forest/[0.03] text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70"><tr>
            {report.columns.map((c) => (
              <th key={c.key} className={`cursor-pointer select-none px-4 py-3 hover:text-forest ${c.align === 'right' ? 'text-right' : 'text-left'}`} onClick={() => setSort((s) => (s?.k === c.key ? { k: c.key, dir: s.dir === 1 ? -1 : 1 } : { k: c.key, dir: 1 }))}>
                {c.label}{sort?.k === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-stone-line/70">
            {rows.length === 0 && <tr><td colSpan={report.columns.length} className="px-4 py-12 text-center text-charcoal-600/70">Δεν υπάρχουν δεδομένα για αυτή την αναφορά ακόμη.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-forest/[0.025]">
                {report.columns.map((c, j) => <td key={c.key} className={`px-4 py-2.5 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${j === 0 ? 'font-medium text-charcoal' : 'text-charcoal-600'}`} data-no-tr>{r[c.key] ?? ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
