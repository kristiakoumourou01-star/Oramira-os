'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

/**
 * Dropdown όπως στο FitnessCRM: μικρό κουμπί με βελάκι, αναδυόμενη λίστα με
 * απαλό animation, σημάδι ✓ στην επιλογή και (προαιρετικά) αναζήτηση μέσα.
 */
export function PopSelect({ value, onChange, options, placeholder, searchable, className = '', width = 'min-w-[150px]', ariaLabel }: {
  value: string; onChange: (v: string) => void; options: [string, string][]; placeholder?: string; searchable?: boolean; className?: string; width?: string; ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const current = options.find((o) => o[0] === value)?.[1] ?? placeholder ?? '';
  const shown = q ? options.filter((o) => o[1].toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen((o) => !o); setQ(''); }}
        className={`flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-stone-line bg-white py-1 pl-2.5 pr-2 text-[13px] text-charcoal transition-colors hover:border-forest/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/30 ${width}`}>
        <span className={`truncate ${value === '' && placeholder ? 'text-charcoal' : ''}`}>{current}</span>
        <ChevronDown size={14} className={`shrink-0 text-charcoal-600 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="listbox" className="anim-pop absolute left-0 top-[calc(100%+4px)] z-40 max-h-72 min-w-full overflow-y-auto rounded-lg bg-white p-1 shadow-md ring-1 ring-charcoal/10">
          {searchable && (
            <label className="relative mb-1 block"><Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-charcoal-600/60" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση…" className="h-8 w-full rounded-md bg-stone-50 pl-7 pr-2 text-[13px] outline-none" /></label>
          )}
          {shown.map(([v, l]) => (
            <button key={v} type="button" role="option" aria-selected={v === value} onClick={() => { onChange(v); setOpen(false); }}
              className="flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-md px-2 py-1.5 text-left text-[13px] text-charcoal transition-colors hover:bg-stone-100">
              <span>{l}</span>{v === value && <Check size={14} className="text-charcoal" />}
            </button>
          ))}
          {shown.length === 0 && <p className="px-2 py-1.5 text-[13px] text-charcoal-600">Κανένα αποτέλεσμα</p>}
        </div>
      )}
    </div>
  );
}
