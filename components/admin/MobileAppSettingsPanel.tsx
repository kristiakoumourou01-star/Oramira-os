'use client';

import { useState } from 'react';
import { Apple, Smartphone, Check, Copy, Save, Lock, Wallet } from 'lucide-react';
import { Switch, OptionBox, ColorField } from '@/components/admin/settings-ui';
import { AppImageUpload } from '@/components/admin/AppImageUpload';
import { ROLE_LABEL, type AppRole } from '@/lib/permissions';
import {
  REG_FIELDS, PROFILE_FIELDS, ADMIN_APP_MODULES, ADMIN_APP_ROLES, contrastText, type MobileAppSettings,
} from '@/lib/mobile-app-shared';

const SECTIONS: [string, string][] = [
  ['availability', 'Διαθεσιμότητα'],
  ['display', 'Τι εμφανίζεται'],
  ['login', 'Τρόπος σύνδεσης'],
  ['registration', 'Εγγραφή & πρόσβαση'],
  ['terms', 'Όροι χρήσης'],
  ['reg-fields', 'Πεδία εγγραφής'],
  ['profile-fields', 'Πεδία προφίλ'],
  ['welcome', 'Μήνυμα καλωσορίσματος'],
  ['support', 'Υποστήριξη'],
  ['social', 'Κοινωνικά δίκτυα'],
  ['colours', 'Χρώματα εφαρμογής'],
  ['apple-wallet', 'Κάρτα Apple Wallet'],
  ['google-wallet', 'Κάρτα Google Wallet'],
  ['admin-modules', 'Εφαρμογή ομάδας — ενότητες'],
  ['install', 'Εγκατάσταση'],
];

const BRAND = 'rgb(var(--c-forest))';
const col = (hex: string, fallback = BRAND) => hex || fallback;
const ink = (hex: string) => (hex && contrastText(hex) === 'dark' ? 'rgb(var(--c-charcoal))' : 'white');

