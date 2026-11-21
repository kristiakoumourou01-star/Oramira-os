'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, KeyRound, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { PopSelect } from '@/components/ui/PopSelect';
import { Switch, OptionBox, FieldLabel } from '@/components/admin/settings-ui';
import { saveCustomerProfile, setDefaultOtp } from '@/app/actions/customer-card';
import { GENDERS, type CustomerProfileInput } from '@/lib/customer-card-shared';
import { countryOptions } from '@/lib/kyc-shared';
import { currentLocale, DATE_TAG } from '@/lib/locale-shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const flag = (iso: string) => (/^[A-Z]{2}$/.test(iso) ? iso.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0))) : '');
const uid = () => Math.random().toString(36).slice(2, 10);

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b border-stone-line pb-5 last:border-0 last:pb-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-forest">{title}</p>
      {children}
      {note && <p className="rounded-xl border border-stone-line bg-stone-50 px-3 py-2 text-xs text-charcoal-600">{note}</p>}
    </section>
  );
}
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`block min-w-0 ${wide ? 'sm:col-span-2' : ''}`}><FieldLabel>{label}</FieldLabel>{children}</label>;
}

/** Λίστα επιλογής (ομάδες / tags) με «Προσθήκη» νέου. */
function ChipPicker({ value, options, onChange, addLabel }: { value: string[]; options: string[]; onChange: (v: string[]) => void; addLabel: string }) {
  const [adding, setAdding] = useState(false);
  const [txt, setTxt] = useState('');
  const all = [...new Set([...options, ...value])];
  const add = () => { const t = txt.trim().slice(0, 60); if (t && !value.includes(t)) onChange([...value, t]); setTxt(''); setAdding(false); };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {all.map((o) => {
        const on = value.includes(o);
        return <button key={o} type="button" onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] transition-colors ${on ? 'border-forest bg-forest text-white' : 'border-stone-line bg-white text-charcoal hover:border-forest/30'}`} data-no-tr>{o}</button>;
      })}
      {adding
        ? <span className="inline-flex items-center gap-1"><input autoFocus className="input h-7 w-36 py-0 text-[12px]" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } if (e.key === 'Escape') setAdding(false); }} /><button type="button" onClick={add} className="btn-secondary h-7 px-2 text-[12px]">OK</button></span>
        : <button type="button" onClick={() => setAdding(true)} className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-stone-line px-2.5 text-[12px] text-charcoal-600 hover:border-forest/40 hover:text-forest"><Plus size={12} /> {addLabel}</button>}
    </div>
  );
}

/**
 * «Επεξεργασία πελάτη» (όπως στο FitnessCRM): ταυτότητα, επικοινωνία,
 * διεύθυνση, επάγγελμα, ομαδοποίηση, εγγραφή, κωδικός εφαρμογής,
 * προτιμήσεις, φωτογραφία και σημειώσεις.
 */
export function EditCustomerDialog({ contactId, initial, photoUrl, groupOptions, tagOptions, otp, onClose }: {
  contactId: string; initial: CustomerProfileInput; photoUrl: string | null; groupOptions: string[]; tagOptions: string[];
  otp: { setAt: string | null; available: boolean }; onClose: () => void;
}) {
  const router = useRouter();
  const [f, setF] = useState<CustomerProfileInput>(initial);
  const [photo, setPhoto] = useState<{ url: string | null; path?: string | null }>({ url: photoUrl });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [addrQ, setAddrQ] = useState('');
  const [addrHits, setAddrHits] = useState<any[]>([]);
  const [otpState, setOtpState] = useState(otp.setAt);
  const [otpCode, setOtpCode] = useState('');
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpMsg, setOtpMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const lang = currentLocale().lang;
  const countries = useMemo(() => countryOptions(lang), [lang]);
  const set = (p: Partial<CustomerProfileInput>) => setF((x) => ({ ...x, ...p }));

  const findAddress = async () => {
    const q = addrQ.trim(); if (q.length < 3) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ format: 'json', addressdetails: '1', limit: '5', q })}`);
      setAddrHits(r.ok ? await r.json() : []);
    } catch { setAddrHits([]); }
  };
  const pickAddress = (h: any) => {
    const a = h.address ?? {};
    set({ address: [a.road, a.house_number].filter(Boolean).join(' ') || String(h.display_name ?? '').split(',')[0], city: a.city ?? a.town ?? a.village ?? a.municipality ?? '', postcode: a.postcode ?? '', country: String(a.country_code ?? '').toUpperCase() });
    setAddrHits([]); setAddrQ('');
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Διαλέξτε εικόνα.'); return; }
    if (file.size > 15 * 1024 * 1024) { setErr('Η εικόνα είναι πάνω από 15 MB.'); return; }
    const path = `contacts/${contactId}/photo-${uid()}.${(file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'}`;
    const { error } = await createSupabaseBrowserClient().storage.from('contracts').upload(path, file, { upsert: false });
    if (error) { setErr(`Η φωτογραφία δεν ανέβηκε: ${error.message}`); return; }
    setPhoto({ url: URL.createObjectURL(file), path });
  };
  const save = () => start(async () => {
    setErr(null);
    const r = await saveCustomerProfile(contactId, { ...f, ...(photo.path !== undefined ? { photoPath: photo.path } : {}) });
    if (!r.ok) { setErr(r.error); if (!/0094/.test(r.error)) return; }
    router.refresh(); if (r.ok) onClose();
  });
  const otpSave = (code: string | null) => start(async () => {
    setOtpMsg(null);
    const r = await setDefaultOtp(contactId, code);
    if (!r.ok) { setOtpMsg(r.error); return; }
    setOtpState(r.setAt ?? null); setOtpCode(''); setOtpOpen(false);
    setOtpMsg(code ? 'Ο κωδικός ορίστηκε.' : 'Ο κωδικός καθαρίστηκε.');
  });

  return (
    <Modal open onClose={onClose} title="Επεξεργασία πελάτη" size="xl" closeOnBackdrop={false}>
      <ModalBody className="space-y-5">
        <Section title="Ταυτότητα">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Όνομα *"><input className="input" value={f.firstName} onChange={(e) => set({ firstName: e.target.value })} /></Field>
            <Field label="Επώνυμο"><input className="input" value={f.lastName} onChange={(e) => set({ lastName: e.target.value })} /></Field>
            <Field label="Φύλο"><PopSelect width="w-full" value={f.gender} onChange={(v) => set({ gender: v })} options={[['', '—'], ...GENDERS.map((g) => [g.v, g.l] as [string, string])]} /></Field>
            <Field label="Ημ. γέννησης"><input type="date" className="input" value={f.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} /></Field>
            <Field label="Αρ. ταυτότητας / διαβατηρίου"><input className="input" value={f.idNumber} onChange={(e) => set({ idNumber: e.target.value })} /></Field>
            <Field label="Κωδικός πελάτη"><input className="input" value={f.memberCode} onChange={(e) => set({ memberCode: e.target.value })} /></Field>
          </div>
        </Section>

        <Section title="Επικοινωνία" note="Ο πελάτης μπαίνει στην εφαρμογή με κωδικό που στέλνεται με SMS σε αυτό το κινητό — πρέπει να είναι το δικό του, σωστό κινητό.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Κινητό"><PhoneInput value={f.phone} onChange={(v) => set({ phone: v })} /></Field>
            <Field label="Σταθερό"><input className="input" inputMode="tel" value={f.phone2} onChange={(e) => set({ phone2: e.target.value })} /></Field>
            <Field label="E-mail"><input type="email" className="input" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
            <Field label="Fax"><input className="input" inputMode="tel" value={f.fax} onChange={(e) => set({ fax: e.target.value })} /></Field>
          </div>
        </Section>

        <Section title="Διεύθυνση">
          <div className="relative">
            <FieldLabel>Βρείτε τη διεύθυνση</FieldLabel>
            <div className="flex gap-2">
              <label className="relative flex-1"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" />
                <input className="input pl-8" placeholder="Αρχίστε να γράφετε μια διεύθυνση…" value={addrQ} onChange={(e) => setAddrQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void findAddress(); } }} /></label>
              <button type="button" className="btn-secondary" onClick={() => void findAddress()}>Αναζήτηση</button>
            </div>
            {addrHits.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-line bg-white shadow-overlay">
                {addrHits.map((h) => <li key={h.place_id}><button type="button" onClick={() => pickAddress(h)} className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50" data-no-tr>{h.display_name}</button></li>)}
              </ul>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Διεύθυνση" wide><input className="input" value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
            <Field label="Πόλη"><input className="input" value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
            <Field label="Τ.Κ."><input className="input" value={f.postcode} onChange={(e) => set({ postcode: e.target.value })} /></Field>
            <Field label="Χώρα" wide><PopSelect searchable width="w-full" value={f.country} onChange={(v) => set({ country: v })} options={[['', '—'], ...countries.map((c) => [c.code, `${flag(c.code)} ${c.name}`] as [string, string])]} /></Field>
          </div>
        </Section>

        <Section title="Επάγγελμα / εταιρεία">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Επάγγελμα"><input className="input" value={f.profession} onChange={(e) => set({ profession: e.target.value })} /></Field>
            <Field label="Εταιρεία"><input className="input" value={f.company} onChange={(e) => set({ company: e.target.value })} /></Field>
          </div>
        </Section>

        <Section title="Ομαδοποίηση" note="Οι ομάδες και τα tags βοηθούν στα φίλτρα της λίστας πελατών και στη στόχευση του Marketing.">
          <div><FieldLabel>Ομάδες</FieldLabel><ChipPicker value={f.groups} options={groupOptions} onChange={(v) => set({ groups: v })} addLabel="Νέα ομάδα" /></div>
          <div><FieldLabel>Tags</FieldLabel><ChipPicker value={f.tags} options={tagOptions} onChange={(v) => set({ tags: v })} addLabel="Νέο tag" /></div>
        </Section>

        <Section title="Ημερομηνία εγγραφής">
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Εγγραφή"><input type="date" className="input" value={f.registeredAt} onChange={(e) => set({ registeredAt: e.target.value })} /></Field></div>
        </Section>

        <Section title="Εφαρμογή κινητού" note="Ένας σταθερός κωδικός που μπορεί να βάλει ο πελάτης στην εφαρμογή αν δεν του έρθει ο κωδικός με SMS ή email. Αποθηκεύεται κρυπτογραφημένος — δεν εμφανίζεται ξανά.">
          <OptionBox title="Προεπιλεγμένος κωδικός (OTP)" hint={!otp.available ? 'Ενεργοποιείται με το migration 0093.' : otpState ? `Ορίστηκε ${new Date(otpState).toLocaleDateString(DATE_TAG[lang], { day: '2-digit', month: '2-digit', year: 'numeric' })}` : 'Δεν έχει οριστεί'}>
            <span className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${otpState ? 'bg-forest text-white' : 'border border-stone-line text-charcoal-600'}`}>{otpState ? 'Ορισμένος' : 'Χωρίς κωδικό'}</span>
              {otp.available && <button type="button" onClick={() => setOtpOpen((x) => !x)} className="btn-secondary h-8 px-2.5 text-[13px]"><KeyRound size={13} /> {otpState ? 'Αλλαγή' : 'Ορισμός'}</button>}
              {otp.available && otpState && <button type="button" disabled={pending} onClick={() => otpSave(null)} className="h-8 rounded-lg px-2.5 text-[13px] text-charcoal-600 hover:text-signal-danger">Καθαρισμός</button>}
            </span>
          </OptionBox>
          {otpOpen && (
            <div className="flex flex-wrap items-center gap-2">
              <input className="input h-9 w-40 tracking-[0.3em]" inputMode="numeric" autoComplete="off" placeholder="4–8 ψηφία" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))} />
              <button type="button" disabled={pending || otpCode.length < 4} onClick={() => otpSave(otpCode)} className="btn-primary h-9">Αποθήκευση κωδικού</button>
              <button type="button" onClick={() => { setOtpOpen(false); setOtpCode(''); }} className="btn-secondary h-9">Άκυρο</button>
            </div>
          )}
          {otpMsg && <p className="text-xs text-charcoal-600">{otpMsg}</p>}
        </Section>

        <Section title="Προτιμήσεις">
          <div className="space-y-2">
            <OptionBox title="Λαμβάνει SMS" hint="Ενημερώσεις και υπενθυμίσεις με SMS."><Switch label="Λαμβάνει SMS" checked={f.receiveSms} onChange={(v) => set({ receiveSms: v })} /></OptionBox>
            <OptionBox title="Λαμβάνει email" hint="Ενημερώσεις, προσφορές και έγγραφα με email."><Switch label="Λαμβάνει email" checked={f.receiveEmail} onChange={(v) => set({ receiveEmail: v })} /></OptionBox>
            <OptionBox title="Λαμβάνει push" hint="Ειδοποιήσεις στην εφαρμογή του κινητού."><Switch label="Λαμβάνει push" checked={f.receivePush} onChange={(v) => set({ receivePush: v })} /></OptionBox>
          </div>
        </Section>

        <Section title="Φωτογραφία">
          <div className="flex flex-wrap items-center gap-3">
            {photo.url
              // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
              ? <img src={photo.url} alt="" className="h-16 w-16 rounded-full object-cover" />
              : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-forest/[0.09] text-lg font-semibold text-forest">{(f.firstName[0] ?? '?').toUpperCase()}{(f.lastName[0] ?? '').toUpperCase()}</span>}
            <button type="button" className="btn-secondary h-9" onClick={() => fileRef.current?.click()}><Upload size={14} /> Ανέβασμα</button>
            <button type="button" className="btn-secondary h-9" onClick={() => camRef.current?.click()}><Camera size={14} /> Λήψη φωτογραφίας</button>
            {photo.url && <button type="button" className="h-9 rounded-lg px-2.5 text-[13px] text-charcoal-600 hover:text-signal-danger" onClick={() => setPhoto({ url: null, path: null })}><Trash2 size={14} className="mr-1 inline" />Αφαίρεση</button>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
            <input ref={camRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
          </div>
        </Section>

        <Section title="Σημειώσεις">
          <textarea className="input min-h-[90px]" value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Section>
        {err && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-signal-danger">{err}</p>}
      </ModalBody>
      <ModalFooter className="justify-end">
        <button type="button" className="btn-secondary" onClick={onClose}><X size={14} /> Άκυρο</button>
        <button type="button" className="btn-primary" disabled={pending} onClick={save}>{pending ? '…' : 'Αποθήκευση'}</button>
      </ModalFooter>
    </Modal>
  );
}
