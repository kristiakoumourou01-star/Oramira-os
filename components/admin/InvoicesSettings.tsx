'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Trash2, Info } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { UndoButton } from '@/components/admin/UndoButton';
import { updateSeries } from '@/app/actions/invoices';
import { DEFAULT_INVOICES, type InvoiceSettings } from '@/lib/org-settings-shared';
import { previewNumber, type DocSeries } from '@/lib/invoices-shared';
import { ReceiptPreview, type CompanyInfo } from '@/components/admin/ReceiptPreview';

type Msg = { ok: boolean; text: string } | null;

const Lbl = ({ children }: { children: React.ReactNode }) => <span className="eyebrow mb-1 block">{children}</span>;
const Help = ({ children }: { children: React.ReactNode }) => <p className="text-xs text-charcoal-600/60">{children}</p>;

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (b: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-charcoal">{label}</span>
      <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-forest' : 'bg-stone-line'} disabled:opacity-50`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

/** Settings → Τιμολόγια & ΦΠΑ. VAT and receipt options live in org_settings; numbering in the database. */
export function InvoicesSettings({ initial, series, seriesMissing, canEdit, company }: { initial: InvoiceSettings; series: DocSeries[]; seriesMissing: boolean; canEdit: boolean; company?: CompanyInfo }) {
  const router = useRouter();
  const [v, setV] = useState<InvoiceSettings>(initial);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const patch = (p: Partial<InvoiceSettings>) => { setV((x) => ({ ...x, ...p })); setMsg(null); };
  const setRate = (i: number, p: Partial<InvoiceSettings['vatRates'][number]>) => patch({ vatRates: v.vatRates.map((r, idx) => (idx === i ? { ...r, ...p } : r)) });

  const save = () => start(async () => {
    const res = await saveOrgSlice('invoices', v);
    if (res.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: res.error });
  });
  const reset = () => { if (confirm('Επαναφορά συντελεστών και επιλογών απόδειξης στα αρχικά; Τα εκδοθέντα παραστατικά δεν αλλάζουν.')) patch(DEFAULT_INVOICES); };

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-5">
        <div>
          <h4>Συντελεστές ΦΠΑ</h4>
          <Help>Αυτοί προσφέρονται σε κάθε γραμμή τιμολογίου. Αν αλλάξετε έναν συντελεστή, τα παραστατικά που έχουν ήδη εκδοθεί κρατούν αυτόν με τον οποίο εκδόθηκαν.</Help>
        </div>
        <div className="hidden grid-cols-[1fr_90px_1.6fr_32px] gap-2 sm:grid">
          <Lbl>Όνομα</Lbl><Lbl>%</Lbl><Lbl>Πότε ισχύει</Lbl><span />
        </div>
        {v.vatRates.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_32px] items-center gap-2 sm:grid-cols-[1fr_90px_1.6fr_32px]">
            <input className="input" disabled={!canEdit} value={r.label} onChange={(e) => setRate(i, { label: e.target.value })} />
            <input className="input figure" disabled={!canEdit} type="number" min={0} max={100} step="0.5" value={r.rate} onChange={(e) => setRate(i, { rate: Number(e.target.value) })} />
            <input className="input col-span-3 sm:col-span-1 order-last sm:order-none" disabled={!canEdit} value={r.note} placeholder="π.χ. νέα ακίνητα, υπηρεσίες" onChange={(e) => setRate(i, { note: e.target.value })} />
            {canEdit && v.vatRates.length > 1 ? (
              <button type="button" title="Αφαίρεση" onClick={() => patch({ vatRates: v.vatRates.filter((_, idx) => idx !== i) })} className="text-charcoal-600/50 hover:text-signal-danger"><Trash2 size={15} /></button>
            ) : <span />}
          </div>
        ))}
        {canEdit && (
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => patch({ vatRates: [...v.vatRates, { label: 'Νέος', rate: 9, note: '' }] })}><Plus size={13} /> Συντελεστής</button>
        )}
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <label className="block">
            <Lbl>Προεπιλογή σε νέα γραμμή</Lbl>
            <select className="input" disabled={!canEdit} value={v.defaultVat} onChange={(e) => patch({ defaultVat: Number(e.target.value) })}>
              {v.vatRates.map((r) => <option key={r.rate} value={r.rate}>{r.label} · {r.rate}%</option>)}
            </select>
          </label>
          <label className="block">
            <Lbl>Προθεσμία πληρωμής (μέρες)</Lbl>
            <input className="input figure" disabled={!canEdit} type="number" min={0} max={365} value={v.paymentTermsDays} onChange={(e) => patch({ paymentTermsDays: Number(e.target.value) })} />
            <Help>Η λήξη ενός νέου τιμολογίου = ημερομηνία έκδοσης + αυτές οι μέρες.</Help>
          </label>
        </div>
      </div>

      <div className="panel space-y-1 p-5">
        <h4 className="mb-1">Τι εμφανίζεται στο παραστατικό</h4>
        <Toggle label="Logo της εταιρείας" checked={v.receiptShowLogo} onChange={(b) => patch({ receiptShowLogo: b })} disabled={!canEdit} />
        <Toggle label="Διεύθυνση και στοιχεία εταιρείας" checked={v.receiptShowAddress} onChange={(b) => patch({ receiptShowAddress: b })} disabled={!canEdit} />
        <Toggle label="Τραπεζικά στοιχεία (IBAN)" checked={v.receiptShowBank} onChange={(b) => patch({ receiptShowBank: b })} disabled={!canEdit} />
        {v.receiptShowBank && (
          <label className="block pt-1">
            <Lbl>Τραπεζικά στοιχεία</Lbl>
            <textarea className="input min-h-[70px]" disabled={!canEdit} value={v.bankDetails} placeholder={'Τράπεζα Κύπρου\nIBAN CY00 0000 0000 0000 0000 0000 0000\nBIC BCYPCY2N'} onChange={(e) => patch({ bankDetails: e.target.value })} />
          </label>
        )}
        <Toggle label="Export για myDATA (μόνο Ελλάδα)" checked={v.mydataExport} onChange={(b) => patch({ mydataExport: b })} disabled={!canEdit} />
        <Help>Η επωνυμία, ο ΑΦΜ και το υποσέλιδο έρχονται από τα Στοιχεία εταιρείας.</Help>
      </div>

      {company && <ReceiptPreview v={v} company={company} />}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={pending} className="btn-primary"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          <button onClick={reset} type="button" className="btn-secondary">Επαναφορά στα αρχικά</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
          {msg?.ok && <UndoButton slice="invoices" />}
        </div>
      )}

      <div className="panel space-y-3 p-5">
        <div>
          <h4>Αρίθμηση</h4>
          <Help>Κάθε σειρά αριθμείται χωρίς κενά: ο αριθμός δίνεται τη στιγμή της έκδοσης, και αν κάτι αποτύχει δεν χάνεται. Το {'{YYYY}'} γίνεται η χρονιά του παραστατικού. Ο επόμενος αριθμός μπορεί να ανέβει (π.χ. για να συνεχίσετε από το παλιό σας σύστημα), όχι να κατέβει αφού εκδοθούν παραστατικά.</Help>
        </div>
        {seriesMissing ? (
          <p className="flex items-start gap-2 rounded-md bg-champagne-50 px-3 py-2 text-sm text-champagne-600"><Info size={14} className="mt-0.5 shrink-0" /> Για να ενεργοποιηθεί η αρίθμηση, τρέξτε μία φορά το αρχείο supabase/ΕΚΚΡΕΜΕΙ_ΣΤΗ_ΒΑΣΗ.sql στο Supabase → SQL Editor.</p>
        ) : (
          series.map((s) => <SeriesRow key={s.key} s={s} canEdit={canEdit} />)
        )}
      </div>
    </div>
  );
}

