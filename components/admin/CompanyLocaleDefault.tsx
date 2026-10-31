'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { UndoButton } from '@/components/admin/UndoButton';
import { LANGS, NUM_FORMATS, type LocalePrefs } from '@/lib/locale-shared';

/** Settings → Εμφάνιση: the language and number format new users start with. */
export function CompanyLocaleDefault({ initial, canEdit }: { initial: LocalePrefs; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<LocalePrefs>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await saveOrgSlice('locale', v);
    if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: r.error });
  });
  return (
    <div className="panel space-y-3 p-5">
      <div>
        <h4>Γλώσσα και αριθμοί (προεπιλογή εταιρείας)</h4>
        <p className="text-xs text-charcoal-600/60">Με αυτά ξεκινά κάθε χρήστης. Ο καθένας αλλάζει τα δικά του από το εικονίδιο 🌐 πάνω δεξιά, και η επιλογή του τον ακολουθεί σε κάθε συσκευή. Ισχύει από την επόμενη σύνδεση.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="eyebrow mb-1 block">Γλώσσα</span>
          <select className="input" disabled={!canEdit} value={v.lang} onChange={(e) => { setV({ ...v, lang: e.target.value as LocalePrefs['lang'] }); setMsg(null); }}>
            {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
        <label className="block"><span className="eyebrow mb-1 block">Μορφή αριθμών</span>
          <select className="input font-mono" disabled={!canEdit} value={v.num} onChange={(e) => { setV({ ...v, num: e.target.value as LocalePrefs['num'] }); setMsg(null); }}>
            {NUM_FORMATS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
        </label>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={pending} className="btn-primary"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
          {msg?.ok && <UndoButton slice="locale" />}
        </div>
      )}
    </div>
  );
}
