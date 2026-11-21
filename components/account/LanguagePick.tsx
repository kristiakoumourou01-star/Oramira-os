'use client';

import { useState, useTransition } from 'react';
import { setMyLocale } from '@/app/actions/locale';
import { LANGS, type Lang, type NumFmt } from '@/lib/locale-shared';

/** Ο λογαριασμός μου → Πληροφορίες: η γλώσσα της εφαρμογής για εμένα (όπως στο FitnessCRM). */
export function LanguagePick({ lang, num }: { lang: Lang; num: NumFmt }) {
  const [cur, setCur] = useState(lang);
  const [pending, start] = useTransition();
  return (
    <div className="rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
      <p className="font-semibold text-charcoal">Γλώσσα</p>
      <p className="mb-3 text-sm text-charcoal-600/75">Η εφαρμογή αλλάζει γλώσσα αμέσως και τη θυμάται ο λογαριασμός σας.</p>
      <div className="flex flex-wrap gap-1.5">
        {LANGS.map((l) => (
          <button key={l.value} type="button" disabled={pending} aria-pressed={cur === l.value} data-no-tr
            onClick={() => { setCur(l.value); start(async () => { const r = await setMyLocale(l.value, num); if (r.ok) window.location.reload(); }); }}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] transition ${cur === l.value ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/40'}`}>{l.label}</button>
        ))}
      </div>
      <p className="mt-3 text-xs text-charcoal-600/70">Η ζώνη ώρας ορίζεται για όλη την εταιρεία στις Ρυθμίσεις.</p>
    </div>
  );
}
