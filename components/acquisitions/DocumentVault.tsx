'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { addParcelDocument, deleteParcelDocument } from '@/app/actions/acquisitions';

export interface ParcelDoc { id: string; category: string; name: string; url: string | null; note: string | null; created_at: string }

const CATEGORIES: { v: string; label: string }[] = [
  { v: 'title_deed', label: 'Title deeds' }, { v: 'survey', label: 'Surveys' }, { v: 'planning', label: 'Planning' },
  { v: 'valuation', label: 'Valuations' }, { v: 'photo', label: 'Photos' }, { v: 'email', label: 'Emails' },
  { v: 'legal', label: 'Legal' }, { v: 'agreement', label: 'Agreements' }, { v: 'other', label: 'Other' },
];

/** Document vault — a per-parcel registry organised by category. Records links /
 *  references (name + optional URL); file bytes can be attached later. */
export function DocumentVault({ parcelId, docs }: { parcelId: string; docs: ParcelDoc[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [f, setF] = useState({ category: 'title_deed', name: '', url: '', note: '' });

  const save = () => { setPending(true); start(async () => { await addParcelDocument({ parcelId, category: f.category, name: f.name, url: f.url || undefined, note: f.note || undefined }); setF({ category: 'title_deed', name: '', url: '', note: '' }); setAdding(false); setPending(false); router.refresh(); }); };
  const remove = (id: string) => start(async () => { await deleteParcelDocument(id, parcelId); router.refresh(); });
  const inp = 'w-full rounded-lg border border-stone-line bg-white px-2.5 py-1.5 text-sm focus-visible:border-forest focus-visible:outline-none';

  return (
    <div className="panel p-6">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-charcoal"><FileText size={16} className="text-forest" strokeWidth={1.85} /> Document vault <span className="text-xs font-normal text-charcoal-600/50">· {docs.length}</span></h4>
        <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-1 rounded-lg bg-forest px-2.5 py-1.5 text-xs font-medium text-white hover:bg-forest/90"><Plus size={13} /> Add</button>
      </div>

      {adding && (
        <div className="mb-4 space-y-2 rounded-xl bg-sand-100/50 p-3">
          <div className="flex gap-2">
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={inp}>{CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</select>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Document name" className={inp} />
          </div>
          <input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="Link / storage URL (optional)" className={inp} />
          <div className="flex justify-end gap-2"><button onClick={() => setAdding(false)} className="rounded-lg border border-stone-line px-3 py-1.5 text-xs text-charcoal-600">Cancel</button><button onClick={save} disabled={pending || !f.name.trim()} className="flex items-center gap-1.5 rounded-lg bg-forest px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{pending ? <Loader2 size={13} className="animate-spin" /> : 'Save'}</button></div>
        </div>
      )}

      {docs.length === 0 ? <p className="text-sm text-charcoal-600/60">No documents yet — add deeds, surveys, planning docs and valuations here.</p> : (
        <div className="space-y-3">
          {CATEGORIES.filter((c) => docs.some((d) => d.category === c.v)).map((c) => (
            <div key={c.v}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/50">{c.label}</p>
              <ul className="space-y-1">
                {docs.filter((d) => d.category === c.v).map((d) => (
                  <li key={d.id} className="group flex items-center justify-between gap-2 rounded-lg border border-stone-line px-2.5 py-1.5 text-sm">
                    <span className="min-w-0 flex items-center gap-1.5 truncate text-charcoal">{d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate hover:text-forest">{d.name} <ExternalLink size={11} /></a> : d.name}</span>
                    <button onClick={() => remove(d.id)} className="shrink-0 text-charcoal-600/30 opacity-0 transition-opacity hover:text-signal-danger group-hover:opacity-100"><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
