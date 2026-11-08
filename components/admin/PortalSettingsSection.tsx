'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { UndoButton } from '@/components/admin/UndoButton';
import { DEFAULT_PORTAL, type PortalSettings } from '@/lib/org-settings-shared';
import { PhoneInput } from '@/components/ui/PhoneInput';

const Lbl = ({ children }: { children: React.ReactNode }) => <span className="eyebrow mb-1 block">{children}</span>;

/** Settings → Portals πελατών: terms of use, FAQ and contact details shown to buyers, owners, investors and contractors. */
export function PortalSettingsSection({ initial, canEdit }: { initial: PortalSettings; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<PortalSettings>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const patch = (p: Partial<PortalSettings>) => { setV((x) => ({ ...x, ...p })); setMsg(null); };
  const setFaq = (i: number, p: Partial<PortalSettings['faq'][number]>) => patch({ faq: v.faq.map((f, idx) => (idx === i ? { ...f, ...p } : f)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= v.faq.length) return;
    const f = [...v.faq]; [f[i], f[j]] = [f[j], f[i]]; patch({ faq: f });
  };
  const save = () => start(async () => {
    const r = await saveOrgSlice('portal', v);
    if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: r.error });
  });

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-5">
        <div>
          <h4>Επικοινωνία</h4>
          <p className="text-xs text-charcoal-600/60">Εμφανίζονται στη σελίδα «Help» κάθε portal.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><Lbl>Email υποστήριξης</Lbl><input className="input" type="email" disabled={!canEdit} value={v.helpEmail} onChange={(e) => patch({ helpEmail: e.target.value })} placeholder="support@oramiraltd.com" /></label>
          <label className="block"><Lbl>Τηλέφωνο</Lbl><PhoneInput disabled={!canEdit} value={v.helpPhone} onChange={(x) => patch({ helpPhone: x })} /></label>
        </div>
      </div>

      <div className="panel space-y-3 p-5">
        <div>
          <h4>Συχνές ερωτήσεις (FAQ)</h4>
          <p className="text-xs text-charcoal-600/60">Ίδιες για όλα τα portals. Η σειρά εδώ είναι η σειρά που βλέπουν.</p>
        </div>
        {v.faq.map((f, i) => (
          <div key={i} className="space-y-2 rounded-md border border-stone-line p-3">
            <div className="flex items-center gap-2">
              <input className="input flex-1" disabled={!canEdit} value={f.q} placeholder="Ερώτηση" onChange={(e) => setFaq(i, { q: e.target.value })} />
              {canEdit && (
                <>
                  <button type="button" title="Πάνω" onClick={() => move(i, -1)} className="text-charcoal-600/50 hover:text-forest"><ArrowUp size={14} /></button>
                  <button type="button" title="Κάτω" onClick={() => move(i, 1)} className="text-charcoal-600/50 hover:text-forest"><ArrowDown size={14} /></button>
                  <button type="button" title="Αφαίρεση" onClick={() => patch({ faq: v.faq.filter((_, idx) => idx !== i) })} className="text-charcoal-600/50 hover:text-signal-danger"><Trash2 size={14} /></button>
                </>
              )}
            </div>
            <textarea className="input min-h-[60px]" disabled={!canEdit} value={f.a} placeholder="Απάντηση" onChange={(e) => setFaq(i, { a: e.target.value })} />
          </div>
        ))}
        {canEdit && <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => patch({ faq: [...v.faq, { q: '', a: '' }] })}><Plus size={13} /> Ερώτηση</button>}
      </div>

      <div className="panel space-y-2 p-5">
        <div>
          <h4>Όροι χρήσης</h4>
          <p className="text-xs text-charcoal-600/60">Το κείμενο των όρων χρήσης των portals. Κενό = δεν εμφανίζεται. Καλό είναι να το δει ο δικηγόρος σας.</p>
        </div>
        <textarea className="input min-h-[220px] text-sm" disabled={!canEdit} value={v.termsText} onChange={(e) => patch({ termsText: e.target.value })} placeholder="1. Γενικά…" />
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={pending} className="btn-primary"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          <button type="button" className="btn-secondary" onClick={() => { if (confirm('Επαναφορά των ερωτήσεων και των όρων στα αρχικά;')) patch(DEFAULT_PORTAL); }}>Επαναφορά στα αρχικά</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
          {msg?.ok && <UndoButton slice="portal" />}
        </div>
      )}
    </div>
  );
}
