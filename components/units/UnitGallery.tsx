'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Trash2, Star, Link2, Play, FileText, X, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { addUnitMedia, deleteUnitMedia, makeCover } from '@/app/actions/unit-page';
import { embedUrl, MEDIA_KIND_LABEL, type UnitMediaItem } from '@/lib/unit-page-shared';
import { prepareUpload, watermarkActive, type WatermarkPlan } from '@/lib/watermark-shared';

/** Photos, videos and floor plans of one unit — view, upload, reorder (cover), delete. */
export function UnitGallery({ items, unitId, projectId, canEdit, missing, watermark = null }: { items: UnitMediaItem[]; unitId: string; projectId: string; canEdit: boolean; missing: boolean; watermark?: WatermarkPlan | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState<'photo' | 'video' | 'floor_plan'>('photo');
  const [link, setLink] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const visual = items.filter((m) => m.kind !== 'floor_plan');
  const plans = items.filter((m) => m.kind === 'floor_plan');
  const cover = visual.find((m) => m.kind === 'photo');

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setErr(null);
    const supabase = createSupabaseBrowserClient();
    for (const original of Array.from(files)) {
      let f = original;
      setBusy(original.name);
      // Photos: resize + watermark in the browser, so an unmarked copy never leaves it.
      if (kind === 'photo') {
        try { f = await prepareUpload(original, watermark); }
        catch { setErr(`Το «${original.name}» δεν ανέβηκε: το υδατογράφημα δεν μπήκε (ελέγξτε το logo στις Ρυθμίσεις → Φόρμες μονάδων).`); continue; }
      }
      if (f.size > 25 * 1024 * 1024) { setErr(`Το «${f.name}» είναι πάνω από 25 MB. Για μεγάλα βίντεο βάλτε σύνδεσμο YouTube/Vimeo.`); continue; }
      const p = `${projectId}/units/${unitId}/${kind}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error } = await supabase.storage.from('project-media').upload(p, f, { upsert: false });
      if (error) { setErr(`Το «${f.name}» δεν ανέβηκε: ${error.message}`); continue; }
      const r = await addUnitMedia({ unitId, projectId, kind, storagePath: p });
      if (!r.ok) setErr(r.error);
    }
    setBusy(null);
    router.refresh();
  }
  const addLink = () => start(async () => {
    const r = await addUnitMedia({ unitId, projectId, kind: 'video_link', url: link.trim() });
    if (r.ok) { setLink(''); router.refresh(); } else setErr(r.error);
  });
  const del = (id: string) => { if (confirm('Διαγραφή;')) start(async () => { const r = await deleteUnitMedia(id, unitId, projectId); if (r.ok) router.refresh(); else setErr(r.error); }); };
  const star = (id: string) => start(async () => { const r = await makeCover(id, unitId, projectId); if (r.ok) router.refresh(); else setErr(r.error); });

  const Thumb = ({ m, i }: { m: UnitMediaItem; i: number }) => (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-md border border-stone-line bg-sand-100">
      <button type="button" onClick={() => setOpen(i)} className="h-full w-full">
        {m.kind === 'photo' && m.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url} alt={m.caption ?? ''} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-charcoal-600"><Play size={20} /> {MEDIA_KIND_LABEL[m.kind]}</span>
        )}
      </button>
      {canEdit && (
        <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
          {m.kind === 'photo' && <button type="button" title="Εξώφυλλο" onClick={() => star(m.id)} className="rounded bg-white/90 p-1 text-champagne-600 shadow"><Star size={12} /></button>}
          <button type="button" title="Διαγραφή" onClick={() => del(m.id)} className="rounded bg-white/90 p-1 text-signal-danger shadow"><Trash2 size={12} /></button>
        </div>
      )}
    </div>
  );

  const current = open != null ? visual[open] : null;
  const emb = current?.kind === 'video_link' && current.url ? embedUrl(current.url) : null;

  return (
    <div className="panel space-y-4 p-6">
      <h4>Φωτογραφίες & βίντεο</h4>
      {missing && <p className="text-xs text-champagne-600">Ενεργοποιείται μόλις τρέξει το supabase/ΕΚΚΡΕΜΕΙ_ΣΤΗ_ΒΑΣΗ.sql.</p>}

      {cover?.url ? (
        <button type="button" onClick={() => setOpen(visual.indexOf(cover))} className="block aspect-[16/9] w-full overflow-hidden rounded-lg bg-sand-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover.url} alt={cover.caption ?? ''} className="h-full w-full object-cover" />
        </button>
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center rounded-lg bg-sand-100 text-olive"><ImageIcon size={28} strokeWidth={1.4} /></div>
      )}
      {visual.length > (cover ? 1 : 0) && <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{visual.map((m, i) => <Thumb key={m.id} m={m} i={i} />)}</div>}

      {plans.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Κατόψεις</p>
          <div className="flex flex-wrap gap-2">
            {plans.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-1 rounded-md border border-stone-line px-2 py-1 text-sm">
                <a href={m.url ?? '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-forest hover:underline"><FileText size={13} /> {m.caption ?? 'Κάτοψη'}</a>
                {canEdit && <button type="button" onClick={() => del(m.id)} className="text-charcoal-600/50 hover:text-signal-danger"><X size={12} /></button>}
              </span>
            ))}
          </div>
        </div>
      )}

      {canEdit && !missing && (
        <div className="space-y-2 rounded-md bg-stone/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value as any)} className="input w-auto text-sm">
              <option value="photo">Φωτογραφίες</option>
              <option value="video">Βίντεο (έως 25 MB)</option>
              <option value="floor_plan">Κάτοψη (εικόνα ή PDF)</option>
            </select>
            {kind === 'photo' && watermarkActive(watermark) && <span className="text-[11px] text-charcoal-600/70">Με υδατογράφημα</span>}
            <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
              <Upload size={13} /> {busy ? `Ανέβασμα ${busy}…` : 'Επιλογή αρχείων'}
              <input type="file" multiple className="hidden" disabled={!!busy}
                accept={kind === 'photo' ? 'image/*' : kind === 'video' ? 'video/*' : 'image/*,application/pdf'}
                onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
            </label>
          </div>
          <div className="flex gap-2">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Σύνδεσμος βίντεο ή 3D tour (YouTube, Vimeo, Matterport)" className="input text-sm" />
            <button type="button" disabled={pending || !link.trim()} onClick={addLink} className="btn-secondary px-3 py-1.5 text-xs"><Link2 size={13} /> Προσθήκη</button>
          </div>
          {err && <p className="text-xs text-signal-danger">{err}</p>}
        </div>
      )}

      {current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(null)}>
          <div className="relative max-h-full w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {current.kind === 'photo' && current.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.url} alt={current.caption ?? ''} className="mx-auto max-h-[85vh] rounded object-contain" />
            ) : current.kind === 'video' && current.url ? (
              <video src={current.url} controls autoPlay className="mx-auto max-h-[85vh] w-full rounded" />
            ) : emb ? (
              <iframe src={emb} className="aspect-video w-full rounded" allow="autoplay; fullscreen" allowFullScreen />
            ) : (
              <a href={current.url ?? '#'} target="_blank" rel="noreferrer" className="block rounded bg-white p-6 text-center text-forest underline">Άνοιγμα συνδέσμου</a>
            )}
            {current.caption && <p className="mt-2 text-center text-sm text-white/80">{current.caption}</p>}
            <button type="button" onClick={() => setOpen(null)} className="absolute -top-10 right-0 text-white"><X size={24} /></button>
            {visual.length > 1 && (
              <>
                <button type="button" onClick={() => setOpen((open! - 1 + visual.length) % visual.length)} className="absolute left-0 top-1/2 -translate-x-12 text-white"><ChevronLeft size={32} /></button>
                <button type="button" onClick={() => setOpen((open! + 1) % visual.length)} className="absolute right-0 top-1/2 translate-x-12 text-white"><ChevronRight size={32} /></button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