/** Settings → Mobile app → Settings: όλες οι επιλογές της εφαρμογής, σε ενότητες με πλοήγηση αριστερά. */
export function MobileAppSettingsPanel({ cfg, set, canEdit, signInCode, setSignInCode, installUrl, company, save, pending, dirty, msg }: {
  cfg: MobileAppSettings; set: (p: Partial<MobileAppSettings>) => void; canEdit: boolean;
  signInCode: 'sms' | 'email'; setSignInCode: (v: 'sms' | 'email') => void;
  installUrl: string; company: string; save: () => void; pending: boolean; dirty: boolean; msg: { ok: boolean; text: string } | null;
}) {
  const [active, setActive] = useState('availability');
  const go = (id: string) => { setActive(id); document.getElementById(`ms-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const T = ({ k, label, hint }: { k: keyof MobileAppSettings; label: string; hint: string }) => (
    <OptionBox title={label} hint={hint}><Switch checked={cfg[k] as boolean} onChange={(v) => set({ [k]: v } as Partial<MobileAppSettings>)} disabled={!canEdit} label={label} /></OptionBox>
  );
  const aw = cfg.appleWallet; const gw = cfg.googleWallet;
  const setAw = (p: Partial<MobileAppSettings['appleWallet']>) => set({ appleWallet: { ...aw, ...p } });
  const setGw = (p: Partial<MobileAppSettings['googleWallet']>) => set({ googleWallet: { ...gw, ...p } });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-32 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" aria-label="Ενότητες ρυθμίσεων">
        {SECTIONS.map(([id, l]) => (
          <button key={id} type="button" onClick={() => go(id)}
            className={`shrink-0 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-left text-[13px] transition-colors ${active === id ? 'bg-forest font-medium text-white' : 'text-charcoal-600 hover:bg-stone-100 hover:text-charcoal'}`}>{l}</button>
        ))}
      </nav>

      <div className="min-w-0 space-y-7">
        <Sec id="availability" title="Διαθεσιμότητα">
          <T k="appEnabled" label="Εφαρμογή πελατών ενεργή" hint="Όταν είναι κλειστό, οι πελάτες βλέπουν μήνυμα ότι η εφαρμογή είναι προσωρινά μη διαθέσιμη." />
          <T k="adminEnabled" label="Εφαρμογή ομάδας ενεργή" hint="Η ομάδα βλέπει την αρχική οθόνη της στο κινητό." />
        </Sec>

        <Sec id="display" title="Τι εμφανίζεται">
          <T k="showPrices" label="Τιμές ακινήτων" hint="Δείχνει τιμές στα διαθέσιμα ακίνητα." />
          <T k="showAvailability" label="Διαθεσιμότητα μονάδων" hint="Πόσες μονάδες είναι διαθέσιμες σε κάθε έργο." />
          <T k="availableOnly" label="Μόνο διαθέσιμες μονάδες" hint="Οι κρατημένες και πουλημένες μονάδες δεν εμφανίζονται στη λίστα." />
          <T k="showConstruction" label="Πρόοδος κατασκευής" hint="Ποσοστό και φωτογραφίες εργοταξίου για τους αγοραστές." />
          <T k="showPayments" label="Πληρωμές" hint="Πρόγραμμα πληρωμών και επόμενη δόση." />
          <T k="showDocuments" label="Έγγραφα" hint="Συμβόλαια, τίτλοι, εγγυήσεις του πελάτη." />
          <T k="allowViewings" label="Αιτήματα προβολής" hint="Ο πελάτης ζητά ραντεβού προβολής και βλέπει τα αιτήματά του." />
          <T k="allowMaintenance" label="Αιτήματα συντήρησης" hint="Ο ιδιοκτήτης δηλώνει βλάβη και η ομάδα ειδοποιείται αμέσως." />
        </Sec>

        <Sec id="login" title="Τρόπος σύνδεσης">
          <OptionBox title="Συσκευές ανά πελάτη" hint="Σε πόσα κινητά μπορεί να είναι συνδεδεμένος ένας πελάτης ταυτόχρονα. 0 = απεριόριστα.">
            <input type="number" min={0} max={20} className="input h-9 w-20 text-center tabular-nums" disabled={!canEdit} value={cfg.devicesPerMember}
              onChange={(e) => set({ devicesPerMember: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} />
          </OptionBox>
          <OptionBox title="Κωδικός μίας χρήσης μέσω" hint="Πώς παίρνει ο πελάτης τον κωδικό σύνδεσης. Η ίδια ρύθμιση με Ρυθμίσεις → Κωδικός σύνδεσης.">
            <span className="inline-flex gap-1 rounded-full border border-stone-line bg-white p-1">
              {(['sms', 'email'] as const).map((m) => (
                <button key={m} type="button" disabled={!canEdit} aria-pressed={signInCode === m} onClick={() => setSignInCode(m)}
                  className={`rounded-full px-3.5 py-1 text-[13px] ${signInCode === m ? 'bg-forest text-white' : 'text-charcoal hover:bg-stone'}`}>{m === 'sms' ? 'SMS' : 'Email'}</button>
              ))}
            </span>
          </OptionBox>
        </Sec>

        <Sec id="registration" title="Εγγραφή & πρόσβαση">
          <T k="selfRegister" label="Εγγραφή από την εφαρμογή" hint="Νέοι πελάτες κάνουν λογαριασμό μόνοι τους από το κινητό." />
          <T k="autoApprove" label="Αυτόματη έγκριση νέων πελατών" hint="Αλλιώς οι νέοι λογαριασμοί περιμένουν έγκριση από την ομάδα." />
          <T k="allowDeletion" label="Αίτημα διαγραφής λογαριασμού" hint="Ο πελάτης ζητά διαγραφή του λογαριασμού του από την εφαρμογή (το απαιτεί η Apple)." />
        </Sec>

        <Sec id="terms" title="Όροι χρήσης" note="Το κείμενο που αποδέχεται ο πελάτης όταν κάνει εγγραφή.">
          <textarea rows={7} className="input text-sm" disabled={!canEdit} maxLength={8000} value={cfg.termsText} onChange={(e) => set({ termsText: e.target.value })} placeholder="Γράψτε εδώ τους όρους χρήσης της εφαρμογής…" />
        </Sec>

        <Sec id="reg-fields" title="Πεδία εγγραφής" note="Ποια στοιχεία ζητά η φόρμα εγγραφής και ποια είναι υποχρεωτικά.">
          <div className="overflow-x-auto">
            <table className="o-table">
              <thead><tr><th>Πεδίο</th><th className="w-24 text-center">Εμφάνιση</th><th className="w-28 text-center">Υποχρεωτικό</th></tr></thead>
              <tbody>
                {REG_FIELDS.map((f) => {
                  const v = cfg.regFields[f.key] ?? { show: f.show, required: f.required };
                  const put = (p: Partial<typeof v>) => { const n = { ...v, ...p }; if (!n.show) n.required = false; set({ regFields: { ...cfg.regFields, [f.key]: n } }); };
                  return (
                    <tr key={f.key}>
                      <td><span className="inline-flex items-center gap-1.5">{f.label}{f.locked && <Lock size={12} className="text-charcoal-600/60" />}</span></td>
                      <td className="text-center"><input type="checkbox" className="h-4 w-4 accent-forest" aria-label="Εμφάνιση" disabled={!canEdit || f.locked} checked={v.show} onChange={(e) => put({ show: e.target.checked })} /></td>
                      <td className="text-center"><input type="checkbox" className="h-4 w-4 accent-forest" aria-label="Υποχρεωτικό" disabled={!canEdit || f.locked || !v.show} checked={v.required} onChange={(e) => put({ required: e.target.checked })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Sec>

        <Sec id="profile-fields" title="Πεδία προφίλ" note="Ποια στοιχεία αλλάζει ο πελάτης μόνος του στο προφίλ του.">
          {PROFILE_FIELDS.map((f) => (
            <OptionBox key={f.key} title={f.label}>
              <Switch checked={cfg.profileFields[f.key] ?? f.on} onChange={(v) => set({ profileFields: { ...cfg.profileFields, [f.key]: v } })} disabled={!canEdit} label={f.label} />
            </OptionBox>
          ))}
        </Sec>

        <Sec id="welcome" title="Μήνυμα καλωσορίσματος" note="Το μήνυμα στην κορυφή της αρχικής οθόνης, στη γλώσσα του κάθε πελάτη.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Ελληνικά"><input className="input" disabled={!canEdit} maxLength={120} value={cfg.welcome} onChange={(e) => set({ welcome: e.target.value })} /></Field>
            <Field label="Αγγλικά"><input className="input" data-no-tr disabled={!canEdit} maxLength={120} value={cfg.welcomeEn} onChange={(e) => set({ welcomeEn: e.target.value })} /></Field>
            <Field label="Ρωσικά"><input className="input" data-no-tr disabled={!canEdit} maxLength={120} value={cfg.welcomeRu} onChange={(e) => set({ welcomeRu: e.target.value })} /></Field>
          </div>
          <Field label="Καλωσόρισμα ομάδας"><input className="input" disabled={!canEdit} maxLength={120} value={cfg.adminWelcome} onChange={(e) => set({ adminWelcome: e.target.value })} /></Field>
        </Sec>

        <Sec id="support" title="Υποστήριξη" note="Πώς επικοινωνούν οι πελάτες μαζί σας από την εφαρμογή.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email υποστήριξης"><input className="input" type="email" disabled={!canEdit} value={cfg.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} placeholder="info@…" /></Field>
            <Field label="Τηλέφωνο υποστήριξης"><input className="input" disabled={!canEdit} value={cfg.supportPhone} onChange={(e) => set({ supportPhone: e.target.value })} placeholder="+357 …" /></Field>
          </div>
        </Sec>

        <Sec id="social" title="Κοινωνικά δίκτυα">
          <div className="grid gap-3 sm:grid-cols-2">
            {([['instagram', 'Instagram', 'https://instagram.com/…'], ['facebook', 'Facebook', 'https://facebook.com/…'], ['tiktok', 'TikTok', 'https://tiktok.com/@…'], ['youtube', 'YouTube', 'https://youtube.com/@…'], ['website', 'Website', 'https://…']] as const).map(([k, l, ph]) => (
              <Field key={k} label={l}><input className="input" disabled={!canEdit} value={cfg[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<MobileAppSettings>)} placeholder={ph} /></Field>
            ))}
          </div>
        </Sec>

        <Sec id="colours" title="Χρώματα εφαρμογής" note="Κενό = το χρώμα της εταιρείας από τις Ρυθμίσεις.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Κύριο χρώμα"><ColorField value={cfg.colorPrimary} onChange={(v) => set({ colorPrimary: v })} disabled={!canEdit} placeholder="#RRGGBB" /></Field>
            <Field label="Δευτερεύον χρώμα"><ColorField value={cfg.colorSecondary} onChange={(v) => set({ colorSecondary: v })} disabled={!canEdit} placeholder="#RRGGBB" /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['light', 'dark'] as const).map((mode) => (
              <div key={mode} className={`rounded-xl border border-stone-line p-4 ${mode === 'dark' ? 'bg-charcoal' : 'bg-white'}`}>
                <p className={`mb-3 text-[12px] font-semibold uppercase tracking-wide ${mode === 'dark' ? 'text-white/70' : 'text-charcoal-600'}`}>{mode === 'dark' ? 'Σκούρο θέμα' : 'Φωτεινό θέμα'}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-4 py-1.5 text-[13px] font-semibold" style={{ background: col(cfg.colorPrimary), color: ink(cfg.colorPrimary) }}>Κλείστε προβολή</span>
                  <span className="rounded-full px-3 py-1 text-[12px] font-medium" style={{ background: col(cfg.colorSecondary, 'rgb(var(--c-sand))'), color: cfg.colorSecondary ? ink(cfg.colorSecondary) : 'rgb(var(--c-charcoal))' }}>Διαθέσιμο</span>
                  <span className="text-[13px] font-semibold" style={{ color: col(cfg.colorPrimary) }}>Όλα τα έργα →</span>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        <Sec id="apple-wallet" title="Κάρτα Apple Wallet" note="Η κάρτα πελάτη που μπαίνει στο Apple Wallet του iPhone.">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Φόντο"><ColorField value={aw.bg} onChange={(v) => setAw({ bg: v })} disabled={!canEdit} placeholder="#RRGGBB" /></Field>
                <Field label="Κείμενο"><ColorField value={aw.text} onChange={(v) => setAw({ text: v })} disabled={!canEdit} placeholder="#RRGGBB" /></Field>
                <Field label="Ετικέτες"><ColorField value={aw.label} onChange={(v) => setAw({ label: v })} disabled={!canEdit} placeholder="#RRGGBB" /></Field>
              </div>
              <Field label="Κείμενο δίπλα στο logo"><input className="input" disabled={!canEdit} maxLength={40} value={aw.logoText} onChange={(e) => setAw({ logoText: e.target.value })} placeholder={company} /></Field>
              <Field label="Περιγραφή"><input className="input" disabled={!canEdit} maxLength={120} value={aw.description} onChange={(e) => setAw({ description: e.target.value })} placeholder="Κάρτα πελάτη" /></Field>
              <Field label="Logo"><AppImageUpload compact value={aw.logo} onChange={(u) => setAw({ logo: u })} folder="wallet/apple" disabled={!canEdit} /></Field>
            </div>
            <WalletPreview bg={aw.bg} fg={aw.text} label={aw.label} logo={aw.logo} title={aw.logoText || company} sub={aw.description || 'Κάρτα πελάτη'} icon={<Apple size={13} />} />
          </div>
        </Sec>

        <Sec id="google-wallet" title="Κάρτα Google Wallet" note="Η κάρτα πελάτη για κινητά Android.">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-3">
              <Field label="Φόντο"><ColorField value={gw.bg} onChange={(v) => setGw({ bg: v })} disabled={!canEdit} placeholder="#RRGGBB" /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Τίτλος"><input className="input" disabled={!canEdit} maxLength={60} value={gw.title} onChange={(e) => setGw({ title: e.target.value })} placeholder={company} /></Field>
                <Field label="Υπότιτλος"><input className="input" disabled={!canEdit} maxLength={60} value={gw.subheader} onChange={(e) => setGw({ subheader: e.target.value })} placeholder="Κάρτα πελάτη" /></Field>
              </div>
              <Field label="Περιγραφή logo (για προσβασιμότητα)"><input className="input" disabled={!canEdit} maxLength={60} value={gw.logoAlt} onChange={(e) => setGw({ logoAlt: e.target.value })} placeholder={company} /></Field>
              <Field label="Logo"><AppImageUpload compact value={gw.logo} onChange={(u) => setGw({ logo: u })} folder="wallet/google" disabled={!canEdit} /></Field>
            </div>
            <WalletPreview bg={gw.bg} fg="" label="" logo={gw.logo} title={gw.title || company} sub={gw.subheader || 'Κάρτα πελάτη'} icon={<Wallet size={13} />} />
          </div>
        </Sec>

        <Sec id="admin-modules" title="Εφαρμογή ομάδας — ενότητες" note="Ποιες ενότητες βλέπει κάθε ρόλος στην εφαρμογή της ομάδας. Ο Κάτοχος λογαριασμού βλέπει πάντα όλες.">
          <div className="overflow-x-auto">
            <table className="o-table">
              <thead>
                <tr><th>Ενότητα</th><th className="text-center">{ROLE_LABEL.admin}</th>{ADMIN_APP_ROLES.map((r) => <th key={r} className="text-center">{ROLE_LABEL[r as AppRole]}</th>)}</tr>
              </thead>
              <tbody>
                {ADMIN_APP_MODULES.map((m) => (
                  <tr key={m.key}>
                    <td>{m.label}</td>
                    <td className="text-center"><input type="checkbox" className="h-4 w-4 accent-forest" checked disabled aria-label={ROLE_LABEL.admin} /></td>
                    {ADMIN_APP_ROLES.map((r) => {
                      const list = cfg.adminModules[r] ?? [];
                      const on = list.includes(m.key);
                      return (
                        <td key={r} className="text-center">
                          <input type="checkbox" className="h-4 w-4 accent-forest" disabled={!canEdit} checked={on} aria-label={ROLE_LABEL[r as AppRole]}
                            onChange={() => set({ adminModules: { ...cfg.adminModules, [r]: on ? list.filter((k) => k !== m.key) : [...list, m.key] } })} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Sec>

        <Sec id="install" title="Εγκατάσταση στο κινητό" note="Η εφαρμογή μπαίνει στο κινητό σαν κανονική εφαρμογή, χωρίς App Store και χωρίς κόστος. Στείλτε το link στους πελάτες και στην ομάδα.">
          <CopyField url={installUrl} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-stone-line p-3 text-[14px] text-charcoal-600"><p className="mb-1 flex items-center gap-1.5 font-semibold text-charcoal"><Apple size={14} /> iPhone</p><p className="text-[12.5px]">Safari → Κοινοποίηση → «Προσθήκη στην οθόνη Αφετηρίας».</p></div>
            <div className="rounded-xl border border-stone-line p-3 text-[14px] text-charcoal-600"><p className="mb-1 flex items-center gap-1.5 font-semibold text-charcoal"><Smartphone size={14} /> Android</p><p className="text-[12.5px]">Chrome → ⋮ → «Εγκατάσταση εφαρμογής».</p></div>
          </div>
        </Sec>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-3 border-t border-stone-line pt-4">
            <button type="button" onClick={save} disabled={!dirty || pending} className="btn-primary"><Save size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση ρυθμίσεων'}</button>
            {dirty && !msg && <span className="text-[13px] text-charcoal-600">Μη αποθηκευμένες αλλαγές</span>}
            {msg && <span className={`text-[13px] ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function Sec({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section id={`ms-${id}`} className="scroll-mt-32 space-y-2">
      <h3 className="font-display text-xl text-charcoal">{title}</h3>
      {note && <p className="text-sm text-charcoal-600/75">{note}</p>}
      <div className="space-y-3 rounded-2xl border border-stone-line bg-white p-4 sm:p-5">{children}</div>
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[12px] font-medium text-charcoal-600">{label}</span>{children}</label>;
}
function CopyField({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return <div className="flex gap-2"><input readOnly className="input min-w-0 flex-1 text-xs" value={url} data-no-tr /><button type="button" onClick={() => { void navigator.clipboard.writeText(url).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-forest px-3.5 text-[13px] font-medium text-white">{ok ? <Check size={13} /> : <Copy size={13} />} {ok ? 'Αντιγράφηκε' : 'Αντιγραφή'}</button></div>;
}
function WalletPreview({ bg, fg, label, logo, title, sub, icon }: { bg: string; fg: string; label: string; logo: string; title: string; sub: string; icon: React.ReactNode }) {
  const text = fg || ink(bg);
  const lab = label || text;
  return (
    <div className="mx-auto w-full max-w-[260px] rounded-2xl p-4 shadow-sm" style={{ background: col(bg), color: text }}>
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo ? <img src={logo} alt="" className="h-7 w-7 rounded object-contain" /> : <span className="flex h-7 w-7 items-center justify-center rounded bg-white/20">{icon}</span>}
        <span className="truncate text-[13px] font-semibold" data-no-tr>{title}</span>
      </div>
      <p className="mt-6 text-[10px] uppercase tracking-wide opacity-80" style={{ color: lab }}>Πελάτης</p>
      <p className="text-[15px] font-semibold" data-no-tr>Maria Papadopoulou</p>
      <p className="mt-3 text-[10px] uppercase tracking-wide opacity-80" style={{ color: lab }}>{sub}</p>
      <div className="mt-3 h-10 rounded bg-white/90" />
    </div>
  );
}
