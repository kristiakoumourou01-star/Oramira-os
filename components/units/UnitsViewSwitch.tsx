'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';

/** Εναλλαγή «Λίστα» / «Πρόσοψη» για τις μονάδες του έργου (θυμάται την επιλογή). */
export function UnitsViewSwitch({ table, board }: { table: React.ReactNode; board: React.ReactNode }) {
  const [view, setView] = useState<'list' | 'board'>('list');
  useEffect(() => { try { const v = localStorage.getItem('units:view'); if (v === 'list' || v === 'board') setView(v); } catch { /* */ } }, []);
  const pick = (v: 'list' | 'board') => { setView(v); try { localStorage.setItem('units:view', v); } catch { /* */ } };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <span className="flex rounded-lg bg-stone-100 p-0.5">
          {([['list', List, 'Λίστα'], ['board', LayoutGrid, 'Πρόσοψη']] as const).map(([v, I, l]) => (
            <button key={v} type="button" onClick={() => pick(v)} aria-pressed={view === v} className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors ${view === v ? 'bg-forest font-medium text-white shadow-sm' : 'text-charcoal-600 hover:text-charcoal'}`}><I size={14} /><span>{l}</span></button>
          ))}
        </span>
      </div>
      {view === 'list' ? table : board}
    </div>
  );
}
