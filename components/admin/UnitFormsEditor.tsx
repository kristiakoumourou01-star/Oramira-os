'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Target, ChevronDown, ChevronRight } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { UndoButton } from '@/components/admin/UndoButton';
import {
  DEFAULT_UNIT_FORMS, UNIT_FIELD_TYPES, UNIT_SECTIONS, keyFrom,
  type UnitField, type UnitFormsSettings, type UnitType,
} from '@/lib/unit-forms-shared';

const Lbl = ({ children }: { children: React.ReactNode }) => <span className="eyebrow mb-1 block">{children}</span>;

function Options({ items, onChange, disabled }: { items: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
  const [d, setD] = useState('');
  const add = () => { const t = d.trim(); if (t && !items.includes(t)) onChange([...items, t]); setD(''); };
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {items.map((o) => <span key={o} className="badge-neutral inline-flex items-center gap-1">{o}{!disabled && <button type="button" onClick={() => onChange(items.filter((x) => x !== o))} className="text-charcoal-600/50 hover:text-signal-danger">×</button>}</span>)}
      </div>
      {!disabled && <div className="flex gap-1"><input className="input py-1 text-sm" value={d} placeholder="Νέα επιλογή" onChange={(e) => setD(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} /><button type="button" onClick={add} className="btn-secondary px-2 py-1 text-xs"><Plus size={12} /></button></div>}
    </div>
  );
}

/** Settings → Φόρμες μονάδων: unit types and your own fields per type. */
export function UnitFormsEditor({ initial, canEdit }: { initial: UnitFormsSettings; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<UnitFormsSettings>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const patch = (p: Partial<UnitFormsSettings>) => { setV((x) => ({ ...x, ...p })); setMsg(null); };
  const setType = (i: number, p: Partial<UnitType>) => patch({ types: v.types.map((t, idx) => (idx === i ? { ...t, ...p } : t)) });
  const setField = (i: number, p: Partial<UnitField>) => patch({ fields: v.fields.map((f, idx) => (idx === i ? { ...f, ...p } : f)) });
  const move = <T,>(arr: T[], i: number, d: -1 | 1): T[] => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a; };
  const addField = () => {
    const key = keyFrom('new field', v.fields.map((f) => f.key));
    patch({ fields: [...v.fields, { key, el: 'Νέο πεδίο', en: 'New field', type: 'text', options: [], suffix: '', section: 'features', types: [], visibleToClient: true, useInMatching: false, required: false }] });
    setOpen(key);
  };
  const save = () => start(async () => {
    const r = await saveOrgSlice('unitForms', v);
    if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: r.error });
  });

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-5">
        <div>
          <h4>Τύποι μονάδων</h4>
          <p className="text-xs text-charcoal-600/60">Ελληνική και αγγλική ονομασία. Ο τύπος κάθε μονάδας ορίζει ποια πεδία εμφανίζονται στη φόρμα της.</p>
        </div>
        {v.types.map((t, i) => (
          <div key={t.key} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <input className="input" disabled={!canEdit} value={t.el} placeholder="Ελληνικά" onChange={(e) => setType(i, { el: e.target.value })} />
            <input className="input" disabled={!canEdit} value={t.en} placeholder="English" onChange={(e) => setType(i, { en: e.target.value })} />
            {canEdit ? (
              <div className="flex gap-1">
                <button type="button" onClick={() => patch({ types: move(v.types, i, -1) })} className="text-charcoal-600/50 hover:text-forest"><ArrowUp size={14} /></button>
                <button type="button" onClick={() => patch({ types: move(v.types, i, 1) })} className="text-charcoal-600/50 hover:text-forest"><ArrowDown size={14} /></button>
                <button type="button" onClick={() => patch({ types: v.types.filter((_, idx) => idx !== i), fields: v.fields.map((f) => ({ ...f, types: f.types.filter((k) => k !== t.key) })) })} className="text-charcoal-600/50 hover:text-signal-danger"><Trash2 size={14} /></button>
              </div>
            ) : <span />}
          </div>
        ))}
        {canEdit && <button type="button" onClick={() => patch({ types: [...v.types, { key: keyFrom('type', v.types.map((t) => t.key)), el: 'Νέος τύπος', en: 'New type' }] })} className="btn-secondary px-3 py-1.5 text-xs"><Plus size={13} /> Τύπος</button>}
      </div>

      <div className="panel space-y-2 p-5">
        <div>
          <h4>Πεδία</h4>
          <p className="text-xs text-charcoal-600/60">
            <Eye size={11} className="inline" /> = το βλέπει ο αγοραστής στο portal του · <EyeOff size={11} className="inline" /> = μόνο το προσωπικό · <Target size={11} className="inline" /> = μετρά στο matching (ο αγοραστής δηλώνει τι θέλει στο lead του).
          </p>
        </div>
        {v.fields.map((f, i) => {
          const isOpen = open === f.key;
          return (
            <div key={f.key} className="rounded-md border border-stone-line">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => setOpen(isOpen ? null : f.key)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="truncate text-sm font-medium text-charcoal">{f.el}</span>
                  <span className="truncate text-xs text-charcoal-600/60">{f.en} · {UNIT_FIELD_TYPES.find((t) => t.value === f.type)?.label}{f.types.length ? ` · ${f.types.length} τύποι` : ''}</span>
                </button>
                <span title={f.visibleToClient ? 'Το βλέπει ο αγοραστής' : 'Μόνο προσωπικό'} className="text-charcoal-600/60">{f.visibleToClient ? <Eye size={13} /> : <EyeOff size={13} />}</span>
                {f.useInMatching && <span title="Matching" className="text-forest"><Target size={13} /></span>}
                {canEdit && (
                  <>
                    <button type="button" onClick={() => patch({ fields: move(v.fields, i, -1) })} className="text-charcoal-600/50 hover:text-forest"><ArrowUp size={14} /></button>
                    <button type="button" onClick={() => patch({ fields: move(v.fields, i, 1) })} className="text-charcoal-600/50 hover:text-forest"><ArrowDown size={14} /></button>
                    <button type="button" onClick={() => { if (confirm(`Διαγραφή του πεδίου «${f.el}»; Οι τιμές που έχουν ήδη συμπληρωθεί κρατιούνται, αλλά δεν θα εμφανίζονται.`)) patch({ fields: v.fields.filter((_, idx) => idx !== i) }); }} className="text-charcoal-600/50 hover:text-signal-danger"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
              {isOpen && (
                <div className="space-y-3 border-t border-stone-line p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block"><Lbl>Ετικέτα (Ελληνικά)</Lbl><input className="input" disabled={!canEdit} value={f.el} onChange={(e) => setField(i, { el: e.target.value })} /></label>
                    <label className="block"><Lbl>Label (English)</Lbl><input className="input" disabled={!canEdit} value={f.en} onChange={(e) => setField(i, { en: e.target.value })} /></label>
                    <label className="block"><Lbl>Είδος</Lbl>
                      <select className="input" disabled={!canEdit} value={f.type} onChange={(e) => setField(i, { type: e.target.value as UnitField['type'] })}>
                        {UNIT_FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </label>
                    <label className="block"><Lbl>Ενότητα φόρμας</Lbl>
                      <select className="input" disabled={!canEdit} value={f.section} onChange={(e) => setField(i, { section: e.target.value as UnitField['section'] })}>
                        {UNIT_SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.el}</option>)}
                      </select>
                    </label>
                    {f.type === 'number' && <label className="block"><Lbl>Μονάδα μέτρησης</Lbl><input className="input" disabled={!canEdit} value={f.suffix} placeholder="m, m², €, %" onChange={(e) => setField(i, { suffix: e.target.value })} /></label>}
                  </div>
                  {(f.type === 'choice' || f.type === 'multi') && <div><Lbl>Επιλογές</Lbl><Options items={f.options} disabled={!canEdit} onChange={(options) => setField(i, { options })} /></div>}
                  <div>
                    <Lbl>Σε ποιους τύπους (κανένας = σε όλους)</Lbl>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {v.types.map((t) => (
                        <label key={t.key} className="flex items-center gap-1.5 text-sm"><input type="checkbox" disabled={!canEdit} checked={f.types.includes(t.key)} onChange={() => setField(i, { types: f.types.includes(t.key) ? f.types.filter((k) => k !== t.key) : [...f.types, t.key] })} /> {t.el}</label>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <label className="flex items-center gap-1.5"><input type="checkbox" disabled={!canEdit} checked={f.visibleToClient} onChange={() => setField(i, { visibleToClient: !f.visibleToClient })} /> Το βλέπει ο αγοραστής</label>
                    <label className={`flex items-center gap-1.5 ${f.type === 'text' || f.type === 'date' ? 'opacity-40' : ''}`} title={f.type === 'text' || f.type === 'date' ? 'Για matching χρειάζεται Ναι/Όχι, αριθμός ή επιλογές' : ''}><input type="checkbox" disabled={!canEdit || f.type === 'text' || f.type === 'date'} checked={f.useInMatching} onChange={() => setField(i, { useInMatching: !f.useInMatching })} /> Χρήση στο matching</label>
                    <label className="flex items-center gap-1.5"><input type="checkbox" disabled={!canEdit} checked={f.required} onChange={() => setField(i, { required: !f.required })} /> Υποχρεωτικό</label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {canEdit && <button type="button" onClick={addField} className="btn-secondary px-3 py-1.5 text-xs"><Plus size={13} /> Πεδίο</button>}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={pending} className="btn-primary"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          <button type="button" className="btn-secondary" onClick={() => { if (confirm('Επαναφορά τύπων και πεδίων στα αρχικά; Οι τιμές που έχουν συμπληρωθεί σε μονάδες κρατιούνται.')) patch(DEFAULT_UNIT_FORMS); }}>Επαναφορά στα αρχικά</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
          {msg?.ok && <UndoButton slice="unitForms" />}
        </div>
      )}
    </div>
  );
}
