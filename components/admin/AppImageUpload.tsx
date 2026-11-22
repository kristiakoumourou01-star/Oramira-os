'use client';

import { useRef, useState } from 'react';
import { Upload, Camera, RefreshCw, Trash2, ImageIcon } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const BUCKET = 'app-media';
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX = 15 * 1024 * 1024;

/**
 * Εικόνα για την εφαρμογή κινητού (μπλοκ αρχικής, logo wallet): ανεβαίνει
 * αυτούσια στο δημόσιο bucket app-media και επιστρέφει το δημόσιο URL.
 */
export function AppImageUpload({ value, onChange, folder, disabled, compact = false }: {
  value: string; onChange: (url: string) => void; folder: string; disabled?: boolean; compact?: boolean;
}) {
  const file = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  async function take(f?: File | null) {
    if (!f || disabled) return;
    setErr(null);
    if (!TYPES.includes(f.type)) { setErr('Μη αποδεκτός τύπος αρχείου.'); return; }
    if (f.size > MAX) { setErr('Το αρχείο είναι πάνω από 15 MB.'); return; }
    setBusy(true);
    try {
      const sb = createSupabaseBrowserClient();
      const path = `${folder}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, f, { upsert: false, contentType: f.type });
      if (error) setErr(`Η εικόνα δεν ανέβηκε: ${error.message}`);
      else onChange(sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Η εικόνα δεν ανέβηκε.');
    }
    setBusy(false);
  }

  const btn = 'inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-3 text-[13px] text-charcoal hover:border-forest/30 disabled:opacity-40';
  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files?.[0]); }}
        className={`flex items-center justify-center overflow-hidden rounded-xl border-2 border-dashed ${compact ? 'h-24' : 'h-40'} ${over ? 'border-forest bg-forest/[0.04]' : 'border-stone-line bg-stone-50'}`}>
        {value
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={value} alt="" className="h-full w-full object-cover" />
          : <span className="flex flex-col items-center gap-1 text-charcoal-600"><ImageIcon size={22} /><span className="text-[13px]">{busy ? 'Ανέβασμα…' : 'Χωρίς εικόνα'}</span></span>}
      </div>
      <p className="text-[12px] text-charcoal-600/80">JPEG, PNG, WebP, GIF ή AVIF — έως 15 MB.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled || busy} onClick={() => file.current?.click()} className={btn}>
          {value ? <RefreshCw size={14} /> : <Upload size={14} />} {busy ? 'Ανέβασμα…' : value ? 'Αντικατάσταση' : 'Ανέβασμα εικόνας'}
        </button>
        <button type="button" disabled={disabled || busy} onClick={() => cam.current?.click()} className={btn}><Camera size={14} /> Λήψη φωτογραφίας</button>
        {value && <button type="button" disabled={disabled || busy} onClick={() => onChange('')} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] text-signal-danger hover:bg-signal-danger/10 disabled:opacity-40"><Trash2 size={14} /> Αφαίρεση</button>}
      </div>
      <input ref={file} type="file" accept={TYPES.join(',')} className="hidden" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />
      {err && <p className="text-[12px] text-signal-danger">{err}</p>}
    </div>
  );
}
