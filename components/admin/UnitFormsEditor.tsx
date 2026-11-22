'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDragSort, moveItem } from '@/components/ui/useDragSort';
import { Check, Plus, Trash2, GripVertical, Eye, EyeOff, Target, ChevronDown, ChevronRight } from 'lucide-react';
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
  const dndT = useDragSort((from, to) => patch({ types: moveItem(v.types, from, to) }), canEdit, 'types');
  const dndF = useDragSort((from, to) => patch({ fields: moveItem(v.fields, from, to) }), canEdit, 'fields');
  const grip = canEdit ? <span className="cursor-grab text-charcoal-600/40 active:cursor-grabbing" title="Σύρετε για αλλαγή σειράς"><GripVertical size={15} /></span> : null;
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
      <div className="panel p-5">
        <h4>Πώς λειτουργεί</h4>
        <p className="mt-1 text-sm text-charcoal-600">Εδώ ορίζετε τι συμπληρώνετε όταν φτιάχνετε ή αλλάζετε μια μονάδα (διαμέρισμα, βίλα, οικόπεδο…) στα Έργα.</p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            ['1', 'Τύποι μονάδων', 'Τα είδη ακινήτων που πουλάτε, στα ελληνικά και στα αγγλικά.'],
            ['2', 'Πεδία', 'Οι ερωτήσεις της φόρμας (π.χ. εμβαδόν, parking) και σε ποιους τύπους εμφανίζονται.'],
            ['3', 'Υδατογράφημα', 'Το logo που μπαίνει αυτόματα πάνω στις φωτογραφίες των μονάδων.'],
          ].map(([n, title, text]) => (
            <li key={n} className="flex gap-2.5 rounded-xl border border-stone-line p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-semibold text-white">{n}</span>
              <span className="min-w-0"><span className="block text-sm font-medium text-charcoal">{title}</span><span className="block text-xs text-charcoal-600">{text}</span></span>
            </li>
          ))}
        </ol>
      </div>

      <div className="panel space-y-3 p-5">
        <div>
          <h4>1. Τύποι μονάδων</h4>
          <p className="text-xs text-charcoal-600">Κάθε μονάδα έχει έναν τύπο, και ο τύπος αποφασίζει ποια πεδία βλέπετε στη φόρμα της. Σύρετε για να αλλάξετε σειρά.</p>
        </div>
        <div className="hidden grid-cols-[auto_1fr_1fr_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70 sm:grid">
          <span className="w-[15px]" /><span>Ελληνικά</span><span>English</span><span className="w-[14px]" />
        </div>
        {v.types.map((t, i) => (
          <div key={t.key} {...dndT.item(i)} className={`grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 ${dndT.cls(i)}`}>
            {grip ?? <span />}
            <input className="input" disabled={!canEdit} value={t.el} placeholder="Ελληνικά" onChange={(e) => setType(i, { el: e.target.value })} />
            <input className="input" disabled={!canEdit} value={t.en} placeholder="English" onChange={(e) => setType(i, { en: e.target.value })} />
            {canEdit ? (
              <div className="flex gap-1">
                <button type="button" onClick={() => patch({ types: v.types.filter((_, idx) => idx !== i), fields: v.fields.map((f) => ({ ...f, types: f.types.filter((k) => k !== t.key) })) })} className="text-charcoal-600/50 hover:text-signal-danger"><Trash2 size={14} /></button>
              </div>
            ) : <span />}
          </div>
        ))}
        {canEdit && <button type="button" onClick={() => patch({ types: [...v.types, { key: keyFrom('type', v.types.map((t) => t.key)), el: 'Νέος τύπος', en: 'New type' }] })} className="btn-secondary px-3 py-1.5 text-xs"><Plus size={13} /> Τύπος</button>}
      </div>

      <div className="panel space-y-2 p-5">
        <div>
          <h4>2. Πεδία της φόρμας</h4>
          <p className="text-xs text-charcoal-600">Πατήστε ένα πεδίο για να το αλλάξετε. Οι ετικέτες δείχνουν με μια ματιά:</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-charcoal-600">
            <li className="flex items-center gap-1.5"><span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] text-charcoal">Ορατό στον πελάτη</span><span>το βλέπει ο αγοραστής στο portal του</span></li>
            <li className="flex items-center gap-1.5"><span className="rounded-full bg-stone px-2 py-0.5 text-[11px] text-charcoal">Μόνο προσωπικό</span><span>το βλέπει μόνο η ομάδα</span></li>
            <li className="flex items-center gap-1.5"><span className="rounded-full border border-forest/40 px-2 py-0.5 text-[11px] text-charcoal">Matching</span><span>χρησιμοποιείται για να βρει ακίνητα που ταιριάζουν στο lead</span></li>
          </ul>
        </div>
        {UNIT_SECTIONS.map((sec) => {
          const rows = v.fields.map((f, i) => ({ f, i })).filter(({ f }) => f.section === sec.key);
          if (!rows.length) return null;
          return (
            <div key={sec.key} className="space-y-2 pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70">{sec.el} <span className="font-normal normal-case">· {rows.length}</span></p>
        {rows.map(({ f, i }) => {
          const isOpen = open === f.key;
          return (
            <div key={f.key} {...dndF.item(i)} className={`rounded-md border border-stone-line ${dndF.cls(i)}`}>
              <div className="flex items-center gap-2 px-3 py-2">
                {grip}
                <button type="button" onClick={() => setOpen(isOpen ? null : f.key)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="truncate text-sm font-medium text-charcoal">{f.el}</span>
                  <span className="hidden truncate text-xs text-charcoal-600/70 sm:inline">{UNIT_FIELD_TYPES.find((t) => t.value === f.type)?.label}</span>
                </button>
                <span className="hidden shrink-0 text-[11px] text-charcoal-600 md:inline">{f.types.length ? <><span>Σε</span> {f.types.length} <span>τύπους</span></> : <span>Σε όλους τους τύπους</span>}</span>
                <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-charcoal sm:inline-flex ${f.visibleToClient ? 'bg-forest/10' : 'bg-stone'}`}>{f.visibleToClient ? <Eye size={11} /> : <EyeOff size={11} />}<span>{f.visibleToClient ? 'Ορατό στον πελάτη' : 'Μόνο προσωπικό'}</span></span>
                {f.useInMatching && <span className="hidden shrink-0 items-center gap-1 rounded-full border border-forest/40 px-2 py-0.5 text-[11px] text-charcoal sm:inline-flex"><Target size={11} /><span>Matching</span></span>}
                {f.required && <span className="hidden shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 lg:inline">Υποχρεωτικό</span>}
                {canEdit && (
                  <>
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
