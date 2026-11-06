'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Tag, Check } from 'lucide-react';
import { saveContactMeta } from '@/app/actions/contact-meta';
import type { ContactMeta, FieldValue } from '@/lib/contact-meta-shared';
import type { TagsSettings } from '@/lib/org-settings-shared';

function Chips({ all, selected, onToggle, disabled }: { all: string[]; selected: string[]; onToggle: (v: string) => void; disabled: boolean }) {
  if (all.length === 0) return <p className="text-xs text-charcoal-600/60">Δεν έχουν οριστεί. Ο admin τα προσθέτει στο Settings → Tags, ομάδες & πεδία.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((t) => {
        const on = selected.includes(t);
        return (
          <button key={t} type="button" disabled={disabled} onClick={() => onToggle(t)}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${on ? 'border-forest bg-forest text-stone-100' : 'border-stone-line bg-white text-charcoal-600 hover:border-forest/40'}`}>
            {on && <Check size={11} />}{t}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Tags, groups and the company's own fields for one contact — on the lead and
 * contact pages. Definitions come from Settings; values save to the contact.
 */
export function ContactMetaPanel({ contactId, initial, defs, canEdit }: { contactId: string; initial: ContactMeta; defs: TagsSettings; canEdit: boolean }) {
  const [m, setM] = useState<ContactMeta>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const toggle = (k: 'tags' | 'groups', v: string) => {
    setM((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
    setDirty(true); setMsg(null);
  };
  const setField = (key: string, v: FieldValue) => { setM((x) => ({ ...x, fields: { ...x.fields, [key]: v } })); setDirty(true); setMsg(null); };

  function save() {
    start(async () => {
      const res = await saveContactMeta(contactId, m);
      if (res.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); setDirty(false); router.refresh(); }
      else setMsg({ ok: false, text: res.error });
    });
  }

  const disabled = !canEdit || pending;

  return (
    <div className="panel space-y-4 p-5">
      <h4 className="flex items-center gap-2"><Tag size={15} className="text-olive" strokeWidth={1.75} /> Tags, ομάδες & στοιχεία</h4>
      <div>
        <p className="eyebrow mb-1.5">Tags</p>
        <Chips all={defs.tags} selected={m.tags} onToggle={(v) => toggle('tags', v)} disabled={disabled} />
      </div>
      <div>
        <p className="eyebrow mb-1.5">Ομάδες</p>
        <Chips all={defs.groups} selected={m.groups} onToggle={(v) => toggle('groups', v)} disabled={disabled} />
      </div>
      {defs.fields.length > 0 && (
        <div className="space-y-2.5">
          {defs.fields.map((f) => {
            const v = m.fields[f.key] ?? null;
            const label = <span className="eyebrow mb-1 block">{f.name}{f.required && <span className="text-signal-danger"> *</span>}</span>;
            if (f.type === 'Yes / No') {
              return (
                <div key={f.key}>
                  {label}
                  <div className="flex gap-1.5">
                    {[{ v: true, l: 'Ναι' }, { v: false, l: 'Όχι' }, { v: null, l: '—' }].map((o) => (
                      <button key={String(o.v)} type="button" disabled={disabled} onClick={() => setField(f.key, o.v)}
                        className={`rounded-lg border px-3 py-1 text-xs ${v === o.v ? 'border-forest bg-forest/[0.07] text-forest' : 'border-stone-line text-charcoal-600'}`}>{o.l}</button>
                    ))}
                  </div>
                </div>
              );
            }
            if (f.type === 'Choice') {
              return (
                <label key={f.key} className="block">{label}
                  <select className="input py-1.5" disabled={disabled} value={typeof v === 'string' ? v : ''} onChange={(e) => setField(f.key, e.target.value || null)}>
                    <option value="">—</option>
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              );
            }
            return (
              <label key={f.key} className="block">{label}
                <input className="input py-1.5" disabled={disabled}
                  type={f.type === 'Number' ? 'number' : f.type === 'Date' ? 'date' : 'text'}
                  value={v === null || v === undefined ? '' : String(v)}
                  onChange={(e) => setField(f.key, e.target.value === '' ? null : e.target.value)} />
              </label>
            );
          })}
        </div>
      )}
      {canEdit && (
        <div className="flex items-center gap-3">
          <button type="button" className="btn-primary px-4 py-1.5 text-xs" disabled={pending || !dirty} onClick={save}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          {msg && <span className={`text-xs ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
