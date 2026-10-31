'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, FileCheck2, Info } from 'lucide-react';
import { issueDocument } from '@/app/actions/invoices';
import type { InvoiceSettings } from '@/lib/org-settings-shared';
import {
  computeTotals, previewNumber, money, KIND_LABEL, PAYMENT_METHODS,
  type DocKind, type DocSeries, type InvoiceDoc,
} from '@/lib/invoices-shared';

interface Pickers {
  contacts: { id: string; full_name: string | null; email: string }[];
  projects: { id: string; name: string }[];
  units: { id: string; unit_number: string; project_id: string }[];
}
interface Line { description: string; qty: number; unit_price: number; vat_rate: number }

const Lbl = ({ children }: { children: React.ReactNode }) => <span className="eyebrow mb-1 block">{children}</span>;
const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const todayIso = () => new Date().toISOString().slice(0, 10);

export interface PresetDoc { leadId: string; contactId: string | null; name: string; email: string; address: string; vatNo: string; projectId: string | null; unitId: string | null; notes: string; lines: { description: string; qty: number; unit_price: number; vat_rate: number }[] }

export function InvoiceForm({ kind, settings, series, pickers, original, balance, presetContact, presetDoc = null }: {
  kind: DocKind;
  settings: InvoiceSettings;
  series: DocSeries | null;
  pickers: Pickers;
  original: InvoiceDoc | null;
  balance: { credited: number; paid: number; open: number } | null;
  presetContact: string;
  /** Pre-filled from a won lead (commission invoice). */
  presetDoc?: PresetDoc | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isReceipt = kind === 'receipt';
  const isCredit = kind === 'credit_note';
  const lockedCustomer = !!original;

  const preset = pickers.contacts.find((c) => c.id === (presetDoc?.contactId ?? presetContact));
  const [contactId, setContactId] = useState(original?.contact_id ?? preset?.id ?? '');
  const [contactQuery, setContactQuery] = useState(preset ? `${preset.full_name ?? ''} — ${preset.email}` : '');
  const [name, setName] = useState(original?.customer_name ?? presetDoc?.name ?? preset?.full_name ?? '');
  const [email, setEmail] = useState(original?.customer_email ?? (presetDoc?.email || preset?.email) ?? '');
  const [address, setAddress] = useState(original?.customer_address ?? presetDoc?.address ?? '');
  const [vatNo, setVatNo] = useState(original?.customer_vat_no ?? presetDoc?.vatNo ?? '');
  const [projectId, setProjectId] = useState(original?.project_id ?? presetDoc?.projectId ?? '');
  const [unitId, setUnitId] = useState(original?.unit_id ?? presetDoc?.unitId ?? '');
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(kind === 'invoice' ? addDays(todayIso(), settings.paymentTermsDays) : '');
  const [method, setMethod] = useState(isReceipt ? PAYMENT_METHODS[0] : '');
  const [notes, setNotes] = useState(presetDoc?.notes ?? '');
  const [fullCredit, setFullCredit] = useState(isCredit && !!original && (balance?.credited ?? 0) === 0);

  const initialLines = (): Line[] => {
    if (isReceipt && original) return [{ description: `Είσπραξη έναντι ${original.number}`, qty: 1, unit_price: balance?.open ?? Number(original.total), vat_rate: 0 }];
    if (isCredit && original) return original.lines.map((l) => ({ description: l.description, qty: Number(l.qty), unit_price: Number(l.unit_price), vat_rate: Number(l.vat_rate) }));
    if (presetDoc?.lines.length) return presetDoc.lines;
    return [{ description: '', qty: 1, unit_price: 0, vat_rate: isReceipt ? 0 : settings.defaultVat }];
  };
  const [lines, setLines] = useState<Line[]>(initialLines);
  const setLine = (i: number, p: Partial<Line>) => { setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...p } : l))); setError(null); };

  const rateOptions = useMemo(() => {
    const opts = settings.vatRates.map((r) => ({ rate: r.rate, label: `${r.rate}% · ${r.label}` }));
    for (const l of original?.lines ?? []) if (!opts.some((o) => o.rate === Number(l.vat_rate))) opts.push({ rate: Number(l.vat_rate), label: `${l.vat_rate}%` });
    return opts;
  }, [settings.vatRates, original]);

  const effectiveLines = isCredit && fullCredit && original ? original.lines : lines;
  const totals = computeTotals(effectiveLines);
  const units = pickers.units.filter((u) => !projectId || u.project_id === projectId);

  const pickContact = (q: string) => {
    setContactQuery(q);
    const c = pickers.contacts.find((x) => `${x.full_name ?? ''} — ${x.email}` === q);
    if (c) { setContactId(c.id); setName(c.full_name ?? ''); setEmail(c.email); } else setContactId('');
  };

  const submit = () => {
    setError(null);
    if (isCredit && !notes.trim()) { setError('Γράψτε την αιτιολογία του πιστωτικού.'); return; }
    if (!lockedCustomer && !name.trim()) { setError('Συμπληρώστε το όνομα του πελάτη.'); return; }
    const what = `${KIND_LABEL[kind]} ${money(totals.total)}${name ? ` για ${name}` : ''}`;
    if (!confirm(`Έκδοση: ${what}.\n\nΜετά την έκδοση δεν αλλάζει και δεν διαγράφεται — διορθώνεται μόνο με πιστωτικό. Συνέχεια;`)) return;
    start(async () => {
      const res = await issueDocument(kind, {
        issue_date: issueDate, due_date: dueDate,
        contact_id: contactId, customer_name: name, customer_email: email, customer_address: address, customer_vat_no: vatNo,
        project_id: projectId, unit_id: unitId, related_id: original?.id ?? '',
        payment_method: method, notes,
        lines: isCredit && fullCredit ? [] : lines,
        lead_id: presetDoc?.leadId,
      });
      if (res.ok) router.push(`/financials/invoices/${res.id}`);
      else setError(res.error);
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {/* Customer */}
        <div className="panel space-y-3 p-5">
          <h4>Πελάτης</h4>
          {lockedCustomer ? (
            <p className="text-sm text-charcoal">{name}{email ? <span className="text-charcoal-600/70"> · {email}</span> : null}{vatNo ? <span className="text-charcoal-600/70"> · ΑΦΜ {vatNo}</span> : null}</p>
          ) : (
            <>
              <label className="block">
                <Lbl>Από τις επαφές (προαιρετικό)</Lbl>
                <input className="input" list="inv-contacts" value={contactQuery} placeholder="Γράψτε όνομα ή email…" onChange={(e) => pickContact(e.target.value)} />
                <datalist id="inv-contacts">
                  {pickers.contacts.map((c) => <option key={c.id} value={`${c.full_name ?? ''} — ${c.email}`} />)}
                </datalist>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><Lbl>Όνομα / επωνυμία *</Lbl><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
                <label className="block"><Lbl>Email</Lbl><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                <label className="block"><Lbl>Διεύθυνση</Lbl><input className="input" value={address} onChange={(e) => setAddress(e.target.value)} /></label>
                <label className="block"><Lbl>ΑΦΜ / ΦΠΑ πελάτη</Lbl><input className="input" value={vatNo} onChange={(e) => setVatNo(e.target.value)} /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><Lbl>Έργο</Lbl>
                  <select className="input" value={projectId} onChange={(e) => { setProjectId(e.target.value); setUnitId(''); }}>
                    <option value="">—</option>
                    {pickers.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="block"><Lbl>Μονάδα</Lbl>
                  <select className="input" value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={!projectId}>
                    <option value="">—</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
                  </select>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Lines */}
        <div className="panel space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4>{isReceipt ? 'Ποσό' : 'Γραμμές'}</h4>
            {isCredit && original && (
              <div className="flex gap-1 rounded-full bg-stone p-0.5 text-sm">
                <button type="button" disabled={(balance?.credited ?? 0) > 0} onClick={() => setFullCredit(true)} className={`rounded-full px-3 py-1 ${fullCredit ? 'bg-white shadow-sm text-charcoal' : 'text-charcoal-600'} disabled:opacity-40`}>Ολική πίστωση</button>
                <button type="button" onClick={() => setFullCredit(false)} className={`rounded-full px-3 py-1 ${!fullCredit ? 'bg-white shadow-sm text-charcoal' : 'text-charcoal-600'}`}>Μερική</button>
              </div>
            )}
          </div>

          {isCredit && fullCredit ? (
            <p className="text-sm text-charcoal-600">Πιστώνεται ολόκληρο το {original?.number} ({money(original?.total)}), με τις ίδιες γραμμές και τους ίδιους συντελεστές ΦΠΑ.</p>
          ) : (
            <>
              <div className={`hidden gap-2 sm:grid ${isReceipt ? 'grid-cols-[1fr_140px_32px]' : 'grid-cols-[1fr_70px_120px_130px_100px_32px]'}`}>
                <Lbl>Περιγραφή</Lbl>{!isReceipt && <Lbl>Ποσ.</Lbl>}<Lbl>{isReceipt ? 'Ποσό €' : 'Τιμή €'}</Lbl>{!isReceipt && <><Lbl>ΦΠΑ</Lbl><Lbl>Καθαρό</Lbl></>}<span />
              </div>
              {lines.map((l, i) => (
                <div key={i} className={`grid items-center gap-2 ${isReceipt ? 'grid-cols-[1fr_140px_32px]' : 'grid-cols-2 sm:grid-cols-[1fr_70px_120px_130px_100px_32px]'}`}>
                  <input className={`input ${isReceipt ? '' : 'col-span-2 sm:col-span-1'}`} placeholder="π.χ. Προμήθεια πώλησης μονάδας A-12" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                  {!isReceipt && <input className="input figure" type="number" min={0} step="any" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} />}
                  <input className="input figure" type="number" min={0} step="0.01" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: Number(e.target.value) })} />
                  {!isReceipt && (
                    <select className="input" value={l.vat_rate} onChange={(e) => setLine(i, { vat_rate: Number(e.target.value) })}>
                      {rateOptions.map((o) => <option key={o.rate} value={o.rate}>{o.label}</option>)}
                    </select>
                  )}
                  {!isReceipt && <span className="figure text-right text-sm text-charcoal-600">{money(Math.round(l.qty * l.unit_price * 100) / 100)}</span>}
                  {lines.length > 1 ? (
                    <button type="button" title="Αφαίρεση" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="text-charcoal-600/50 hover:text-signal-danger"><Trash2 size={15} /></button>
                  ) : <span />}
                </div>
              ))}
              {!isReceipt && lines.length < 100 && (
                <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setLines((ls) => [...ls, { description: '', qty: 1, unit_price: 0, vat_rate: isCredit ? ls[ls.length - 1]?.vat_rate ?? settings.defaultVat : settings.defaultVat }])}><Plus size={13} /> Γραμμή</button>
              )}
              {isCredit && <p className="text-xs text-charcoal-600/60">Αφήστε μόνο ό,τι πιστώνεται, με το ποσό που πιστώνεται (π.χ. μια έκπτωση €500).</p>}
            </>
          )}
        </div>

        <div className="panel grid gap-3 p-5 sm:grid-cols-2">
          <label className="block"><Lbl>Ημερομηνία έκδοσης</Lbl><input className="input" type="date" value={issueDate} onChange={(e) => { setIssueDate(e.target.value); if (kind === 'invoice' && e.target.value) setDueDate(addDays(e.target.value, settings.paymentTermsDays)); }} /></label>
          {kind === 'invoice' && <label className="block"><Lbl>Λήξη πληρωμής</Lbl><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>}
          {isReceipt && (
            <label className="block"><Lbl>Τρόπος πληρωμής</Lbl>
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
          )}
          <label className="block sm:col-span-2"><Lbl>{isCredit ? 'Αιτιολογία *' : 'Σημειώσεις στο παραστατικό'}</Lbl>
            <textarea className="input min-h-[64px]" value={notes} placeholder={isCredit ? 'π.χ. Έκπτωση που συμφωνήθηκε μετά την έκδοση' : ''} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
      </div>

      {/* Summary */}
      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className="panel space-y-2 p-5">
          <p className="eyebrow">Αριθμός</p>
          <p className="font-mono text-lg text-charcoal">{series ? previewNumber(series, new Date(issueDate || Date.now())) : '—'}</p>
          <p className="text-[11px] text-charcoal-600/60">Οριστικός τη στιγμή της έκδοσης.</p>
          <div className="space-y-1 border-t border-stone-line pt-3 text-sm">
            {!isReceipt && <div className="flex justify-between"><span className="text-charcoal-600">Καθαρό</span><span className="figure">{money(totals.net)}</span></div>}
            {!isReceipt && totals.breakdown.map((b) => (
              <div key={b.rate} className="flex justify-between text-charcoal-600"><span>ΦΠΑ {b.rate}%</span><span className="figure">{money(b.vat)}</span></div>
            ))}
            <div className="flex justify-between border-t border-stone-line pt-2 text-base font-semibold text-charcoal"><span>{isCredit ? 'Πίστωση' : 'Σύνολο'}</span><span className="figure">{money(totals.total)}</span></div>
          </div>
          {original && balance && (
            <p className="text-xs text-charcoal-600/70">Υπόλοιπο {original.number}: {money(balance.open)}{balance.credited ? ` · πιστωμένα ${money(balance.credited)}` : ''}</p>
          )}
        </div>
        {error && <p className="flex items-start gap-2 rounded-md bg-signal-danger/10 px-3 py-2 text-sm text-signal-danger"><Info size={14} className="mt-0.5 shrink-0" />{error}</p>}
        <button onClick={submit} disabled={pending || !series} className="btn-primary w-full justify-center"><FileCheck2 size={15} /> {pending ? 'Έκδοση…' : `Έκδοση ${KIND_LABEL[kind].toLowerCase()}`}</button>
        {!series && <p className="text-xs text-signal-danger">Λείπει η αρίθμηση: τρέξτε το supabase/ΕΚΚΡΕΜΕΙ_ΣΤΗ_ΒΑΣΗ.sql.</p>}
      </aside>
    </div>
  );
}
