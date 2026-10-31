import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-settings';
import { getDocument, relatedDocuments, balanceOf, listSeries, documentPickers, KIND_LABEL, type DocKind } from '@/lib/invoices';
import { InvoiceForm, type PresetDoc } from '@/components/financials/InvoiceForm';
import { commissionDraft } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

/**
 * New document. ?kind=receipt|credit_note&related=<invoice id> issues a receipt
 * or credit note against an invoice; otherwise a new invoice (or a standalone
 * receipt with ?kind=receipt).
 */
export default async function NewInvoicePage({ searchParams }: { searchParams: { kind?: string; related?: string; contact?: string; lead?: string } }) {
  await requirePermission('financials', 'edit');
  const kind: DocKind = (['invoice', 'receipt', 'credit_note'] as const).find((k) => k === searchParams.kind) ?? 'invoice';

  const [settings, { series }, pickers, related] = await Promise.all([
    getOrgSettings(),
    listSeries(),
    documentPickers(),
    searchParams.related ? getDocument(searchParams.related) : Promise.resolve(null),
  ]);
  const original = related && related.kind === 'invoice' ? related : null;
  // ?lead=<id>: commission invoice for a won lead, pre-filled (Settings → Pipelines → Προμήθεια).
  const draft = kind === 'invoice' && !related && searchParams.lead && /^[0-9a-f-]{36}$/i.test(searchParams.lead) ? await commissionDraft(searchParams.lead) : null;
  const presetDoc: PresetDoc | null = draft ? {
    leadId: draft.leadId, contactId: draft.contactId, name: draft.customer.name, email: draft.customer.email, address: draft.customer.address, vatNo: draft.customer.vatNo,
    projectId: draft.projectId, unitId: draft.unitId, notes: 'Προμήθεια από το κλείσιμο της πώλησης.',
    lines: [{ description: draft.description, qty: 1, unit_price: draft.net, vat_rate: draft.vatRate }],
  } : null;
  const bal = original ? balanceOf(original, await relatedDocuments(original.id)) : null;

  const back = original ? `/financials/invoices/${original.id}` : '/financials/invoices';
  if (kind === 'credit_note' && !original) {
    return (
      <div className="space-y-4">
        <Link href="/financials/invoices" className="inline-flex items-center gap-1 text-sm text-charcoal-600 hover:text-forest"><ArrowLeft size={14} /> Τιμολόγια</Link>
        <p className="panel p-6 text-sm text-charcoal-600">Ένα πιστωτικό εκδίδεται πάντα για ένα τιμολόγιο. Ανοίξτε το τιμολόγιο και πατήστε «Πιστωτικό».</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href={back} className="inline-flex items-center gap-1 text-sm text-charcoal-600 hover:text-forest"><ArrowLeft size={14} /> {original ? original.number : 'Τιμολόγια'}</Link>
      <div>
        <p className="eyebrow mb-1">Οικονομικά · Τιμολόγια</p>
        <h1 className="font-display text-[26px] leading-tight text-charcoal">
          Νέο {KIND_LABEL[kind].toLowerCase()}{original ? ` για ${original.number}` : ''}{presetDoc ? ' προμήθειας' : ''}
        </h1>
      </div>
      <InvoiceForm
        kind={kind}
        settings={settings.invoices}
        series={series.find((s) => s.key === kind) ?? null}
        pickers={pickers}
        original={original}
        balance={bal}
        presetContact={searchParams.contact ?? ''}
        presetDoc={presetDoc}
      />
    </div>
  );
}
