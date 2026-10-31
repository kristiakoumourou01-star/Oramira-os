'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { HardHat, Plus, ImagePlus, X, Eye, EyeOff, Trash2, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { createConstructionUpdate, editConstructionUpdate, deleteConstructionUpdate } from '@/app/actions/construction';
import { prepareUpload, type WatermarkPlan } from '@/lib/watermark-shared';
import { MILESTONES, milestoneLabel, scopeLabel, type ConstructionUpdate } from '@/lib/construction-shared';
import { formatDateTime } from '@/lib/format';

interface Opt { id: string; name: string }
interface UnitOpt { id: string; unit_number: string; building_id: string | null }
interface Pending { file: File; preview: string; caption: string }
/** randomUUID needs a secure context; fall back for plain-http previews. */
const uid = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** Lightbox over a list of photo URLs. */
export function PhotoLightbox({ photos, index, onClose }: { photos: { url: string | null; caption?: string | null }[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const p = photos[i];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div className="relative max-h-full w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p?.url && <img src={p.url} alt={p.caption ?? ''} className="mx-auto max-h-[85vh] rounded object-contain" />}
        {p?.caption && <p className="mt-2 text-center text-sm text-white/80">{p.caption}</p>}
        <button type="button" onClick={onClose} className="absolute -top-10 right-0 text-white"><X size={24} /></button>
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => setI((i - 1 + photos.length) % photos.length)} className="absolute left-0 top-1/2 text-white sm:-translate-x-12"><ChevronLeft size={32} /></button>
            <button type="button" onClick={() => setI((i + 1) % photos.length)} className="absolute right-0 top-1/2 text-white sm:translate-x-12"><ChevronRight size={32} /></button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Πρόοδος κατασκευής (προσωπικό): νέα ενημέρωση με φωτογραφίες + ροή.
 * Ό,τι είναι «Ορατό στους αγοραστές» εμφανίζεται αυτόματα στο portal τους.
 */
export function ConstructionUpdates({ projectId, buildings, units, items, canEdit, watermark, missing, fixedUnit = null }: {
  projectId: string; buildings: Opt[]; units: UnitOpt[]; items: ConstructionUpdate[]; canEdit: boolean;
  watermark: WatermarkPlan | null; missing: boolean; fixedUnit?: { id: string; unit_number: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<string>(fixedUnit ? `u:${fixedUnit.id}` : 'project');
  const [milestone, setMilestone] = useState('');
  const [progress, setProgress] = useState<string>('');
  const [visible, setVisible] = useState(true);
  const [notify, setNotify] = useState(true);
  const [files, setFiles] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [box, setBox] = useState<{ photos: ConstructionUpdate['photos']; i: number } | null>(null);

  const addFiles = (list: FileList | null) => {
    const add = Array.from(list ?? []).filter((f) => f.type.startsWith('image/')).slice(0, 30 - files.length)
      .map((file) => ({ file, preview: URL.createObjectURL(file), caption: '' }));
    setFiles((f) => [...f, ...add]);
  };
  const reset = () => { files.forEach((f) => URL.revokeObjectURL(f.preview)); setFiles([]); setTitle(''); setBody(''); setProgress(''); setMilestone(''); setOpen(false); };

  const publish = async () => {
    setErr(null); setOk(null);
    if (!title.trim()) { setErr('Γράψτε τίτλο.'); return; }
    const supabase = createSupabaseBrowserClient();
    const photos: { path: string; caption: string }[] = [];
    for (let k = 0; k < files.length; k++) {
      setBusy(`Ανέβασμα φωτογραφίας ${k + 1} από ${files.length}…`);
      let f = files[k].file;
      try { f = await prepareUpload(f, watermark); } catch { setBusy(null); setErr('Το υδατογράφημα δεν μπήκε (ελέγξτε το logo στις Ρυθμίσεις → Φόρμες μονάδων).'); return; }
      const path = `${projectId}/construction/${uid()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error } = await supabase.storage.from('project-media').upload(path, f, { upsert: false });
      if (error) { setBusy(null); setErr(`Η φωτογραφία «${f.name}» δεν ανέβηκε: ${error.message}`); return; }
      photos.push({ path, caption: files[k].caption });
    }
    setBusy('Δημοσίευση…');
    const [kind, id] = scope.split(':');
    const r = await createConstructionUpdate({
      projectId, buildingId: kind === 'b' ? id : null, unitId: kind === 'u' ? id : null, title, body,
      progress: progress === '' ? null : Number(progress), milestoneType: milestone || null, photos, visible, notify,
    });
    setBusy(null);
    if (!r.ok) { setErr(r.error); return; }
    setOk(visible ? `Δημοσιεύτηκε στους αγοραστές${r.notified ? ` · ειδοποιήθηκαν ${r.notified}` : ''}.` : 'Αποθηκεύτηκε (μόνο για το προσωπικό).');
    reset(); router.refresh();
  };
  const toggle = (u: ConstructionUpdate) => start(async () => { const r = await editConstructionUpdate(u.id, { visible: !u.visible }); if (r.ok) router.refresh(); else setErr(r.error); });
  const del = (u: ConstructionUpdate) => { if (window.confirm(`Διαγραφή της ενημέρωσης «${u.title}» και των φωτογραφιών της;`)) start(async () => { const r = await deleteConstructionUpdate(u.id); if (r.ok) router.refresh(); else setErr(r.error); }); };

  const byBuilding = buildings.map((b) => ({ ...b, units: units.filter((u) => u.building_id === b.id) }));
  const loose = units.filter((u) => !u.building_id || !buildings.some((b) => b.id === u.building_id));

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="flex items-center gap-2"><HardHat size={16} /> Πρόοδος κατασκευής</h4>
          <p className="text-xs text-charcoal-600/70">Ενημερώσεις με φωτογραφίες. Όσες είναι ορατές εμφανίζονται αυτόματα στο portal των αγοραστών.</p>
        </div>
        {canEdit && !missing && !open && <button type="button" onClick={() => { setOpen(true); setOk(null); }} className="btn-primary px-3 py-1.5 text-sm"><Plus size={14} /> Νέα ενημέρωση</button>}
      </div>
      {missing && <p className="text-xs text-champagne-600">Ενεργοποιείται μόλις τρέξει το migration 0066.</p>}
      {ok && <p className="text-sm text-signal-success">{ok}</p>}

      {open && (
        <div className="space-y-3 rounded-md border border-stone-line bg-stone/40 p-4">
          <input className="input" placeholder="Τίτλος — π.χ. «Ολοκληρώθηκε η πλάκα του 3ου ορόφου»" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="input min-h-[80px]" placeholder="Λίγα λόγια για τους αγοραστές (προαιρετικό)" value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="eyebrow mb-1 block">Αφορά</span>
              <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="project">Όλο το έργο</option>
                {buildings.length > 0 && <optgroup label="Κτίριο">{buildings.map((b) => <option key={b.id} value={`b:${b.id}`}>{b.name}</option>)}</optgroup>}
                {byBuilding.filter((b) => b.units.length).map((b) => <optgroup key={b.id} label={`Μονάδες · ${b.name}`}>{b.units.map((u) => <option key={u.id} value={`u:${u.id}`}>{u.unit_number}</option>)}</optgroup>)}
                {loose.length > 0 && <optgroup label="Μονάδες">{loose.map((u) => <option key={u.id} value={`u:${u.id}`}>{u.unit_number}</option>)}</optgroup>}
              </select>
            </label>
            <label className="block"><span className="eyebrow mb-1 block">Στάδιο</span>
              <select className="input" value={milestone} onChange={(e) => setMilestone(e.target.value)}>
                <option value="">—</option>
                {MILESTONES.map((m) => <option key={m.value} value={m.value}>{m.el}</option>)}
              </select>
            </label>
            <label className="block"><span className="eyebrow mb-1 block">Πρόοδος {progress !== '' ? `· ${progress}%` : '(προαιρετικό)'}</span>
              <input className="w-full" type="range" min={0} max={100} step={5} value={progress === '' ? 0 : Number(progress)} onChange={(e) => setProgress(e.target.value)} />
              {progress !== '' && <button type="button" onClick={() => setProgress('')} className="text-[11px] text-charcoal-600/60 hover:text-charcoal">χωρίς ποσοστό</button>}
            </label>
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              {files.map((f, k) => (
                <div key={k} className="w-32 space-y-1">
                  <div className="relative aspect-[4/3] overflow-hidden rounded border border-stone-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.preview} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => { URL.revokeObjectURL(f.preview); setFiles((x) => x.filter((_, j) => j !== k)); }} className="absolute right-1 top-1 rounded bg-white/90 p-0.5 text-signal-danger"><X size={12} /></button>
                  </div>
                  <input className="input py-1 text-[11px]" placeholder="Λεζάντα" value={f.caption} onChange={(e) => setFiles((x) => x.map((y, j) => (j === k ? { ...y, caption: e.target.value } : y)))} />
                </div>
              ))}
              <label className="flex aspect-[4/3] w-32 cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-stone-line text-xs text-charcoal-600/70 hover:border-forest/40">
                <ImagePlus size={20} /> Φωτογραφίες
                <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              </label>
            </div>
            {watermark?.enabled && <p className="mt-1 text-[11px] text-charcoal-600/60">Οι φωτογραφίες παίρνουν το υδατογράφημα της εταιρείας.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Ορατό στους αγοραστές</label>
            <label className={`flex items-center gap-1.5 ${visible ? '' : 'opacity-40'}`}><input type="checkbox" disabled={!visible} checked={visible && notify} onChange={(e) => setNotify(e.target.checked)} /> Ειδοποίηση στους αγοραστές</label>
          </div>
          {err && <p className="text-sm text-signal-danger">{err}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!!busy || !title.trim()} onClick={publish} className="btn-primary">{busy ?? (visible ? 'Δημοσίευση' : 'Αποθήκευση')}</button>
            <button type="button" disabled={!!busy} onClick={reset} className="btn-secondary">Άκυρο</button>
          </div>
        </div>
      )}

      {!open && err && <p className="text-sm text-signal-danger">{err}</p>}
      {items.length === 0 ? (!missing && <p className="text-sm text-charcoal-600/60">Καμία ενημέρωση ακόμη.</p>) : (
        <ol className="space-y-4">
          {items.map((u) => (
            <li key={u.id} className={`rounded-md border border-stone-line p-3 ${u.visible ? '' : 'bg-sand-100/60'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-charcoal">{u.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-charcoal-600/70">
                    <span>{formatDateTime(u.createdAt)}{u.by ? ` · ${u.by}` : ''}</span>
                    <span className="badge-neutral">{scopeLabel(u)}</span>
                    {u.milestoneType && <span className="badge-neutral">{milestoneLabel(u.milestoneType)}</span>}
                    {u.progress !== null && <span className="badge-forest">{u.progress}%</span>}
                    {u.visible ? <span className="text-signal-success">ορατό στους αγοραστές</span> : <span>μόνο προσωπικό</span>}
                    {u.notifiedAt && <span className="inline-flex items-center gap-0.5"><Bell size={10} /> ειδοποιήθηκαν</span>}
                  </p>
                </div>
                {canEdit && (
                  <span className="flex gap-2 text-charcoal-600/60">
                    <button type="button" disabled={pending} title={u.visible ? 'Απόκρυψη από τους αγοραστές' : 'Εμφάνιση στους αγοραστές'} onClick={() => toggle(u)} className="hover:text-forest">{u.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                    <button type="button" disabled={pending} title="Διαγραφή" onClick={() => del(u)} className="hover:text-signal-danger"><Trash2 size={15} /></button>
                  </span>
                )}
              </div>
              {u.body && <p className="mt-2 whitespace-pre-line text-sm text-charcoal-600">{u.body}</p>}
              {u.photos.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {u.photos.map((p, i) => (
                    <button key={p.path} type="button" onClick={() => setBox({ photos: u.photos, i })} className="aspect-[4/3] overflow-hidden rounded bg-sand-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.url ? <img src={p.url} alt={p.caption ?? ''} className="h-full w-full object-cover" loading="lazy" /> : <span className="text-[10px] text-charcoal-600/60">μη διαθέσιμη</span>}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {box && <PhotoLightbox photos={box.photos} index={box.i} onClose={() => setBox(null)} />}
    </div>
  );
}
