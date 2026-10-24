'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { addProjectMedia, deleteProjectMedia } from '@/app/actions/property';
import type { SignedMedia } from '@/lib/project-media-shared';

const KINDS = [
  { v: 'masterplan', label: 'Masterplan / site plan' },
  { v: 'block_layout', label: 'Block layout' },
  { v: 'architectural', label: 'Architectural drawing' },
  { v: 'floor_plan', label: 'Floor plan' },
  { v: 'render', label: 'Render' },
];
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.v, k.label]));

export interface BuildingOption { id: string; name: string }

/** Staff tool to upload plans/renders that drive the interactive map. */
export function ProjectMediaManager({ projectId, buildings, media }: { projectId: string; buildings: BuildingOption[]; media: SignedMedia[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState('masterplan');
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function submit(fd: FormData) {
    if (!file) return;
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const path = `${projectId}/${kind}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from('project-media').upload(path, file, { upsert: false });
    setBusy(false);
    if (error) return;
    const floorRaw = String(fd.get('floor') || '').trim();
    startTransition(async () => {
      await addProjectMedia({
        projectId, kind, storagePath: path,
        title: String(fd.get('title') || '') || undefined,
        buildingId: String(fd.get('building') || '') || null,
        floor: floorRaw ? Number(floorRaw) : null,
      });
      setFile(null);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="panel p-6">
        <h4 className="mb-4 flex items-center gap-2"><Upload size={15} className="text-olive" strokeWidth={1.75} /> Add plan / render</h4>
        <form action={submit} className="space-y-3">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="input text-sm">
            {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
          </select>
          <input name="title" placeholder="Title (optional)" className="input text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select name="building" className="input text-sm">
              <option value="">Block (optional)…</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input name="floor" type="number" placeholder="Floor (optional)" className="input text-sm" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-stone-line px-3 py-2 text-sm text-charcoal-600/80 hover:bg-sand-100">
            <ImageIcon size={15} strokeWidth={1.75} /> {file ? file.name : 'Choose image / PDF'}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="submit" disabled={busy || isPending || !file} className="btn-primary w-full text-sm">{busy ? 'Uploading…' : isPending ? 'Saving…' : 'Upload'}</button>
        </form>
      </div>

      <div className="panel p-6 lg:col-span-2">
        <h4 className="mb-4">Media library</h4>
        {media.length === 0 ? (
          <p className="text-sm text-charcoal-600/70">No plans uploaded yet. Add a masterplan and floor plans to build the interactive map.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {media.map((m) => (
              <div key={m.id} className="group relative overflow-hidden rounded-lg border border-stone-line">
                {m.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.title ?? m.kind} className="h-28 w-full object-cover" />
                ) : (
                  <div className="flex h-28 w-full items-center justify-center bg-stone-50 text-charcoal-600/40"><ImageIcon size={20} /></div>
                )}
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-charcoal">{m.title ?? KIND_LABEL[m.kind] ?? m.kind}</p>
                  <p className="text-[10px] text-charcoal-600/50">{KIND_LABEL[m.kind] ?? m.kind}{m.floor != null ? ` · floor ${m.floor}` : ''}</p>
                </div>
                <button
                  onClick={() => startTransition(async () => { await deleteProjectMedia(m.id, projectId); router.refresh(); })}
                  className="absolute right-1.5 top-1.5 rounded bg-white/90 p-1 text-signal-danger opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
                ><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
