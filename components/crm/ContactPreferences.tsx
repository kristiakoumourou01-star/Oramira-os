'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Check } from 'lucide-react';
import { savePreferences } from '@/app/actions/contact-card';
import { BEST_TIME, CHANNELS, LANGUAGES } from '@/lib/kyc-shared';

export interface Prefs { language: string | null; channel: string | null; bestTime: string | null; bestTimeNote: string | null }

/** Πώς θέλει να επικοινωνούμε: γλώσσα, κανάλι, ώρα. */
export function ContactPreferences({ contactId, initial, canEdit }: { contactId: string; initial: Prefs; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<Prefs>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const set = (p: Partial<Prefs>) => { setV((x) => ({ ...x, ...p })); setMsg(null); };
  const save = () => start(async () => { const r = await savePreferences(contactId, v); if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: r.error }); });
  const sel = (value: string | null, list: { v: string; l: string }[], on: (x: string | null) => void, empty: string) => (
    <select className="input py-1.5 text-sm" disabled={!canEdit} value={value ?? ''} onChange={(e) => on(e.target.value || null)}>
      <option value="">{empty}</option>
      {list.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
  return (
    <div className="panel space-y-3 p-5">
      <h4 className="flex items-center gap-2"><MessageCircle size={15} /> Επικοινωνία</h4>
      <label className="block"><span className="eyebrow mb-1 block">Γλώσσα</span>{sel(v.language, LANGUAGES, (x) => set({ language: x }), '—')}</label>
      <label className="block"><span className="eyebrow mb-1 block">Προτιμώμενο κανάλι</span>{sel(v.channel, CHANNELS, (x) => set({ channel: x }), '—')}</label>
      <label className="block"><span className="eyebrow mb-1 block">Καλύτερη ώρα</span>{sel(v.bestTime, BEST_TIME, (x) => set({ bestTime: x }), '—')}</label>
      <input className="input py-1.5 text-sm" disabled={!canEdit} maxLength={200} placeholder="Σημείωση (π.χ. «όχι Παρασκευή», «ώρα Μόσχας»)" value={v.bestTimeNote ?? ''} onChange={(e) => set({ bestTimeNote: e.target.value })} />
      {canEdit && dirty && <button type="button" disabled={pending} onClick={save} className="btn-primary w-full justify-center"><Check size={14} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>}
      {msg && <p className={`text-xs ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</p>}
    </div>
  );
}
