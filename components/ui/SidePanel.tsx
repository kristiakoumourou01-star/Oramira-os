'use client';

import { Sparkles } from 'lucide-react';

/* Κοινά κομμάτια σελίδων όπως στο FitnessCRM: ενημέρωση (briefing) με ζωντανές μετρήσεις, κάρτες στη δεξιά στήλη, σελιδοποίηση. */

export function Briefing({ tag, title, text, metrics }: { tag: string; title: string; text: string; metrics: [string, React.ReactNode, string][] }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-forest to-forest-deep p-4 text-white shadow-[0_8px_24px_-12px_rgb(var(--c-forest)/0.6)]">
      <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"><Sparkles size={11} /> {tag}</span>
      <p className="mt-2 text-[16px] font-semibold leading-snug">{title}</p>
      <p className="mt-1 text-[13px] text-white/80">{text}</p>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/70">Ζωντανές μετρήσεις</p>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        {metrics.map(([k, v, n]) => <div key={k} className="rounded-xl border border-white/20 bg-white/10 px-2 py-2 text-center"><p className="text-[10px] font-semibold uppercase text-white/70">{k}</p><p className="font-display text-xl">{v}</p><p className="text-[10px] text-white/70">{n}</p></div>)}
      </div>
    </div>
  );
}

export function SideStat({ icon: I, label, value, note }: { icon: any; label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/[0.09] text-forest"><I size={18} /></span><div><p className="text-[13px] text-charcoal-600">{label}</p><p className="text-2xl font-semibold text-charcoal" data-no-tr>{value}</p></div></div>
      <p className="mt-2 text-[13px] leading-snug text-charcoal-600">{note}</p>
    </div>
  );
}

export function Pager({ from, to, total, page, pages, onPage }: { from: number; to: number; total: number; page: number; pages: number; onPage: (n: number) => void }) {
  const nums = Array.from(new Set([0, 1, page - 1, page, page + 1, pages - 1].filter((n) => n >= 0 && n < pages))).sort((a, b) => a - b);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-line px-5 py-3 text-sm text-charcoal-600">
      <span>{`Εμφάνιση ${from}–${to} από ${total}`}</span>
      {pages > 1 && <span className="flex items-center gap-1">
        <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className="rounded-lg border border-stone-line px-3.5 py-1.5 text-charcoal disabled:text-charcoal-600/50">Προηγούμενη</button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1">…</span>}
            <button type="button" onClick={() => onPage(n)} className={`min-w-[36px] rounded-lg px-2.5 py-1.5 tabular-nums ${n === page ? 'bg-forest text-white' : 'border border-stone-line text-charcoal hover:border-forest/40'}`}>{n + 1}</button>
          </span>
        ))}
        <button type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} className="rounded-lg border border-stone-line px-3.5 py-1.5 text-charcoal disabled:text-charcoal-600/50">Επόμενη</button>
      </span>}
    </div>
  );
}
