'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowUp, ArrowDown, Check } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import type { DepartmentSettings } from '@/lib/org-settings-shared';
import { Switch } from '@/components/admin/settings-ui';

const keyOf = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Settings → Τμήματα (όπως το Departments του demo): γραφεία/ομάδες (π.χ.
 * Λεμεσός, Πάφος) με σειρά και κατάσταση, και αίθουσες συναντήσεων που ανήκουν
 * σε τμήμα. Ο διακόπτης τα εμφανίζει ως φίλτρο στο ημερολόγιο.
 */
export function DepartmentsSettings({ initial, canEdit }: { initial: DepartmentSettings; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<DepartmentSettings>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [newDept, setNewDept] = useState('');
  const [newRoom, setNewRoom] = useState({ name: '', dept: initial.items[0]?.key ?? '' });
  const dis = !canEdit;
  const patch = (p: Partial<DepartmentSettings>) => { setV((x) => ({ ...x, ...p })); setMsg(null); };
  const save = (next = v) => start(async () => {
    const r = await saveOrgSlice('departments', next);
    setMsg(r.ok ? { ok: true, text: 'Αποθηκεύτηκε.' } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  });
  const move = (i: number, d: -1 | 1) => { const a = [...v.items]; const j = i + d; if (!a[j]) return; [a[i], a[j]] = [a[j], a[i]]; patch({ items: a }); };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="font-display text-xl text-charcoal">Τμήματα</h3>
        <p className="text-sm text-charcoal-600/75">Γραφεία ή ομάδες της εταιρείας (π.χ. Λεμεσός, Πάφος, Μεταπωλήσεις). Ενεργοποιήστε τα για φίλτρο και χωριστή προβολή στο ημερολόγιο.</p>
        <div className="panel space-y-4 p-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-stone-line p-4">
            <div><p className="font-medium text-charcoal">Τμήματα στο ημερολόγιο</p><p className="text-sm text-charcoal-600/70">Προσθέτει επιλογή τμήματος στις συναντήσεις, φίλτρο και προβολή ανά τμήμα.</p></div>
            <Switch checked={v.showOnCalendar} disabled={dis || v.items.length === 0} label="Τμήματα στο ημερολόγιο" onChange={(x) => { const next = { ...v, showOnCalendar: x }; setV(next); save(next); }} />
          </div>
          {canEdit && (
            <div className="flex flex-wrap justify-end gap-2">
              <input className="input max-w-xs" placeholder="Όνομα τμήματος" value={newDept} onChange={(e) => setNewDept(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newDept.trim()) { patch({ items: [...v.items, { key: keyOf('d'), name: newDept.trim(), active: true }] }); setNewDept(''); } }} />
              <button type="button" disabled={!newDept.trim()} onClick={() => { patch({ items: [...v.items, { key: keyOf('d'), name: newDept.trim(), active: true }] }); setNewDept(''); }} className="btn-primary"><Plus size={15} /> Νέο τμήμα</button>
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-stone-line">
            <div className="grid grid-cols-[1fr_90px_110px_80px] gap-2 bg-stone/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/80">
              <span>Όνομα</span><span>Σειρά</span><span>Κατάσταση</span><span className="text-right">Ενέργειες</span>
            </div>
            {v.items.length === 0 && <p className="px-4 py-4 text-center text-sm text-charcoal-600/70">Δεν υπάρχουν τμήματα ακόμα. Φτιάξτε το πρώτο για να οργανώσετε το ημερολόγιο.</p>}
            {v.items.map((d, i) => (
              <div key={d.key} className="grid grid-cols-[1fr_90px_110px_80px] items-center gap-2 border-t border-stone-line px-4 py-2">
                <input className="input py-1 text-sm" disabled={dis} value={d.name} onChange={(e) => patch({ items: v.items.map((x) => (x.key === d.key ? { ...x, name: e.target.value } : x)) })} />
                <span className="flex text-charcoal-600/60">
                  <button type="button" disabled={dis || i === 0} onClick={() => move(i, -1)} className="btn-ghost px-1 disabled:opacity-20" aria-label="Πάνω"><ArrowUp size={14} /></button>
                  <button type="button" disabled={dis || i === v.items.length - 1} onClick={() => move(i, 1)} className="btn-ghost px-1 disabled:opacity-20" aria-label="Κάτω"><ArrowDown size={14} /></button>
                </span>
                <span className="flex items-center gap-2 text-xs text-charcoal-600"><Switch checked={d.active} disabled={dis} label="Ενεργό" onChange={(x) => patch({ items: v.items.map((y) => (y.key === d.key ? { ...y, active: x } : y)) })} />{d.active ? 'Ενεργό' : 'Ανενεργό'}</span>
                <span className="text-right">{canEdit && <button type="button" onClick={() => patch({ items: v.items.filter((x) => x.key !== d.key), rooms: v.rooms.filter((r) => r.dept !== d.key) })} className="text-charcoal-600/50 hover:text-signal-danger" aria-label="Διαγραφή"><Trash2 size={15} /></button>}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-xl text-charcoal">Αίθουσες</h3>
        <p className="text-sm text-charcoal-600/75">Οι αίθουσες ανήκουν σε τμήμα. Το προσωπικό διαλέγει αίθουσα όταν κλείνει συνάντηση.</p>
        <div className="panel space-y-4 p-5">
          {v.items.length === 0 ? <p className="text-charcoal-600/80">Φτιάξτε πρώτα ένα τμήμα.</p> : canEdit && (
            <div className="flex flex-wrap gap-2">
              <input className="input max-w-xs" placeholder="Όνομα αίθουσας" value={newRoom.name} onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })} />
              <select className="input w-auto" value={newRoom.dept || v.items[0]?.key} onChange={(e) => setNewRoom({ ...newRoom, dept: e.target.value })}>
                {v.items.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
              </select>
              <button type="button" disabled={!newRoom.name.trim()} onClick={() => { patch({ rooms: [...v.rooms, { key: keyOf('r'), name: newRoom.name.trim(), dept: newRoom.dept || v.items[0].key }] }); setNewRoom({ ...newRoom, name: '' }); }} className="btn-secondary"><Plus size={15} /> Αίθουσα</button>
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-stone-line">
            <div className="grid grid-cols-[1fr_1fr_40px] gap-2 bg-stone/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/80"><span>Όνομα</span><span>Τμήμα</span><span /></div>
            {v.rooms.length === 0 && <p className="px-4 py-4 text-center text-sm text-charcoal-600/70">Δεν υπάρχουν αίθουσες. Προσθέστε μία σε ένα τμήμα.</p>}
            {v.rooms.map((r) => (
              <div key={r.key} className="grid grid-cols-[1fr_1fr_40px] items-center gap-2 border-t border-stone-line px-4 py-2 text-sm">
                <input className="input py-1 text-sm" disabled={dis} value={r.name} onChange={(e) => patch({ rooms: v.rooms.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)) })} />
                <select className="input py-1 text-sm" disabled={dis} value={r.dept} onChange={(e) => patch({ rooms: v.rooms.map((x) => (x.key === r.key ? { ...x, dept: e.target.value } : x)) })}>
                  {v.items.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
                </select>
                {canEdit && <button type="button" onClick={() => patch({ rooms: v.rooms.filter((x) => x.key !== r.key) })} className="text-charcoal-600/50 hover:text-signal-danger" aria-label="Διαγραφή"><Trash2 size={15} /></button>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {canEdit && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => save()} disabled={pending} className="btn-primary"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
