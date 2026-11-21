'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { reapplyLiveBrand } from '@/lib/brand-live';

type Theme = 'light' | 'dark' | 'system';
const KEY = 'oramira:display';
const OPTS: { v: Theme; label: string; icon: typeof Sun }[] = [
  { v: 'light', label: 'Ανοιχτό', icon: Sun },
  { v: 'dark', label: 'Σκούρο', icon: Moon },
  { v: 'system', label: 'Όπως η συσκευή', icon: Monitor },
];

function read(): Theme {
  try { const p = JSON.parse(localStorage.getItem(KEY) || '{}'); return p.theme === 'dark' || p.theme === 'system' ? p.theme : 'light'; } catch { return 'light'; }
}
function apply(t: Theme) {
  let cur: any = {};
  try { cur = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* */ }
  try { localStorage.setItem(KEY, JSON.stringify({ ...cur, theme: t })); } catch { /* private mode */ }
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  reapplyLiveBrand();
}

/** Γρήγορη αλλαγή θέματος από την πάνω μπάρα: Ανοιχτό / Σκούρο / Όπως η συσκευή. */
export function ThemeMenu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setTheme(read()); }, []);
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => apply('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const Cur = OPTS.find((o) => o.v === theme)?.icon ?? Sun;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Θέμα" title="Θέμα" aria-expanded={open}
        className={`flex h-9 w-9 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-stone hover:text-charcoal ${open ? 'bg-stone text-charcoal' : ''}`}>
        <Cur size={18} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-stone-line bg-white p-1.5 shadow-overlay">
          {OPTS.map((o) => (
            <button key={o.v} type="button" role="menuitemradio" aria-checked={theme === o.v}
              onClick={() => { setTheme(o.v); apply(o.v); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${theme === o.v ? 'bg-forest/[0.08] font-medium text-forest' : 'text-charcoal hover:bg-stone'}`}>
              <span className="w-4">{theme === o.v && <Check size={14} strokeWidth={2.5} />}</span>
              <o.icon size={16} /> {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
