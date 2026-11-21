import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { FinancialForecast } from '@/lib/financial-forecast';
import { formatCurrency, formatNumber } from '@/lib/format';

/** Ταμειακή ροή 30 / 60 / 90 ημερών: καθαρή θέση και τι μπαίνει / τι βγαίνει. */
export function ForecastPanel({ forecast }: { forecast: FinancialForecast }) {
  const rows: { label: string; get: (h: FinancialForecast['horizons'][number]) => number; kind: 'in' | 'out' }[] = [
    { label: 'Δόσεις αγοραστών που λήγουν', get: (h) => h.receivables, kind: 'in' },
    { label: 'Αναμενόμενα νέα συμβόλαια', get: (h) => h.projectedClosingsValue, kind: 'in' },
    { label: 'Μισθοδοσία', get: (h) => h.payroll, kind: 'out' },
    { label: 'Εργολάβοι', get: (h) => h.contractor, kind: 'out' },
    { label: 'Προμήθειες', get: (h) => h.projectedCommissions, kind: 'out' },
    { label: 'ΦΠΑ', get: (h) => h.vat, kind: 'out' },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-stone-line px-5 py-4">
        <h4 className="text-[15px] font-semibold text-charcoal">Ταμειακή ροή</h4>
        <p className="text-[13px] text-charcoal-600">Τι αναμένεται να μπει και να βγει τις επόμενες 30, 60 και 90 ημέρες.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 p-4 sm:gap-3">
        {forecast.horizons.map((h) => {
          const pos = h.net >= 0;
          return (
            <div key={h.days} className="min-w-0 rounded-xl border border-stone-line p-3 sm:p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal-600">{`${h.days} ημέρες`}</p>
              <p className={`mt-1 flex items-center gap-1 truncate text-[18px] font-semibold tabular-nums sm:text-[22px] ${pos ? 'text-forest' : 'text-signal-danger'}`}>{pos ? <ArrowUpRight size={16} className="shrink-0" /> : <ArrowDownRight size={16} className="shrink-0" />}{formatCurrency(h.net)}</p>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto border-t border-stone-line">
        <table className="o-table">
          <thead><tr><th>Γραμμή</th>{forecast.horizons.map((h) => <th key={h.days} className="text-right">{`${h.days} ημέρες`}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="o-strong"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${r.kind === 'in' ? 'bg-forest' : 'bg-charcoal-600/40'}`} />{r.label}</td>
                {forecast.horizons.map((h) => <td key={h.days} className={`text-right tabular-nums ${r.kind === 'in' ? 'text-forest' : 'text-charcoal'}`}>{r.kind === 'out' && r.get(h) > 0 ? '−' : ''}{formatCurrency(r.get(h))}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap gap-x-3 border-t border-stone-line px-5 py-3 text-[12px] text-charcoal-600">
        <span>Ενδεικτική εκτίμηση, όχι λογιστική πρόβλεψη.</span>
        <span>{`${forecast.activeReservations} ενεργές κρατήσεις`}</span>
        <span>{`Μισθοδοσία ${formatCurrency(forecast.monthlyPayroll)} / μήνα`}</span>
        <span>{`Υποθέτουμε ότι το ${formatNumber(75)}% των κρατήσεων γίνεται συμβόλαιο.`}</span>
      </p>
    </div>
  );
}
