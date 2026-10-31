'use client';

import type { InvoiceSettings } from '@/lib/org-settings-shared';
import { computeTotals, money } from '@/lib/invoices-shared';
import { formatDate } from '@/lib/format';

export interface CompanyInfo { name: string; logo: string | null; address: string; phone: string; vatNo: string; regNo: string; email: string; footer: string }

/** Live sample of how an invoice will look with the current settings (not saved, not numbered). */
export function ReceiptPreview({ v, company }: { v: InvoiceSettings; company: CompanyInfo }) {
  const lines = [
    { description: 'Προμήθεια πώλησης μονάδας A-12', qty: 1, unit_price: 12000, vat_rate: v.defaultVat },
    { description: 'Νομικά έξοδα', qty: 1, unit_price: 800, vat_rate: v.vatRates.find((r) => r.rate === 0)?.rate ?? v.defaultVat },
  ];
  const t = computeTotals(lines);
  const today = formatDate(new Date());
  return (
    <div className="panel p-5">
      <h4 className="mb-1">Προεπισκόπηση</h4>
      <p className="mb-3 text-xs text-charcoal-600/60">Παράδειγμα με τις τωρινές επιλογές. Αλλάζει καθώς τις αλλάζετε.</p>
      <div className="origin-top-left rounded-md border border-stone-line bg-white p-5 text-[11px] text-[#2b2a27] shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-stone-line pb-3">
          <div>
            {v.receiptShowLogo && company.logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={company.logo} alt="" className="mb-1 h-8 w-auto object-contain" />
              : <p className="font-display text-sm text-forest">{company.name}</p>}
            {v.receiptShowAddress && (
              <div className="leading-snug text-[#6b6a66]">
                {v.receiptShowLogo && company.logo && <p className="text-[#2b2a27]">{company.name}</p>}
                {company.address && <p>{company.address}</p>}
                {company.phone && <p>Τηλ. {company.phone}</p>}
                {company.vatNo && <p>ΑΦΜ / ΦΠΑ {company.vatNo}</p>}
                {company.regNo && <p>Αρ. εγγραφής {company.regNo}</p>}
                {company.email && <p>{company.email}</p>}
                {!company.address && !company.vatNo && <p className="italic">Συμπληρώστε τα Στοιχεία εταιρείας</p>}
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="uppercase tracking-wide text-[#8a8780]">Τιμολόγιο</p>
            <p className="font-mono text-sm">INV-{new Date().getFullYear()}-0001</p>
            <p className="text-[#6b6a66]">{today}</p>
          </div>
        </div>
        <p className="mt-3 font-medium">Πελάτης: Γιώργος Παπαδόπουλος</p>
        <table className="mt-2 w-full">
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-stone-line/60">
                <td className="py-1">{l.description}</td>
                <td className="py-1 text-right">{l.vat_rate}%</td>
                <td className="py-1 text-right">{money(l.qty * l.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-2 w-48 space-y-0.5">
          <div className="flex justify-between"><span>Καθαρό</span><span>{money(t.net)}</span></div>
          {t.breakdown.map((b) => <div key={b.rate} className="flex justify-between text-[#6b6a66]"><span>ΦΠΑ {b.rate}%</span><span>{money(b.vat)}</span></div>)}
          <div className="flex justify-between border-t border-[#2b2a27]/20 pt-1 font-semibold"><span>Σύνολο</span><span>{money(t.total)}</span></div>
        </div>
        {((v.receiptShowBank && v.bankDetails) || company.footer) && (
          <div className="mt-3 space-y-1 border-t border-stone-line pt-2 text-[#6b6a66]">
            {v.receiptShowBank && v.bankDetails && <p className="whitespace-pre-line"><span className="text-[#2b2a27]">Στοιχεία πληρωμής: </span>{v.bankDetails}</p>}
            {company.footer && <p className="whitespace-pre-line">{company.footer}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
