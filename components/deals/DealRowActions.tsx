'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Copy, Trash2, Check, X } from 'lucide-react';
import { renameDeal, duplicateDeal, deleteDeal } from '@/app/actions/deals';

/** Μετονομασία / αντίγραφο / διαγραφή μιας ανάλυσης (λίστα Deal Analyzer και τίτλος). */
export function DealRowActions({ id, name, compact = false }: { id: string; name: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(name);
  const [err, setErr] = useState<string | null>(null);
  const btn = 'rounded p-1.5 text-charcoal-600/60 hover:bg-stone hover:text-charcoal disabled:opacity-40';
  if (edit) return (
    <span className="inline-flex items-center gap-1">
      <input autoFocus className="input h-8 w-56 py-1 text-sm" value={val} onChange={(e) => setVal(e.target.value)} data-no-tr
        onKeyDown={(e) => { if (e.key === 'Escape') setEdit(false); if (e.key === 'Enter') (e.currentTarget.nextSibling as HTMLButtonElement)?.click(); }} />
      <button type="button" className={btn} disabled={pending} title="Αποθήκευση" aria-label="Αποθήκευση" onClick={() => start(async () => { const r = await renameDeal(id, val); if (r.ok) { setEdit(false); router.refresh(); } else setErr(r.error); })}><Check size={15} /></button>
      <button type="button" className={btn} onClick={() => { setEdit(false); setVal(name); }} title="Άκυρο" aria-label="Άκυρο"><X size={15} /></button>
      {err && <span className="text-xs text-signal-danger">{err}</span>}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5">
      <button type="button" className={btn} disabled={pending} title="Μετονομασία" aria-label="Μετονομασία" onClick={() => setEdit(true)}><Pencil size={14} /></button>
      {!compact && <button type="button" className={btn} disabled={pending} title="Αντίγραφο" aria-label="Αντίγραφο" onClick={() => start(async () => { const r = await duplicateDeal(id); if (r.ok) router.refresh(); else setErr(r.error); })}><Copy size={14} /></button>}
      <button type="button" className={`${btn} hover:text-signal-danger`} disabled={pending} title="Διαγραφή" aria-label="Διαγραφή"
        onClick={() => { if (confirm(`Διαγραφή της ανάλυσης «${name}»; Δεν αναιρείται.`)) start(async () => { const r = await deleteDeal(id); if (r.ok) { if (compact) router.push('/deal-analyzer'); router.refresh(); } else setErr(r.error); }); }}><Trash2 size={14} /></button>
      {err && <span className="text-xs text-signal-danger">{err}</span>}
    </span>
  );
}
