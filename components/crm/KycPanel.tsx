'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ShieldAlert, Check, X, ExternalLink, AlertTriangle } from 'lucide-react';
import { saveKyc } from '@/app/actions/contact-card';
import {
  FUNDS, ID_TYPES, KYC_STATUS, PEP_OPTIONS, PERSON_TYPES, RISK_LABEL, computeRisk, countryOptions, verifyMissing,
  type AmlSettings, type KycData,
} from '@/lib/kyc-shared';
import { formatDate, formatDateTime } from '@/lib/format';

const Lbl = ({ children }: { children: React.ReactNode }) => <span className="eyebrow mb-1 block">{children}</span>;
const SANCTION_LINKS = [
  { href: 'https://www.sanctionsmap.eu/', label: 'EU Sanctions Map' },
  { href: 'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list', label: 'ΟΗΕ — ενιαία λίστα' },
  { href: 'https://sanctionssearch.ofac.treas.gov/', label: 'OFAC (ΗΠΑ)' },
];

export interface KycMeta { verifiedAt: string | null; verifiedBy: string | null; reviewDue: string | null; updatedAt: string | null }

/** Έλεγχος ταυτότητας & AML με βαθμό κινδύνου που εξηγεί από πού βγαίνει. */
export function KycPanel({ contactId, initial, meta, aml, canEdit, missing, contactNationality }: {
  contactId: string; initial: KycData; meta: KycMeta; aml: AmlSettings; canEdit: boolean; missing: boolean; contactNationality?: string | null;
}) {
  const router = useRouter();
  const [k, setK] = useState<KycData>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const countries = useMemo(() => countryOptions('el'), []);
  const risk = computeRisk(k, aml);
  const miss = verifyMissing(k);
  const rl = RISK_LABEL[risk.level];
  const st = KYC_STATUS[initial.status] ?? KYC_STATUS.not_started;
  const overdue = meta.reviewDue && meta.reviewDue < new Date().toISOString().slice(0, 10);
  const set = (p: Partial<KycData>) => { setK((x) => ({ ...x, ...p })); setMsg(null); };
  const dis = !canEdit || missing;

  const run = (action: 'save' | 'verify' | 'reject') => start(async () => {
    const r = await saveKyc(contactId, k, action);
    if (r.ok) { setMsg({ ok: true, text: action === 'verify' ? 'Ο φάκελος επαληθεύτηκε.' : action === 'reject' ? 'Ο φάκελος σημειώθηκε ως απορριφθείς.' : 'Αποθηκεύτηκε.' }); router.refresh(); }
    else setMsg({ ok: false, text: r.error });
  });

  const country = (value: string | null, on: (c: string | null) => void) => (
    <select className="input py-1.5 text-sm" disabled={dis} value={value ?? ''} onChange={(e) => on(e.target.value || null)}>
      <option value="">—</option>
      {countries.map((c) => <option key={c.code} value={c.code}>{c.name}{aml.highRisk.includes(c.code) ? ' ⚠ υψηλός κίνδυνος' : aml.monitored.includes(c.code) ? ' · παρακολούθηση FATF' : ''}</option>)}
    </select>
  );
  const box = (checked: boolean, on: (b: boolean) => void, label: string) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={dis} checked={checked} onChange={(e) => on(e.target.checked)} /> {label}</label>
  );

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          {risk.level === 'low' ? <ShieldCheck size={28} style={{ color: rl.fg }} /> : <ShieldAlert size={28} style={{ color: risk.level === 'blocked' ? '#8A2A20' : rl.fg }} />}
          <div>
            <p className="text-sm">Κίνδυνος <span className="ml-1 rounded px-2 py-0.5 text-sm font-semibold" style={{ background: rl.bg, color: rl.fg }}>{rl.label} · {risk.score}/100</span>
              {risk.edd && risk.level !== 'blocked' && <span className="ml-2 text-xs text-signal-danger">Χρειάζεται ενισχυμένη δέουσα επιμέλεια</span>}</p>
            <p className={`mt-1 text-xs ${st.tone}`}>
              Φάκελος: {st.label}
              {meta.verifiedAt && <> · επαληθεύτηκε {formatDate(meta.verifiedAt)}{meta.verifiedBy ? ` από ${meta.verifiedBy}` : ''}</>}
              {meta.reviewDue && <span className={overdue ? 'text-signal-danger' : 'text-charcoal-600/70'}> · επανέλεγχος {overdue ? 'έχει καθυστερήσει από' : 'έως'} {formatDate(meta.reviewDue)}</span>}
            </p>
          </div>
        </div>
        <p className="max-w-sm text-[11px] text-charcoal-600/60">Βοήθημα για την ομάδα — η τελική κρίση είναι του υπεύθυνου συμμόρφωσης. Λίστες FATF: {formatDate(aml.listsAsOf)}.</p>
      </div>
      {missing && <p className="text-xs text-champagne-600">Ενεργοποιείται μόλις τρέξει το migration 0067.</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="panel space-y-3 p-5">
            <h4>Πρόσωπο & έγγραφο</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block"><Lbl>Είδος</Lbl><select className="input py-1.5 text-sm" disabled={dis} value={k.person_type} onChange={(e) => set({ person_type: e.target.value })}>{PERSON_TYPES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}</select></label>
              <label className="block"><Lbl>Ημ. γέννησης</Lbl><input type="date" className="input py-1.5 text-sm" disabled={dis} value={k.date_of_birth ?? ''} onChange={(e) => set({ date_of_birth: e.target.value || null })} /></label>
              <label className="block"><Lbl>Επάγγελμα</Lbl><input className="input py-1.5 text-sm" disabled={dis} value={k.occupation ?? ''} onChange={(e) => set({ occupation: e.target.value || null })} /></label>
              <label className="block"><Lbl>Έγγραφο</Lbl><select className="input py-1.5 text-sm" disabled={dis} value={k.id_type ?? ''} onChange={(e) => set({ id_type: e.target.value || null })}><option value="">—</option>{ID_TYPES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}</select></label>
              <label className="block"><Lbl>Αριθμός</Lbl><input className="input py-1.5 text-sm" disabled={dis} value={k.id_number ?? ''} onChange={(e) => set({ id_number: e.target.value || null })} autoComplete="off" /></label>
              <label className="block"><Lbl>Λήξη</Lbl><input type="date" className="input py-1.5 text-sm" disabled={dis} value={k.id_expiry ?? ''} onChange={(e) => set({ id_expiry: e.target.value || null })} /></label>
              <label className="block"><Lbl>Χώρα έκδοσης</Lbl>{country(k.id_country, (c) => set({ id_country: c }))}</label>
              <label className="block"><Lbl>Υπηκοότητα</Lbl>{country(k.nationality, (c) => set({ nationality: c }))}{!k.nationality && contactNationality && <span className="mt-0.5 block text-[10px] text-charcoal-600/60">Στην επαφή: «{contactNationality}»</span>}</label>
              <label className="block"><Lbl>Χώρα διαμονής</Lbl>{country(k.residence_country, (c) => set({ residence_country: c }))}</label>
            </div>
            <label className="block"><Lbl>Διεύθυνση</Lbl><input className="input py-1.5 text-sm" disabled={dis} value={k.address ?? ''} onChange={(e) => set({ address: e.target.value || null })} /></label>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {box(k.address_verified, (b) => set({ address_verified: b }), 'Η διεύθυνση επαληθεύτηκε (λογαριασμός ≤ 3 μηνών)')}
              {box(k.remote_onboarding, (b) => set({ remote_onboarding: b }), 'Χωρίς φυσική παρουσία')}
            </div>
          </div>

          <div className="panel space-y-3 p-5">
            <h4>PEP & κυρώσεις</h4>
            <label className="block max-w-sm"><Lbl>Πολιτικά εκτεθειμένο πρόσωπο (PEP)</Lbl><select className="input py-1.5 text-sm" disabled={dis} value={k.pep} onChange={(e) => set({ pep: e.target.value })}>{PEP_OPTIONS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}</select></label>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>Έλεγχος σε λίστες κυρώσεων: {k.sanctions_checked_at ? <b>{formatDateTime(k.sanctions_checked_at)}</b> : <span className="text-signal-danger">δεν έγινε</span>}</span>
              {!dis && <button type="button" onClick={() => set({ sanctions_checked_at: new Date().toISOString() })} className="btn-secondary px-2.5 py-1 text-xs">Έγινε έλεγχος τώρα</button>}
            </div>
            <p className="flex flex-wrap gap-3 text-xs">{SANCTION_LINKS.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-forest hover:underline"><ExternalLink size={11} /> {l.label}</a>)}</p>
            {box(k.sanctions_hit, (b) => set({ sanctions_hit: b }), 'Βρέθηκε ταίριασμα σε λίστα κυρώσεων')}
          </div>

          <div className="panel space-y-3 p-5">
            <h4>Προέλευση χρημάτων & πληρωμή</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><Lbl>Πηγή χρημάτων</Lbl><select className="input py-1.5 text-sm" disabled={dis} value={k.funds_source ?? ''} onChange={(e) => set({ funds_source: e.target.value || null })}><option value="">—</option>{FUNDS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}</select></label>
              <label className="block"><Lbl>Από ποια χώρα έρχονται</Lbl>{country(k.funds_country, (c) => set({ funds_country: c }))}</label>
            </div>
            <textarea className="input min-h-[60px] text-sm" disabled={dis} maxLength={1000} placeholder="Λεπτομέρειες / ποια έγγραφα το αποδεικνύουν" value={k.funds_note ?? ''} onChange={(e) => set({ funds_note: e.target.value || null })} />
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {box(k.funds_verified, (b) => set({ funds_verified: b }), 'Αποδείχθηκε με έγγραφα')}
              {box(k.cash_payment, (b) => set({ cash_payment: b }), 'Πληρωμή με μετρητά')}
              {box(k.third_party_payer, (b) => set({ third_party_payer: b }), 'Πληρώνει τρίτος')}
            </div>
          </div>

          <div className="panel space-y-2 p-5">
            <h4>Σημειώσεις συμμόρφωσης</h4>
            <textarea className="input min-h-[70px] text-sm" disabled={dis} maxLength={2000} value={k.notes ?? ''} onChange={(e) => set({ notes: e.target.value || null })} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel space-y-2 p-5 lg:sticky lg:top-4">
            <h4>Από πού βγαίνει ο βαθμός</h4>
            {risk.factors.length === 0 ? <p className="text-sm text-signal-success">Κανένας παράγοντας κινδύνου.</p> : (
              <ul className="space-y-1.5 text-xs">
                {risk.factors.map((f) => <li key={f.key} className="flex justify-between gap-2"><span>{f.label}</span><span className="figure shrink-0 text-charcoal-600">+{f.points}</span></li>)}
              </ul>
            )}
            {miss.length > 0 && (
              <div className="rounded-md bg-champagne-50 p-2 text-xs text-champagne-600">
                <p className="flex items-center gap-1 font-medium"><AlertTriangle size={12} /> Για επαλήθευση λείπουν:</p>
                <p>{miss.join(', ')}.</p>
              </div>
            )}
            {canEdit && !missing && (
              <div className="space-y-2 pt-2">
                <button type="button" disabled={pending} onClick={() => run('save')} className="btn-secondary w-full justify-center">{pending ? '…' : 'Αποθήκευση'}</button>
                <button type="button" disabled={pending || miss.length > 0} onClick={() => run('verify')} className="btn-primary w-full justify-center"><Check size={14} /> Επαλήθευση φακέλου</button>
                <button type="button" disabled={pending} onClick={() => { if (window.confirm('Απόρριψη του φακέλου; Η συναλλαγή δεν πρέπει να προχωρήσει.')) run('reject'); }} className="w-full text-center text-xs text-charcoal-600/70 hover:text-signal-danger"><X size={12} className="mr-1 inline" />Απόρριψη</button>
              </div>
            )}
            {msg && <p className={`text-xs ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</p>}
            <p className="pt-1 text-[11px] text-charcoal-600/60">Ανεβάστε αντίγραφα ταυτότητας, διεύθυνσης και πηγής χρημάτων στην καρτέλα «Έγγραφα».</p>
          </div>
        </div>
      </div>
    </div>
  );
}
