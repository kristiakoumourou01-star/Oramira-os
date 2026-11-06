'use client';

import { useMemo, useState } from 'react';
import { Phone, MessageCircle, Mail, Users, FileText, Flag, StickyNote, Search, Activity } from 'lucide-react';
import { formatDayMonthTime } from '@/lib/format';

export interface TimelineEntry { id: string; at: string; kind: string; title: string; detail?: string | null }

const ICON: Record<string, any> = { phone: Phone, whatsapp: MessageCircle, email: Mail, meeting: Users, document: FileText, stage: Flag, note: StickyNote };
const TONE: Record<string, string> = { phone: 'text-sky-600', whatsapp: 'text-forest', email: 'text-violet-600', meeting: 'text-champagne-600', document: 'text-olive', stage: 'text-forest', note: 'text-charcoal-600/60' };

/** Full acquisition timeline — every touch, document and status change, in
 *  reverse-chronological order, with a live search. */
export function ParcelTimeline({ entries }: { entries: TimelineEntry[] }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const arr = t ? entries.filter((e) => `${e.title} ${e.detail ?? ''} ${e.kind}`.toLowerCase().includes(t)) : entries;
    return [...arr].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [entries, q]);

  return (
    <div className="panel p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-charcoal"><Activity size={16} className="text-forest" strokeWidth={1.85} /> Timeline</h4>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-44 rounded-lg border border-stone-line bg-white py-1.5 pl-7 pr-2 text-sm focus-visible:border-forest focus-visible:outline-none" />
        </div>
      </div>

      {filtered.length === 0 ? <p className="text-sm text-charcoal-600/60">{q ? 'No matching events.' : 'No activity yet.'}</p> : (
        <ol className="relative space-y-3 before:absolute before:left-[9px] before:top-1 before:h-[calc(100%-8px)] before:w-px before:bg-stone-line">
          {filtered.map((e) => {
            const Icon = ICON[e.kind] ?? StickyNote;
            return (
              <li key={e.id} className="relative flex gap-3 pl-0">
                <span className={`z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-stone-line ${TONE[e.kind] ?? 'text-charcoal-600/60'}`}><Icon size={11} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2"><p className="text-sm text-charcoal">{e.title}</p><span className="figure shrink-0 text-[11px] text-charcoal-600/45">{formatDayMonthTime(new Date(e.at))}</span></div>
                  {e.detail && <p className="text-xs text-charcoal-600/65">{e.detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
