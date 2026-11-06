'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Trash2, Building2 } from 'lucide-react';
import { saveBusinessSettings } from '@/app/actions/org-settings';
import type { BusinessSettings, Office } from '@/lib/org-settings-shared';

const EMPTY_OFFICE: Office = { name: '', address: '', phone: '', manager: '', main: false };

export function BusinessSection({ initial, companyName, canEdit }: { initial: BusinessSettings; companyName: string; canEdit: boolean }) {
  const [b, setB] = useState<BusinessSettings>({ ...initial, offices: initial.offices.length ? initial.offices : [] });
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  const set = <K extends keyof BusinessSettings>(k: K, v: BusinessSettings[K]) => { setB((p) => ({ ...p, [k]: v })); setMsg(null); };
  const setOffice = (i: number, patch: Partial<Office>) => set('offices', b.offices.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const addOffice = () => set('offices', [...b.offices, { ...EMPTY_OFFICE, main: b.offices.length === 0 }]);
  const removeOffice = (i: number) => set('offices', b.offices.filter((_, idx) => idx !== i));
  const makeMain = (i: number) => set('offices', b.offices.map((o, idx) => ({ ...o, main: idx === i })));

  function onSave() {
    startTransition(async () => {
      const res = await saveBusinessSettings(b);
      if (res.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); }
      else setMsg({ ok: false, text: res.error });
    });
  }

  const Field = ({ label, k, placeholder }: { label: string; k: keyof BusinessSettings; placeholder?: string }) => (
    <label className="block">
      <span className="eyebrow mb-1 block">{label}</span>
      <input className="input" disabled={!canEdit} value={(b[k] as string) ?? ''} placeholder={placeholder} onChange={(e) => set(k, e.target.value as any)} />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="panel space-y-4 p-5">
        <h4>Company</h4>
        <label className="block">
          <span className="eyebrow mb-1 block">Company name</span>
          <input className="input" value={companyName} disabled readOnly />
          <span className="mt-1 block text-xs text-charcoal-600/60">Το όνομα & το λογότυπο ρυθμίζονται στο <strong>Appearance</strong>.</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Registration no." k="registrationNo" placeholder="HE 000000" />
          <Field label="VAT no." k="vatNo" placeholder="CY00000000X" />
          <Field label="Estate agent licence" k="licence" placeholder="Reg. 000 · Licence 000/E" />
          <Field label="Invoice email" k="invoiceEmail" placeholder="accounts@company.cy" />
          <Field label="Website" k="website" placeholder="company.cy" />
        </div>
        <label className="block">
          <span className="eyebrow mb-1 block">Document footer</span>
          <textarea className="input min-h-[64px]" disabled={!canEdit} value={b.footer} placeholder="Company · Reg · Bank / IBAN…" onChange={(e) => set('footer', e.target.value)} />
        </label>
      </div>

      <div className="panel space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2"><Building2 size={15} className="text-olive" strokeWidth={1.75} /> Offices</h4>
          {canEdit && <button onClick={addOffice} className="btn-ghost text-xs"><Plus size={13} /> Add office</button>}
        </div>
        {b.offices.length === 0 && <p className="text-sm text-charcoal-600/60">No offices yet.</p>}
        <div className="space-y-3">
          {b.offices.map((o, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.4fr_1fr_auto_auto] items-center gap-2 rounded-lg border border-stone-line p-2">
              <input className="input" disabled={!canEdit} placeholder="City / name" value={o.name} onChange={(e) => setOffice(i, { name: e.target.value })} />
              <input className="input" disabled={!canEdit} placeholder="Address" value={o.address} onChange={(e) => setOffice(i, { address: e.target.value })} />
              <input className="input" disabled={!canEdit} placeholder="Phone" value={o.phone} onChange={(e) => setOffice(i, { phone: e.target.value })} />
              <button onClick={() => makeMain(i)} disabled={!canEdit} className={`badge ${o.main ? 'badge-forest' : 'badge-neutral'}`} title="Main office">{o.main ? 'Main' : 'Set main'}</button>
              {canEdit && <button onClick={() => removeOffice(i)} className="text-signal-danger/70 hover:text-signal-danger"><Trash2 size={15} /></button>}
            </div>
          ))}
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <button onClick={onSave} disabled={isPending} className="btn-primary"><Check size={15} /> {isPending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
