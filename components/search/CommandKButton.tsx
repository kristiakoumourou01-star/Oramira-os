'use client';

import { Search } from 'lucide-react';
import { t } from '@/lib/i18n';

/** Topbar search field that opens the ⌘K command palette. */
export function CommandKButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
      className="group flex w-full max-w-sm items-center gap-2.5 rounded-xl bg-[#F5F1E8]/70 px-3.5 py-1.5 text-sm text-charcoal-600/70 shadow-[inset_0_0_0_1px_rgba(31,77,58,0.06)] transition-all duration-200 hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(31,77,58,0.14),0_4px_14px_rgba(31,77,58,0.06)]"
    >
      <Search size={15} strokeWidth={1.85} className="text-forest/70" />
      <span>{t('search')}</span>
      <span className="ml-auto rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-charcoal-600/55 shadow-[inset_0_0_0_1px_rgba(31,77,58,0.08)]">⌘K</span>
    </button>
  );
}
