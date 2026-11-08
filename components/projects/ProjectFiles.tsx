'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, X, FileText, Download, ImageIcon, Trash2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getProjectUploadUrl, recordProjectFile, deleteProjectFile } from '@/app/actions/project-files';
import { getDocumentUrl } from '@/app/actions/storage';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';

export interface ProjectFile { id: string; title: string | null; category: string; storage_path: string; bucket: string; created_at: string }
const CATS: [string, string][] = [['other', 'Άλλο'], ['drawing', 'Σχέδια'], ['floorplan', 'Κάτοψη'], ['specification', 'Προδιαγραφές'], ['contract', 'Συμβόλαιο'], ['legal', 'Νομικά / άδειες'], ['invoice', 'Τιμολόγιο'], ['warranty', 'Εγγύηση'], ['manual', 'Εγχειρίδιο'], ['marketing', 'Marketing']];
const catLabel = (k: string) => CATS.find(([v]) => v === k)?.[1] ?? k;

/** Κουμπί ανεβάσματος (πολλά αρχεία μαζί, ή σύρσιμο πάνω στο πλαίσιο). */
function useUploader(projectId: string, kind: 'gallery' | 'documents') {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const upload = async (files: File[], category?: string) => {
    setErr(null);
    const sb = createSupabaseBrowserClient();
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setBusy(`${i + 1}/${files.length} · ${f.name}`);
      const u = await getProjectUploadUrl(projectId, kind, f.name, f.size, f.type || 'application/octet-stream');
      if (!u.ok) { setErr(u.error); continue; }
      const { error } = await sb.storage.from(u.bucket).uploadToSignedUrl(u.path, u.token, f, { contentType: f.type || undefined });
      if (error) { setErr(`«${f.name}»: ${error.message}`); continue; }
      const r = await recordProjectFile(projectId, kind, u.path, f.name.replace(/\.[^.]+$/, ''), category);
      if (!r.ok) setErr(r.error);
    }
    setBusy(null);
    router.refresh();
  };
  return { busy, err, upload };
}

function DropZone({ onFiles, accept, children, disabled }: { onFiles: (f: File[]) => void; accept?: string; children: React.ReactNode; disabled?: boolean }) {
  const [over, setOver] = useState(false);
  if (disabled) return <>{children}</>;
  return (
    <div onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const fs = [...e.dataTransfer.files].filter((f) => !accept || f.type.startsWith('image/')); if (fs.length) onFiles(fs); }}
      className={`rounded-lg transition ${over ? 'bg-forest/[0.06] ring-2 ring-forest/40' : ''}`}>{children}</div>
  );
}

export function ProjectGalleryPanel({ projectId, items, canEdit }: { projectId: string; items: ProjectFile[]; canEdit: boolean }) {
  const { busy, err, upload } = useUploader(projectId, 'gallery');
  const input = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [view, setView] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    let on = true;
    Promise.all(items.map(async (it) => [it.id, await getDocumentUrl('project-media', it.storage_path).catch(() => '')] as const)).then((p) => { if (on) setUrls(Object.fromEntries(p)); });
    return () => { on = false; };
  }, [items]);
  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h4>Gallery {items.length ? <span className="text-charcoal-600/50">· {items.length}</span> : null}</h4>
        {canEdit && <><button type="button" className="btn-secondary text-sm" disabled={!!busy} onClick={() => input.current?.click()}><Upload size={14} /> Ανέβασμα φωτογραφιών</button>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) upload(fs); }} /></>}
      </div>
      {busy && <p className="mb-2 text-xs text-forest">Ανέβασμα {busy}…</p>}
      {err && <p className="mb-2 text-xs text-signal-danger">{err}</p>}
      <DropZone onFiles={(fs) => upload(fs)} accept="image" disabled={!canEdit}>
        {items.length === 0 ? (
          <button type="button" disabled={!canEdit} onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-stone-line py-8 text-sm text-charcoal-600/70 enabled:hover:border-forest/40 enabled:hover:text-forest">
            <ImageIcon size={22} strokeWidth={1.5} />{canEdit ? 'Σύρετε φωτογραφίες εδώ ή πατήστε για ανέβασμα' : 'Καμία φωτογραφία ακόμη.'}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map((it) => (
              <div key={it.id} className="group relative aspect-[4/3] overflow-hidden rounded border border-stone-line bg-sand-100">
                {urls[it.id] ? <button type="button" className="h-full w-full" onClick={() => setView(urls[it.id])}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={urls[it.id]} alt={it.title ?? ''} className="h-full w-full object-cover" /></button>
                  : <div className="flex h-full w-full items-center justify-center text-olive"><ImageIcon size={20} strokeWidth={1.5} /></div>}
                {canEdit && <button type="button" disabled={pending} title="Διαγραφή" aria-label="Διαγραφή" onClick={() => { if (confirm('Διαγραφή της φωτογραφίας;')) start(async () => { await deleteProjectFile(projectId, it.id); router.refresh(); }); }}
                  className="absolute right-1.5 top-1.5 hidden rounded-full bg-white/90 p-1 text-signal-danger shadow group-hover:block"><Trash2 size={13} /></button>}
              </div>
            ))}
          </div>
        )}
      </DropZone>
      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setView(null)}>
          <button type="button" className="absolute right-4 top-4 text-white" aria-label="Κλείσιμο"><X size={24} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view} alt="" className="max-h-full max-w-full rounded" />
        </div>
      )}
    </div>
  );
}