function SeriesRow({ s, canEdit }: { s: DocSeries; canEdit: boolean }) {
  const router = useRouter();
  const [label, setLabel] = useState(s.label);
  const [prefix, setPrefix] = useState(s.prefix);
  const [next, setNext] = useState(s.next_number);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const dirty = label !== s.label || prefix !== s.prefix || next !== s.next_number;
  const save = () => start(async () => {
    const res = await updateSeries(s.key, label, prefix, next);
    if (res.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: res.error });
  });
  return (
    <div className="rounded-md border border-stone-line p-3">
      <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_100px_auto] sm:items-end">
        <label className="block"><Lbl>Σειρά</Lbl><input className="input" disabled={!canEdit} value={label} onChange={(e) => { setLabel(e.target.value); setMsg(null); }} /></label>
        <label className="block"><Lbl>Πρόθεμα</Lbl><input className="input font-mono text-sm" disabled={!canEdit} value={prefix} onChange={(e) => { setPrefix(e.target.value); setMsg(null); }} /></label>
        <label className="block"><Lbl>Επόμενος</Lbl><input className="input figure" disabled={!canEdit} type="number" min={1} value={next} onChange={(e) => { setNext(Number(e.target.value)); setMsg(null); }} /></label>
        {canEdit && <button type="button" disabled={!dirty || pending} onClick={save} className="btn-secondary px-3 py-2 text-xs disabled:opacity-40">{pending ? '…' : 'Αποθήκευση'}</button>}
      </div>
      <p className="mt-2 text-xs text-charcoal-600/70">Επόμενο: <span className="font-mono text-charcoal">{previewNumber({ prefix, next_number: next || 1 })}</span>
        {msg && <span className={`ml-3 ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
      </p>
    </div>
  );
}
