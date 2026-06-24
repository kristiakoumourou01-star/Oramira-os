'use client';

import { useState, useTransition } from 'react';
import { Bell, Wrench, ShieldCheck, Megaphone, Check } from 'lucide-react';
import Link from 'next/link';
import { markNotificationRead, markAllNotificationsRead } from '@/app/actions/notifications';

export interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

function iconFor(title: string) {
  const t = title.toLowerCase();
  if (t.includes('warranty')) return ShieldCheck;
  if (t.includes('visit') || t.includes('contractor') || t.includes('maintenance') || t.includes('ticket')) return Wrench;
  if (t.includes('announce')) return Megaphone;
  return Bell;
}

/**
 * Notifications Center list. Reads come pre-scoped by RLS; marking read is the
 * only write, and notifications_self ensures it only ever touches the caller's
 * own rows.
 */
export function NotificationList({ initial }: { initial: NotificationRow[] }) {
  const [items, setItems] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function readOne(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    startTransition(() => markNotificationRead(id));
  }
  function readAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    startTransition(() => markAllNotificationsRead());
  }

  const unread = items.filter((n) => !n.read_at).length;

  if (items.length === 0) {
    return <p className="text-sm text-charcoal-600/70">You're all caught up — no notifications right now.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-charcoal-600/70">{unread > 0 ? `${unread} unread` : 'All read'}</p>
        {unread > 0 && (
          <button onClick={readAll} disabled={isPending} className="btn-ghost text-xs">
            <Check size={13} strokeWidth={1.75} /> Mark all read
          </button>
        )}
      </div>
      <ul className="divide-y divide-stone-line">
        {items.map((n) => {
          const Icon = iconFor(n.title);
          const body = (
            <div className={`flex items-start gap-3 py-3.5 ${!n.read_at ? '' : 'opacity-60'}`}>
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${!n.read_at ? 'bg-champagne-50 text-champagne-600' : 'bg-sand-100 text-olive'}`}>
                <Icon size={15} strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-charcoal">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-charcoal-600/80">{n.body}</p>}
                <p className="mt-0.5 text-xs text-charcoal-600/50">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-champagne" />}
            </div>
          );
          return (
            <li key={n.id} onClick={() => !n.read_at && readOne(n.id)}>
              {n.link ? <Link href={n.link} className="block">{body}</Link> : body}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
