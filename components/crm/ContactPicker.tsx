'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { Search, X, Check } from 'lucide-react';

export interface PickerContact {
  id: string; full_name: string | null; email: string | null; phone?: string | null; nationality?: string | null; preferred_language?: string | null;
  tags?: string[] | null; groups?: string[] | null; custom_fields?: Record<string, unknown> | null;
  is_lead?: boolean | null; is_buyer?: boolean | null; is_investor?: boolean | null; is_homeowner?: boolean | null;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const digits = (s: string) => s.replace(/\D/g, '');
const hay = (c: PickerContact) => norm([c.full_name, c.email, c.phone, c.nationality, c.preferred_language, ...(c.tags ?? []), ...(c.groups ?? []),
  ...Object.values(c.custom_fields ?? {}).map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')))].filter(Boolean).join(' '));
const roles = (c: PickerContact) => [c.is_buyer && 'Αγοραστής', c.is_investor && 'Επενδυτής', c.is_lead && 'Lead', c.is_homeowner && 'Ιδιοκτήτης'].filter(Boolean) as string[];

/**
 * Αναζήτηση πελάτη σε όλα τα στοιχεία της επαφής (όνομα, email, τηλέφωνο,
 * εθνικότητα, γλώσσα, tags, ομάδες, πρόσθετα πεδία). Γράφει το id σε κρυφό input `name`.
 */
export function ContactPicker({ contacts, name, required, placeholder = 'Αναζήτηση: όνομα, τηλέφωνο, email, tag…' }: { contacts: PickerContact[]; name: string; required?: boolean; placeholder?: string }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<PickerContact | null>(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const index = useMemo(() => contacts.map((c) => ({ c, h: hay(c), d: digits(c.phone ?? '') })), [contacts]);
  const results = useMemo(() => {
    const t = norm(q.trim()); if (!t) return contacts.slice(0, 30);
    const words = t.split(/\s+/); const dq = digits(q);
    return index.filter(({ h, d }) => words.every((w) => h.includes(w)) || (dq.length >= 3 && d.includes(dq))).slice(0, 30).map((x) => x.c);
  }, [q, index, contacts]);
  const pick = (c: PickerContact) => { setSel(c); setQ(''); setOpen(false); };

  return (
    <div ref={box} className="relative mt-1">
      <input type="hidden" name={name} value={sel?.id ?? ''} />
      {sel ? (
        <div className="input flex items-center justify-between gap-2">
          <span className="min-w-0 truncate" data-no-tr><b className="font-medium text-charcoal">{sel.full_name ?? sel.email}</b> <span className="text-xs text-charcoal-600/70">{[sel.phone, sel.email].filter(Boolean).join(' · ')}</span></span>
          <button type="button" onClick={() => { setSel(null); setOpen(true); }} aria-label="Αλλαγή" className="shrink-0 text-charcoal-600/60 hover:text-charcoal"><X size={15} /></button>
        </div>
      ) : (
        <label className="relative block">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" />
          <input className="input pl-9" value={q} placeholder={placeholder} required={required && !sel} onFocus={() => setOpen(true)}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
            onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); } if (e.key === 'Enter' && open && results[hi]) { e.preventDefault(); pick(results[hi]); } if (e.key === 'Escape') setOpen(false); }} />
        </label>
      )}
      {open && !sel && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-stone-line bg-white py-1 shadow-overlay">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-charcoal-600/70">Δεν βρέθηκε επαφή.</li>}
          {results.map((c, i) => (
            <li key={c.id}>
              <button type="button" onMouseEnter={() => setHi(i)} onClick={() => pick(c)} className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left ${i === hi ? 'bg-forest/[0.06]' : ''}`}>
                <span className="min-w-0" data-no-tr>
                  <span className="block truncate text-sm font-medium text-charcoal">{c.full_name ?? c.email ?? '—'}</span>
                  <span className="block truncate text-xs text-charcoal-600/70">{[c.phone, c.email, c.nationality, ...(c.tags ?? []).slice(0, 2)].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="flex shrink-0 gap-1">{roles(c).slice(0, 2).map((r) => <span key={r} className="badge-neutral text-[10px]">{r}</span>)}{i === hi && <Check size={14} className="text-forest" />}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
