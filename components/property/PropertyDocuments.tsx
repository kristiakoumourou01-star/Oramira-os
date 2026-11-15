'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Download, Pencil, Trash2, X, Search, StickyNote } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getPropertyDocUploadUrl, recordPropertyDoc, updatePropertyDoc, deletePropertyDoc } from '@/app/actions/property-docs';
import { getDocumentUrl } from '@/app/actions/storage';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';

export interface PropertyDoc {
  id: string; title: string | null; category: string; description: string | null; notes: string | null;
  bucket: string; storage_path: string | null; created_at: string; unitId: string | null; uploader: string | null;
}
const CATS: [string, string][] = [['other', 'Άλλο'], ['contract', 'Συμβόλαιο'], ['legal', 'Νομικό / τίτλος'], ['floorplan', 'Κάτοψη'], ['drawing', 'Σχέδιο'], ['specification', 'Προδιαγραφές'], ['warranty', 'Εγγύηση'], ['manual', 'Εγχειρίδιο'], ['invoice', 'Τιμολόγιο'], ['marketing', 'Marketing']];
const CAT = Object.fromEntries(CATS);

/**
 * Property → Documents: ανέβασμα εγγράφων για όλο το έργο ή για συγκεκριμένο
 * ακίνητο, με περιγραφή, σημειώσεις και ημερομηνία ανεβάσματος.
 */
