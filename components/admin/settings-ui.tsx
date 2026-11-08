'use client';

import { useRef, useState } from 'react';
import { Upload, Camera, Trash2 } from 'lucide-react';
import { fileToDataUrl } from '@/lib/image-upload';

/** Διακόπτης (toggle) όπως στις ρυθμίσεις του demo. */
export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${checked ? 'bg-forest' : 'bg-stone-line'}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

/** Τίτλος ενότητας (σερίφ) και πλαίσιο, όπως «Identity & branding». */
export function SettingsBlock({ title, note, children, className = '' }: { title: string; note?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`space-y-2 ${className}`}>
      <h3 className="font-display text-xl text-charcoal">{title}</h3>
      {note && <p className="text-sm text-charcoal-600/75">{note}</p>}
      <div className="panel space-y-4 p-5">{children}</div>
    </section>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-charcoal-600">{children}</span>;
}

/** Ανέβασμα logo με σύρσιμο/κλικ και «Λήψη φωτογραφίας» από την κάμερα. */
export function LogoDrop({ value, onChange, disabled, hint = 'Ανεβάστε το logo της εταιρείας.' }: { value: string | null; onChange: (dataUrl: string | null) => Promise<void> | void; disabled?: boolean; hint?: string }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const take = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { setErr('Έως 15 MB.'); return; }
    setBusy(true); setErr(null);
    try { await onChange(await fileToDataUrl(f, 600)); } catch (x) { setErr(x instanceof Error ? x.message : 'Σφάλμα εικόνας.'); }
    setBusy(false);
  };
  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) void take(e.dataTransfer.files?.[0]); }}
        onClick={() => !disabled && file.current?.click()} role="button" tabIndex={0}
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${over ? 'border-forest bg-forest/[0.04]' : 'border-stone-line hover:border-forest/40'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
        {value
          ? <img src={value} alt="Logo" className="max-h-24 max-w-[260px] object-contain" />
          : <><Upload size={22} className="text-charcoal-600" /><p className="font-medium text-charcoal">{busy ? 'Ανέβασμα…' : 'Ανεβάστε εικόνα'}</p></>}
        <p className="text-xs text-charcoal-600/70">JPEG, PNG, WebP, GIF ή SVG — έως 15 MB. Σύρετε εδώ ή πατήστε.</p>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={disabled || busy} onClick={() => cam.current?.click()} className="btn-secondary flex-1 justify-center text-sm"><Camera size={14} /> Λήψη φωτογραφίας</button>
        {value && <button type="button" disabled={disabled || busy} onClick={() => void onChange(null)} className="btn-ghost text-sm text-signal-danger"><Trash2 size={14} /> Αφαίρεση</button>}
        <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <p className="text-xs text-charcoal-600/60">{hint}</p>
      {err && <p className="text-xs text-signal-danger">{err}</p>}
    </div>
  );
}

/** Χρώμα: κουτάκι + κωδικός #RRGGBB. */
export function ColorField({ value, onChange, disabled, placeholder }: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  const ok = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="flex items-center gap-2">
      <input type="color" disabled={disabled} value={ok ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-stone-line bg-white p-0.5" aria-label="Χρώμα" />
      <input className="input font-mono text-sm" disabled={disabled} value={value} placeholder={placeholder} maxLength={7}
        onChange={(e) => onChange(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)} />
    </div>
  );
}