export function ProjectDocumentsPanel({ projectId, items, canEdit }: { projectId: string; items: ProjectFile[]; canEdit: boolean }) {
  const { busy, err, upload } = useUploader(projectId, 'documents');
  const input = useRef<HTMLInputElement>(null);
  const [cat, setCat] = useState('other');
  const [pending, start] = useTransition();
  const router = useRouter();
  const open = async (d: ProjectFile) => { const url = await getDocumentUrl(d.bucket as any, d.storage_path); if (url) window.open(url, '_blank'); };
  return (
    <div className="panel p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h4>Documents {items.length ? <span className="text-charcoal-600/50">· {items.length}</span> : null}</h4>
        {canEdit && (
          <div className="flex items-center gap-2">
            <select className="input w-auto py-1.5 text-sm" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Κατηγορία">{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <button type="button" className="btn-secondary text-sm" disabled={!!busy} onClick={() => input.current?.click()}><Upload size={14} /> Ανέβασμα εγγράφων</button>
            <input ref={input} type="file" multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) upload(fs, cat); }} />
          </div>
        )}
      </div>
      {busy && <p className="mb-2 text-xs text-forest">Ανέβασμα {busy}…</p>}
      {err && <p className="mb-2 text-xs text-signal-danger">{err}</p>}
      <DropZone onFiles={(fs) => upload(fs, cat)} disabled={!canEdit}>
        {items.length === 0 ? (
          <button type="button" disabled={!canEdit} onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-stone-line py-8 text-sm text-charcoal-600/70 enabled:hover:border-forest/40 enabled:hover:text-forest">
            <FileText size={22} strokeWidth={1.5} />{canEdit ? 'Σύρετε έγγραφα εδώ (PDF, Word, Excel, σχέδια…) ή πατήστε για ανέβασμα' : 'Κανένα έγγραφο ακόμη.'}
          </button>
        ) : (
          <ul className="divide-y divide-stone-line">
            {items.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText size={16} className="shrink-0 text-olive" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-charcoal" data-no-tr>{d.title ?? '—'}</p>
                    <p className="text-xs text-charcoal-600/60">{catLabel(d.category)} · {new Date(d.created_at).toLocaleDateString(DATE_TAG[currentLocale().lang])}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" className="btn-ghost text-sm" onClick={() => open(d)}><Download size={14} /> Λήψη</button>
                  {canEdit && <button type="button" disabled={pending} title="Διαγραφή" aria-label="Διαγραφή" className="rounded p-1.5 text-charcoal-600/50 hover:bg-stone hover:text-signal-danger"
                    onClick={() => { if (confirm('Διαγραφή του εγγράφου;')) start(async () => { await deleteProjectFile(projectId, d.id); router.refresh(); }); }}><Trash2 size={14} /></button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DropZone>
    </div>
  );
}
