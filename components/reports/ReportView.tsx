import type { StructuredReport } from '@/lib/report-pdf';

/** On-screen render of a StructuredReport — the same model that drives the PDF,
 *  so the dashboard view and the exported pack never diverge. */
export function ReportView({ report }: { report: StructuredReport }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-2xl text-charcoal">{report.title}</h3>
        <p className="text-sm text-charcoal-600/70">{report.subtitle} · {report.generatedAt}</p>
      </div>

      {report.sections.map((sec) => (
        <div key={sec.title} className="panel p-6">
          <h4 className="mb-1 text-forest">{sec.title}</h4>
          {sec.blurb && <p className="mb-4 text-sm text-charcoal-600/70">{sec.blurb}</p>}

          {sec.metrics && (
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {sec.metrics.map((m) => (
                <div key={m.label} className="rounded-lg bg-sand-100/50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-charcoal-600/50">{m.label}</p>
                  <p className="figure text-xl text-forest">{m.value}</p>
                  {m.hint && <p className="text-[11px] text-charcoal-600/55">{m.hint}</p>}
                </div>
              ))}
            </div>
          )}

          {sec.bullets && (
            <ul className="space-y-1.5">
              {sec.bullets.map((b, i) => <li key={i} className="flex items-start gap-2 text-sm text-charcoal-600/85"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-champagne-600" /> {b}</li>)}
            </ul>
          )}

          {sec.table && (
            <div className="overflow-x-auto">
              <table className="table-base w-full">
                <thead><tr>{sec.table.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{sec.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === 0 ? 'text-charcoal' : 'figure text-charcoal-600'}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