export function PropertyDocuments({ projectId, units, docs, canEdit }: { projectId: string; units: { id: string; label: string }[]; docs: PropertyDoc[]; canEdit: boolean }) {
  const router = useRouter();
  const unitName = useMemo(() => new Map(units.map((u) => [u.id, u.label])), [units]);
  const [filter, setFilter] = useState<string>('all');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [editDoc, setEditDoc] = useState<PropertyDoc | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fmt = (iso: string) => new Date(iso).toLocaleString(DATE_TAG[currentLocale().lang], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Nicosia' });
  const open = async (d: PropertyDoc) => { if (!d.storage_path) return; const url = await getDocumentUrl(d.bucket as any, d.storage_path); if (url) window.open(url, '_blank'); };

  const list = docs.filter((d) => (filter === 'all' || (filter === 'common' ? !d.unitId : d.unitId === filter))
    && (!q.trim() || `${d.title} ${d.description} ${d.notes} ${CAT[d.category]} ${d.unitId ? unitName.get(d.unitId) : ''}`.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[['all', 'Όλα'], ['common', 'Όλο το έργο'], ...units.map((u) => [u.id, u.label] as [string, string])].map(([k, l]) => {
            const n = k === 'all' ? docs.length : k === 'common' ? docs.filter((d) => !d.unitId).length : docs.filter((d) => d.unitId === k).length;
            return <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${filter === k ? 'bg-forest text-white ring-forest' : 'bg-white text-charcoal-600 ring-stone-line hover:ring-forest/40'}`} data-no-tr={k !== 'all' && k !== 'common' ? true : undefined}>{l} <span className="opacity-70">{n}</span></button>;
          })}
        </div>
        <label className="relative ml-auto"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" /><input className="input h-9 w-56 rounded-full py-1 pl-8 text-sm" placeholder="Αναζήτηση εγγράφου…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {canEdit && <button type="button" onClick={() => setAdding(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-semibold text-white shadow-sm hover:bg-forest/90"><Upload size={15} /> Ανέβασμα εγγράφου</button>}
      </div>
      {msg && <p className="text-sm text-forest">{msg}</p>}

      <div className="overflow-x-auto rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-stone-line bg-forest/[0.03] text-left text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70 [&_th]:px-4 [&_th]:py-3"><tr>
            <th>Έγγραφο</th><th>Ακίνητο</th><th>Κατηγορία</th><th>Σημειώσεις</th><th>Ανέβηκε</th><th className="text-right">Ενέργειες</th>
          </tr></thead>
          <tbody className="divide-y divide-stone-line/70 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top">
            {list.length === 0 && <tr><td colSpan={6} className="!py-12 text-center text-charcoal-600/70"><span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-forest/10 text-forest"><FileText size={20} /></span>{docs.length ? 'Κανένα έγγραφο με αυτό το φίλτρο.' : 'Δεν υπάρχουν ακόμη έγγραφα. Πατήστε «Ανέβασμα εγγράφου».'}</td></tr>}
            {list.map((d) => (
              <tr key={d.id} className="hover:bg-forest/[0.025]">
                <td>
                  <button type="button" onClick={() => open(d)} className="flex items-center gap-2 text-left font-semibold text-charcoal hover:text-forest"><FileText size={15} className="shrink-0 text-forest" /><span data-no-tr>{d.title || 'Χωρίς τίτλο'}</span></button>
                  {d.description && <p className="mt-0.5 max-w-xs text-xs text-charcoal-600/80" data-no-tr>{d.description}</p>}
                </td>
                <td className="whitespace-nowrap"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${d.unitId ? 'bg-forest/[0.07] text-forest' : 'bg-[#c9a063]/15 text-[#8a6420]'}`} data-no-tr={d.unitId ? true : undefined}>{d.unitId ? unitName.get(d.unitId) ?? 'Ακίνητο' : 'Όλο το έργο'}</span></td>
                <td className="whitespace-nowrap text-charcoal-600">{CAT[d.category] ?? d.category}</td>
                <td className="max-w-[260px]">{d.notes ? <p className="flex gap-1.5 whitespace-pre-line text-xs text-charcoal-600" data-no-tr><StickyNote size={12} className="mt-0.5 shrink-0 text-[#c9a063]" />{d.notes}</p> : <span className="text-xs text-charcoal-600/40">—</span>}</td>
                <td className="whitespace-nowrap text-xs text-charcoal-600"><span className="tabular-nums">{fmt(d.created_at)}</span>{d.uploader && <span className="block text-charcoal-600/60" data-no-tr>{d.uploader}</span>}</td>
                <td>
                  <span className="flex justify-end gap-1">
                    <button type="button" onClick={() => open(d)} title="Άνοιγμα" aria-label="Άνοιγμα" className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-forest/10 hover:text-forest"><Download size={15} /></button>
                    {canEdit && <button type="button" onClick={() => setEditDoc(d)} title="Επεξεργασία" aria-label="Επεξεργασία" className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-forest/10 hover:text-forest"><Pencil size={14} /></button>}
                    {canEdit && <button type="button" disabled={pending} onClick={() => { if (confirm(`Διαγραφή του «${d.title ?? 'εγγράφου'}»; Δεν αναιρείται.`)) start(async () => { const r = await deletePropertyDoc(d.id); setMsg(r.ok ? 'Διαγράφηκε.' : r.error); router.refresh(); }); }} title="Διαγραφή" aria-label="Διαγραφή" className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-rose-50 hover:text-signal-danger"><Trash2 size={14} /></button>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && <UploadDialog projectId={projectId} units={units} defaultUnit={filter !== 'all' && filter !== 'common' ? filter : ''} onClose={() => setAdding(false)} onDone={(n) => { setAdding(false); setMsg(`${n} ${n === 1 ? 'έγγραφο ανέβηκε' : 'έγγραφα ανέβηκαν'}.`); router.refresh(); }} />}
      {editDoc && <EditDialog doc={editDoc} onClose={() => setEditDoc(null)} onDone={() => { setEditDoc(null); setMsg('Αποθηκεύτηκε.'); router.refresh(); }} />}
    </div>
  );
}

function Shell({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-line px-5 py-3.5"><p className="font-semibold text-charcoal">{title}</p><button type="button" onClick={onClose} aria-label="Κλείσιμο" className="text-charcoal-600/60 hover:text-charcoal"><X size={18} /></button></div>
        <div className="space-y-3 overflow-y-auto p-5">{children}</div>
        <div className="flex justify-end gap-2 border-t border-stone-line px-5 py-3">{footer}</div>
      </div>
    </div>
  );
}
const F = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block"><span className="text-xs font-medium text-charcoal-600">{label}</span><div className="mt-1">{children}</div></label>;

function UploadDialog({ projectId, units, defaultUnit, onClose, onDone }: { projectId: string; units: { id: string; label: string }[]; defaultUnit: string; onClose: () => void; onDone: (n: number) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [unit, setUnit] = useState(defaultUnit);
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState('other');
  const [desc, setDesc] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const go = async () => {
    if (!files.length) { setErr('Επιλέξτε τουλάχιστον ένα αρχείο.'); return; }
    setErr(null); let ok = 0;
    const sb = createSupabaseBrowserClient();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setBusy(`${i + 1}/${files.length} · ${f.name}`);
      const u = await getPropertyDocUploadUrl(projectId, unit || null, f.name, f.size);
      if (!u.ok) { setErr(u.error); continue; }
      const { error } = await sb.storage.from(u.bucket).uploadToSignedUrl(u.path, u.token, f, { contentType: f.type || undefined });
      if (error) { setErr(`«${f.name}»: ${error.message}`); continue; }
      const name = files.length === 1 && title.trim() ? title.trim() : f.name.replace(/\.[^.]+$/, '');
      const r = await recordPropertyDoc({ projectId, unitId: unit || null, path: u.path, title: name, category: cat, description: desc, notes });
      if (!r.ok) setErr(r.error); else ok++;
    }
    setBusy(null);
    if (ok) onDone(ok);
  };
  return (
    <Shell title="Ανέβασμα εγγράφου" onClose={onClose} footer={<><button type="button" className="btn-ghost" onClick={onClose}>Άκυρο</button><button type="button" className="btn-primary" disabled={!!busy} onClick={go}>{busy ? `Ανέβασμα ${busy}` : 'Ανέβασμα'}</button></>}>
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); setFiles(Array.from(e.dataTransfer.files)); }} onClick={() => input.current?.click()}
        className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-forest/25 bg-forest/[0.03] px-4 py-6 text-center text-sm text-charcoal-600 hover:border-forest/50">
        <Upload size={20} className="text-forest" />
        {files.length ? <span className="font-medium text-charcoal">{files.map((f) => f.name).join(', ')}</span> : <span>Σύρετε αρχεία εδώ ή <span className="font-semibold text-forest">επιλέξτε</span> (έως 25MB το καθένα)</span>}
        <input ref={input} type="file" multiple hidden onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      </div>
      <F label="Αφορά"><select className="input" value={unit} onChange={(e) => setUnit(e.target.value)}><option value="">Όλο το έργο</option>{units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></F>
      {files.length <= 1 && <F label="Τίτλος"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="π.χ. Τίτλος ιδιοκτησίας UNIT A" /></F>}
      <F label="Κατηγορία"><select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></F>
      <F label="Περιγραφή"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Σύντομη περιγραφή του εγγράφου" /></F>
      <F label="Σημειώσεις"><textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Π.χ. υπογράφηκε από τον αγοραστή, αναμένεται πρωτότυπο…" /></F>
      <p className="text-xs text-charcoal-600/60">Η ημερομηνία και ποιος το ανέβασε καταγράφονται αυτόματα.</p>
      {err && <p className="text-sm text-signal-danger">{err}</p>}
    </Shell>
  );
}

function EditDialog({ doc, onClose, onDone }: { doc: PropertyDoc; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(doc.title ?? '');
  const [cat, setCat] = useState(doc.category);
  const [desc, setDesc] = useState(doc.description ?? '');
  const [notes, setNotes] = useState(doc.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Shell title="Επεξεργασία εγγράφου" onClose={onClose} footer={<><button type="button" className="btn-ghost" onClick={onClose}>Άκυρο</button><button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => { const r = await updatePropertyDoc(doc.id, { title, category: cat, description: desc, notes }); if (r.ok) onDone(); else setErr(r.error); })}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button></>}>
      <F label="Τίτλος"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></F>
      <F label="Κατηγορία"><select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></F>
      <F label="Περιγραφή"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></F>
      <F label="Σημειώσεις"><textarea className="input min-h-[100px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></F>
      {err && <p className="text-sm text-signal-danger">{err}</p>}
    </Shell>
  );
}
