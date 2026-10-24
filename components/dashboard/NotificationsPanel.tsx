'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BellOff } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

export interface NotificationItem { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }

type Cat = 'all' | 'internal' | 'sales' | 'hr' | 'finance' | 'property';
const TABS: { v: Cat; label: string }[] = [
  { v: 'all', label: 'All' }, { v: 'sales', label: 'Sales' }, { v: 'hr', label: 'HR' }, { v: 'finance', label: 'Finance' }, { v: 'property', label: 'Property' }, { v: 'internal', label: 'Internal' },
];

/** Categorise a notification by its target link. */
function categorize(link: string | null): Exclude<Cat, 'all'> {
  const l = link ?? '';
  if (l.startsWith('/crm')) return 'sales';
  if (l.startsWith('/hr') || l.startsWith('/payslips')) return 'hr';
  if (l.startsWith('/financials')) return 'finance';
  if (l.startsWith('/property') || l.startsWith('/projects')) return 'property';
  return 'internal';
}

export function NotificationsPanel({ notifications }: { notifications: NotificationItem[] }) {
  const [tab, setTab] = useState<Cat>('all');
  const tagged = useMemo(() => notifications.map((n) => ({ ...n, cat: categorize(n.link) })), [notifications]);
  const unreadByCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of tagged) if (!n.read_at) m[n.cat] = (m[n.cat] ?? 0) + 1;
    return m;
  }, [tagged]);
  const totalUnread = tagged.filter((n) => !n.read_at).length;
  const visible = tab === 'all' ? tagged : tagged.filter((n) => n.cat === tab);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {TABS.map((t) => {
          const count = t.v === 'all' ? totalUnread : unreadByCat[t.v] ?? 0;
          return (
            <button key={t.v} onClick={() => setTab(t.v)} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${tab === t.v ? 'bg-forest text-white' : 'bg-[#F5F1E8] text-charcoal-600 hover:bg-[#EFE8DA]'}`}>
              {t.label}
              {count > 0 && <span className={`rounded-full px-1 text-[9px] ${tab === t.v ? 'bg-white/25 text-white' : 'bg-champagne-600 text-white'}`}>{count}</span>}
            </button>
          );
        })}
      </div>
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-champagne/30 bg-champagne-50/40 p-5 text-center">
          <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-champagne-50 text-champagne-600"><BellOff size={16} strokeWidth={1.8} /></span>
          <p className="text-sm font-medium text-charcoal">You’re all caught up.</p>
          <p className="mt-1 text-xs text-charcoal-600/60">Alerts about leads, approvals, payments and maintenance will appear here as the system flags them.</p>
        </div>
      ) : (
        <ul className="-mr-1 max-h-64 divide-y divide-[#F0EADF] overflow-y-auto pr-1">
          {visible.map((n) => {
            const row = (
              <div className={`py-2 ${n.read_at ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2">
                  {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-champagne-600" />}
                  <p className="text-sm text-charcoal">{n.title}</p>
                </div>
                {n.body && <p className="truncate pl-3.5 text-xs text-charcoal-600/70">{n.body}</p>}
                <p className="pl-3.5 text-[10px] text-charcoal-600/50">{formatDateTime(new Date(n.created_at))}</p>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block">{row}</Link> : row}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
