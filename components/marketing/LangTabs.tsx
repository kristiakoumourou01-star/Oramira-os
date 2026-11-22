'use client';

import type { MsgLang } from '@/lib/message-format-shared';

/** Μικρές καρτέλες «Ελληνικά | English» πάνω από ένα κείμενο μηνύματος. Τελεία = υπάρχει κείμενο. */
export function LangTabs({ lang, onChange, filled }: { lang: MsgLang; onChange: (l: MsgLang) => void; filled?: Partial<Record<MsgLang, boolean>> }) {
  return (
    <span className="inline-flex rounded-[10px] border border-stone-line p-0.5" role="tablist">
      {([['el', 'Ελληνικά'], ['en', 'English']] as const).map(([l, label]) => (
        <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => onChange(l)}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[12px] font-medium ${lang === l ? 'bg-forest text-white' : 'text-charcoal-600 hover:text-charcoal'}`}>
          <span {...(l === 'en' ? { 'data-no-tr': true } : {})}>{label}</span>
          {filled && <span className={`h-1.5 w-1.5 rounded-full ${filled[l] ? (lang === l ? 'bg-white' : 'bg-forest') : 'bg-stone-line'}`} />}
        </button>
      ))}
    </span>
  );
}
