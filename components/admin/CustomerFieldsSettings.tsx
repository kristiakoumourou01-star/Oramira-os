'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { optInAllContacts, saveOrgSlice } from '@/app/actions/org-settings';
import { UndoButton } from '@/components/admin/UndoButton';
import { PUBLIC_FIELD_OPTIONS, STAFF_FIELD_OPTIONS, type FieldRules } from '@/lib/org-settings-shared';
import { Switch } from '@/components/admin/settings-ui';

/** Πάντα στη δημόσια φόρμα (χωρίς αυτά δεν μπορούμε να απαντήσουμε). */
const ALWAYS_SHOWN = ['name', 'phone', 'email'];

/**
 * Settings → Πεδία πελατών, στη μορφή του demo: ποια στοιχεία είναι
 * υποχρεωτικά όταν καταχωρεί το προσωπικό, ποια εμφανίζονται / είναι
 * υποχρεωτικά όταν γράφεται μόνος του ο πελάτης (κράτηση προβολής,
 * ιστοσελίδα), και προτιμήσεις marketing (συγκατάθεση).
 */
export function CustomerFieldsSettings({ initial, canEdit }: { initial: FieldRules; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<FieldRules>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [confirmAll, setConfirmAll] = useState(false);
  const [allMsg, setAllMsg] = useState<string | null>(null);
  const dis = !canEdit;
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  const toggle = (list: 'staff' | 'public' | 'publicShown', k: string, on: boolean) => {
    setMsg(null);
    setV((x) => {
      const next = { ...x, [list]: on ? [...new Set([...x[list], k])] : x[list].filter((y) => y !== k) };
      if (list === 'public' && on) next.publicShown = [...new Set([...next.publicShown, k])]; // υποχρεωτικό ⇒ στη φόρμα
      if (list === 'publicShown' && !on) next.public = next.public.filter((y) => y !== k);
      return next;
    });
  };
  const save = (next = v) => start(async () => {
    const r = await saveOrgSlice('fields', next);
    setMsg(r.ok ? { ok: true, text: 'Αποθηκεύτηκε.' } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  });
  const head = 'grid items-center gap-2 bg-stone/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/80';
  const row = 'grid items-center gap-2 border-t border-stone-line px-4 py-3 text-sm text-charcoal';

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="font-display text-xl text-charcoal">Πεδία πελατών</h3>
        <p className="text-sm text-charcoal-600/75">Διαλέξτε ποια στοιχεία πρέπει να συμπληρώνονται — χωριστά για το προσωπικό και για τους πελάτες που γράφονται μόνοι τους.</p>
        <div className="panel space-y-6 p-5">
          <div className="space-y-2">
            <p className="font-medium text-charcoal">Όταν το προσωπικό καταχωρεί πελάτη</p>
            <p className="text-sm text-charcoal-600/75">Ισχύει στη φόρμα «Νέο lead» / νέα επαφή. Με τον διακόπτη το πεδίο γίνεται υποχρεωτικό — η φόρμα δεν αποθηκεύεται όσο είναι κενό. Το όνομα και το email ή τηλέφωνο χρειάζονται πάντα και δεν εμφανίζονται εδώ.</p>
            <div className="overflow-hidden rounded-xl border border-stone-line">
              <div className={`${head} grid-cols-[1fr_110px]`}><span>Όταν το προσωπικό καταχωρεί πελάτη</span><span className="text-center">Υποχρεωτικό</span></div>
              {STAFF_FIELD_OPTIONS.map((o) => (
                <div key={o.key} className={`${row} grid-cols-[1fr_110px]`}>
                  <span>{o.label}</span>
                  <span className="flex justify-center"><Switch checked={v.staff.includes(o.key)} disabled={dis} label={`${o.label} υποχρεωτικό`} onChange={(x) => toggle('staff', o.key, x)} /></span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-charcoal">Όταν ο πελάτης γράφεται μόνος του</p>
            <p className="text-sm text-charcoal-600/75">Ισχύει στη σελίδα κράτησης προβολής και στις φόρμες της ιστοσελίδας. «Στη φόρμα» = το πεδίο εμφανίζεται στον πελάτη· «Υποχρεωτικό» = η αποστολή δεν γίνεται όσο είναι κενό.</p>
            <div className="overflow-hidden rounded-xl border border-stone-line">
              <div className={`${head} grid-cols-[1fr_100px_120px]`}><span>Όταν ο πελάτης γράφεται μόνος του</span><span className="text-center">Στη φόρμα</span><span className="text-center">Υποχρεωτικό</span></div>
              {PUBLIC_FIELD_OPTIONS.map((o) => {
                const always = ALWAYS_SHOWN.includes(o.key);
                return (
                  <div key={o.key} className={`${row} grid-cols-[1fr_100px_120px]`}>
                    <span>{o.label}{always && <span className="ml-2 text-xs text-charcoal-600/50">πάντα στη φόρμα</span>}</span>
                    <span className="flex justify-center"><Switch checked={always || v.publicShown.includes(o.key)} disabled={dis || always} label={`${o.label} στη φόρμα`} onChange={(x) => toggle('publicShown', o.key, x)} /></span>
                    <span className="flex justify-center"><Switch checked={v.public.includes(o.key)} disabled={dis} label={`${o.label} υποχρεωτικό`} onChange={(x) => toggle('public', o.key, x)} /></span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-charcoal-600/60">Η εισαγωγή από CSV εξαιρείται και από τα δύο: ένα αρχείο από άλλο σύστημα δεν μπορεί να ακολουθεί τους δικούς σας κανόνες.</p>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => save()} disabled={pending || !dirty} className="btn-primary disabled:opacity-50"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
              {msg && <span className={`text-sm ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</span>}
              {msg?.ok && <UndoButton slice="fields" />}
            </div>
          )}
        </div>
      </section>

      <section className="panel space-y-3 p-5">
        <div>
          <p className="font-medium text-charcoal">Προτιμήσεις marketing</p>
          <p className="text-sm text-charcoal-600/75">Τα μηνύματα SMS, email και push χρειάζονται τη συγκατάθεση του πελάτη. Ενεργοποιήστε τα μόνο αν η φόρμα εγγραφής ή το συμβόλαιό σας τη ζητά.</p>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-stone-line p-4">
          <span className="text-sm text-charcoal">Οι νέοι πελάτες ξεκινούν με συγκατάθεση για SMS, email και push</span>
          <Switch checked={v.optInDefault} disabled={dis || pending} label="Συγκατάθεση για νέους πελάτες"
            onChange={(x) => { const next = { ...v, optInDefault: x }; setV(next); save(next); }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-line p-4">
          <span className="text-sm text-charcoal-600">Ενεργοποίηση SMS, email και push για κάθε υπάρχοντα πελάτη.</span>
          {!confirmAll
            ? <button type="button" disabled={dis} onClick={() => { setConfirmAll(true); setAllMsg(null); }} className="btn-secondary text-sm">Ενεργοποίηση για όλους</button>
            : <span className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-signal-danger">Σίγουρα; Αλλάζει όλους τους πελάτες χωρίς συγκατάθεση.</span>
                <button type="button" disabled={pending} onClick={() => start(async () => { const r = await optInAllContacts(); setConfirmAll(false); setAllMsg(r.ok ? `Ενεργοποιήθηκε σε ${r.updated} πελάτες.` : r.error); })} className="btn-primary text-sm">Ναι, για όλους</button>
                <button type="button" onClick={() => setConfirmAll(false)} className="btn-ghost text-sm">Άκυρο</button>
              </span>}
        </div>
        {allMsg && <p className="text-sm text-forest">{allMsg}</p>}
      </section>
    </div>
  );
}
