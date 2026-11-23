'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import type { StructuredReport } from '@/lib/report-pdf';
import { loadTextTranslator } from '@/components/i18n/text-translator';

/**
 * Φτιάχνει την αναφορά ως σελίδα εκτύπωσης στη γλώσσα του χρήστη (ελληνικά /
 * αγγλικά / ρωσικά) και ανοίγει το «Αποθήκευση ως PDF» του browser.
 */
export function DownloadReportButton({ label = 'Export PDF', action }: { label?: string; action: () => Promise<StructuredReport> }) {
  const [loading, setLoading] = useState(false);

  async function run() {
    // Το παράθυρο ανοίγει αμέσως (αλλιώς ο browser το μπλοκάρει ως pop-up).
    const w = window.open('', '_blank');
    setLoading(true);
    try {
      const [report, tr] = await Promise.all([action(), loadTextTranslator()]);
      if (!w) return;
      const e = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const t = (s: string) => e(tr(s));
      const sections = report.sections.map((sec) => {
        const metrics = sec.metrics?.length ? `<div class="m">${sec.metrics.map((m) => `<div class="k"><span>${t(m.label)}</span><b>${e(m.value)}</b>${m.hint ? `<i>${t(m.hint)}</i>` : ''}</div>`).join('')}</div>` : '';
        const bullets = sec.bullets?.length ? `<ul>${sec.bullets.map((b) => `<li>${t(b)}</li>`).join('')}</ul>` : '';
        const table = sec.table ? `<table><thead><tr>${sec.table.headers.map((h) => `<th>${t(h)}</th>`).join('')}</tr></thead><tbody>${sec.table.rows.map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
        return `<section><h2>${t(sec.title)}</h2>${sec.blurb ? `<p class="b">${t(sec.blurb)}</p>` : ''}${metrics}${bullets}${table}</section>`;
      }).join('');
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${t(report.title)}</title><style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#222;margin:32px;max-width:900px}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #222;padding-bottom:10px;margin-bottom:18px}
h1{font-size:22px;margin:0}header p{margin:2px 0 0;color:#666;font-size:12px}
h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin:22px 0 8px}
.b{color:#666;font-size:12px;margin:0 0 8px}.m{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.k{border:1px solid #ddd;border-radius:10px;padding:8px 12px}.k span{display:block;font-size:10.5px;color:#666;text-transform:uppercase;letter-spacing:.04em}
.k b{display:block;font-size:16px;margin-top:2px}.k i{display:block;font-style:normal;font-size:10.5px;color:#888}
ul{margin:0;padding-left:18px;font-size:12.5px}li{margin:3px 0}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}th{text-align:left;border-bottom:1px solid #222;padding:6px 8px}td{padding:5px 8px;border-bottom:1px solid #eee}
</style></head><body><header><div><h1>Oramira Ltd</h1><p>${t(report.title)}</p></div><div style="text-align:right"><p>${t(report.subtitle)}</p><p>${t(report.generatedAt)}</p></div></header>${sections}<script>window.onload=()=>window.print()</script></body></html>`);
      w.document.close();
    } catch {
      w?.close();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={run} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-1.5 text-sm font-medium text-white hover:bg-forest/90 disabled:opacity-60">
      {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} strokeWidth={1.9} />} {label}
    </button>
  );
}
