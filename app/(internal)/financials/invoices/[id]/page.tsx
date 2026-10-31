import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Receipt, FileMinus2 } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { getBranding } from '@/lib/branding';
import { getOrgSettings } from '@/lib/org-settings';
import { getDocument, relatedDocuments, balanceOf, profileNames, KIND_LABEL, STATUS_LABEL, money } from '@/lib/invoices';
import { formatDate, formatDateTime } from '@/lib/format';
import { PrintButton } from '@/components/financials/PrintButton';

export const dynamic = 'force-dynamic';

export default async function InvoiceViewPage({ params }: { params: { id: string } }) {
  const profile = await requirePermission('financials');
  const canIssue = effectiveCan(profile.role, profile.moduleAccess, 'financials', 'edit', profile.permissions);
  const doc = await getDocument(params.id);
  if (!doc) notFound();

  const [branding, settings, related, parent] = await Promise.all([
    getBranding(),
    getOrgSettings(),
    doc.kind === 'invoice' ? relatedDocuments(doc.id) : Promise.resolve([]),
    doc.related_id ? getDocument(doc.related_id) : Promise.resolve(null),
  ]);
  const names = await profileNames([doc.created_by, ...related.map((r) => r.created_by)]);
  const bal = doc.kind === 'invoice' ? balanceOf(doc, related) : null;
  const { business, invoices: cfg, appearance } = settings;
  const logo = appearance.logoOnLight ?? branding.logoUrl;
  const mainOffice = business.offices.find((o) => o.main) ?? business.offices[0];
  const isCredit = doc.kind === 'credit_note';
  const isReceipt = doc.kind === 'receipt';
  const sign = isCredit ? '−' : '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/financials/invoices" className="inline-flex items-center gap-1 text-sm text-charcoal-600 hover:text-forest"><ArrowLeft size={14} /> Τιμολόγια</Link>
        <div className="flex flex-wrap gap-2">
          {doc.kind === 'invoice' && canIssue && bal && bal.open > 0 && (
            <Link href={`/financials/invoices/new?kind=receipt&related=${doc.id}`} className="btn-primary"><Receipt size={15} /> Είσπραξη</Link>
          )}
          {doc.kind === 'invoice' && canIssue && doc.status !== 'credited' && (
            <Link href={`/financials/invoices/new?kind=credit_note&related=${doc.id}`} className="btn-secondary"><FileMinus2 size={15} /> Πιστωτικό</Link>
          )}
          <PrintButton />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
        {/* The document itself — what gets printed / saved as PDF */}
        <article className="print-area panel mx-auto w-full max-w-[820px] bg-white p-8 text-charcoal sm:p-10 print:max-w-none print:p-0 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-stone-line pb-6">
            <div className="space-y-1 text-sm">
              {cfg.receiptShowLogo && logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logo} alt={branding.companyName} className="mb-2 h-12 w-auto object-contain" />
                : <p className="font-display text-xl text-forest">{branding.companyName}</p>}
              {cfg.receiptShowAddress && (
                <div className="text-xs leading-relaxed text-charcoal-600">
                  {cfg.receiptShowLogo && logo && <p className="font-medium text-charcoal">{branding.companyName}</p>}
                  {mainOffice?.address && <p>{mainOffice.address}</p>}
                  {mainOffice?.phone && <p>Τηλ. {mainOffice.phone}</p>}
                  {business.vatNo && <p>ΑΦΜ / ΦΠΑ {business.vatNo}</p>}
                  {business.registrationNo && <p>Αρ. εγγραφής {business.registrationNo}</p>}
                  {business.invoiceEmail && <p>{business.invoiceEmail}</p>}
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="eyebrow">{KIND_LABEL[doc.kind]}</p>
              <p className="font-mono text-2xl text-charcoal">{doc.number}</p>
              <p className="mt-1 text-sm text-charcoal-600">Ημερομηνία: {formatDate(doc.issue_date)}</p>
              {doc.due_date && <p className="text-sm text-charcoal-600">Λήξη: {formatDate(doc.due_date)}</p>}
              {parent && <p className="text-sm text-charcoal-600">{isCredit ? 'Πιστώνει' : 'Έναντι'}: <span className="font-mono">{parent.number}</span></p>}
            </div>
          </header>

          <section className="grid gap-4 py-6 sm:grid-cols-2">
            <div>
              <p className="eyebrow mb-1">{isReceipt ? 'Εισπράχθηκε από' : 'Πελάτης'}</p>
              <p className="font-medium">{doc.customer_name}</p>
              <div className="text-sm text-charcoal-600">
                {doc.customer_address && <p>{doc.customer_address}</p>}
                {doc.customer_email && <p>{doc.customer_email}</p>}
                {doc.customer_vat_no && <p>ΑΦΜ {doc.customer_vat_no}</p>}
              </div>
            </div>
            {doc.payment_method && (
              <div className="sm:text-right">
                <p className="eyebrow mb-1">Τρόπος πληρωμής</p>
                <p className="text-sm">{doc.payment_method}</p>
              </div>
            )}
          </section>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-line text-left text-[11px] uppercase tracking-wide text-charcoal-600/70">
                <th className="py-2 font-medium">Περιγραφή</th>
                {!isReceipt && <th className="py-2 text-right font-medium">Ποσ.</th>}
                {!isReceipt && <th className="py-2 text-right font-medium">Τιμή</th>}
                {!isReceipt && <th className="py-2 text-right font-medium">ΦΠΑ</th>}
                <th className="py-2 text-right font-medium">{isReceipt ? 'Ποσό' : 'Καθαρό'}</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={i} className="border-b border-stone-line/60 align-top">
                  <td className="py-2 pr-3">{l.description}</td>
                  {!isReceipt && <td className="figure py-2 text-right">{Number(l.qty)}</td>}
                  {!isReceipt && <td className="figure py-2 text-right">{money(l.unit_price)}</td>}
                  {!isReceipt && <td className="figure py-2 text-right">{Number(l.vat_rate)}%</td>}
                  <td className="figure py-2 text-right">{sign}{money(l.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-4 w-full max-w-[300px] space-y-1 text-sm">
            {!isReceipt && <div className="flex justify-between"><span className="text-charcoal-600">Καθαρό</span><span className="figure">{sign}{money(doc.net_total)}</span></div>}
            {!isReceipt && doc.vat_breakdown.map((b) => (
              <div key={b.rate} className="flex justify-between text-charcoal-600"><span>ΦΠΑ {Number(b.rate)}% επί {money(b.net)}</span><span className="figure">{sign}{money(b.vat)}</span></div>
            ))}
            <div className="flex justify-between border-t border-charcoal/20 pt-2 text-base font-semibold"><span>{isCredit ? 'Σύνολο πίστωσης' : isReceipt ? 'Εισπράχθηκε' : 'Σύνολο'}</span><span className="figure">{sign}{money(doc.total)}</span></div>
          </div>

          {doc.notes && <p className="mt-6 whitespace-pre-line text-sm text-charcoal-600"><span className="font-medium text-charcoal">{isCredit ? 'Αιτιολογία: ' : ''}</span>{doc.notes}</p>}

          {(cfg.receiptShowBank && cfg.bankDetails && doc.kind === 'invoice') || business.footer ? (
            <footer className="mt-8 space-y-3 border-t border-stone-line pt-4 text-xs text-charcoal-600">
              {cfg.receiptShowBank && cfg.bankDetails && doc.kind === 'invoice' && (
                <div><p className="font-medium text-charcoal">Στοιχεία πληρωμής</p><p className="whitespace-pre-line">{cfg.bankDetails}</p></div>
              )}
              {business.footer && <p className="whitespace-pre-line">{business.footer}</p>}
            </footer>
          ) : null}
        </article>

        {/* Side panel: balance + history (not printed) */}
        <aside className="space-y-4 print:hidden">
          {bal && (
            <div className="panel space-y-2 p-5 text-sm">
              <p className="eyebrow">Κατάσταση</p>
              <p className="font-medium text-charcoal">{STATUS_LABEL[doc.status]}</p>
              <div className="flex justify-between"><span className="text-charcoal-600">Σύνολο</span><span className="figure">{money(doc.total)}</span></div>
              {bal.credited > 0 && <div className="flex justify-between"><span className="text-charcoal-600">Πιστωτικά</span><span className="figure">−{money(bal.credited)}</span></div>}
              <div className="flex justify-between"><span className="text-charcoal-600">Εισπράχθηκαν</span><span className="figure">−{money(bal.paid)}</span></div>
              <div className="flex justify-between border-t border-stone-line pt-2 font-semibold"><span>Υπόλοιπο</span><span className="figure">{money(bal.open)}</span></div>
            </div>
          )}
          {related.length > 0 && (
            <div className="panel space-y-2 p-5">
              <p className="eyebrow">Σχετικά παραστατικά</p>
              {related.map((r) => (
                <Link key={r.id} href={`/financials/invoices/${r.id}`} className="flex justify-between gap-2 rounded px-1 py-1 text-sm hover:bg-stone/60">
                  <span><span className="font-mono">{r.number}</span><span className="block text-[11px] text-charcoal-600/70">{KIND_LABEL[r.kind]} · {formatDate(r.issue_date)}</span></span>
                  <span className="figure">{r.kind === 'credit_note' ? '−' : ''}{money(r.total)}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="panel p-5 text-xs text-charcoal-600">
            <p>Εκδόθηκε {formatDateTime(doc.created_at)}{doc.created_by && names[doc.created_by] ? ` από ${names[doc.created_by]}` : ''}.</p>
            <p className="mt-2 text-charcoal-600/70">Ένα εκδοθέν παραστατικό δεν αλλάζει και δεν διαγράφεται. Για διόρθωση εκδώστε πιστωτικό.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
