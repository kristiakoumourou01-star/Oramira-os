'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Globe } from 'lucide-react';
import { setMyLocale } from '@/app/actions/locale';
import { currentLocale, LANGS, NUM_FORMATS, type LocalePrefs } from '@/lib/locale-shared';
import { t } from '@/lib/i18n';

/** Top bar: my language (EL / EN / RU) and number format. Saved on my account. */
export function LocaleSwitcher() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState<LocalePrefs | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { setCur(currentLocale()); }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const choose = (p: LocalePrefs) => start(async () => {
    const r = await setMyLocale(p.lang, p.num);
    if (r.ok) window.location.reload();
  });
  const short = LANGS.find((l) => l.value === cur?.lang)?.short ?? '';

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={pending} className="flex items-center gap-1 rounded p-2 text-[11px] font-medium text-charcoal-600 hover:bg-sand-100" title={cur ? t('language', cur.lang) : undefined}>
        <Globe size={15} strokeWidth={1.75} /> {short}
      </button>
      {open && cur && (
        <div className="absolute right-0 top-11 z-30 w-56 panel space-y-3 p-3">
          <div>
            <p className="eyebrow mb-1">{t('language', cur.lang)}</p>
            {LANGS.map((l) => (
              <button key={l.value} type="button" disabled={pending} onClick={() => choose({ ...cur, lang: l.value })}
                className={`block w-full rounded px-2 py-1.5 text-left text-sm ${cur.lang === l.value ? 'bg-forest/[0.07] font-medium text-forest' : 'text-charcoal hover:bg-stone'}`}>
                {l.label}
              </button>
            ))}
          </div>
          <div>
            <p className="eyebrow mb-1">{t('numbers', cur.lang)}</p>
            {NUM_FORMATS.map((n) => (
              <button key={n.value} type="button" disabled={pending} onClick={() => choose({ ...cur, num: n.value })}
                className={`block w-full rounded px-2 py-1.5 text-left font-mono text-sm ${cur.num === n.value ? 'bg-forest/[0.07] text-forest' : 'text-charcoal hover:bg-stone'}`}>
                {n.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
