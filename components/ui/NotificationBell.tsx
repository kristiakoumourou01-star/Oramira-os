'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Notification bell, shared across every role's TopBar. Reads from the
 * `notifications` table (RLS already scopes this to the signed-in user —
 * see Phase 3, `notifications_self` policy) and subscribes to realtime
 * inserts so new alerts (defect reported, milestone complete, lead
 * assigned…) appear without a page refresh.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase
      .from('notifications')
      .select('id, title, body, link, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setItems(data ?? []));

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => setItems((prev) => [payload.new as NotificationRow, ...prev].slice(0, 10))
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded p-2 text-charcoal-600 transition-colors hover:bg-sand-100"
        aria-label="Notifications"
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-champagne px-1 text-[10px] font-medium text-forest-deep">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-20 w-80 panel p-2">
          <p className="px-2 py-1.5 text-xs uppercase tracking-eyebrow text-olive">Notifications</p>
          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-charcoal-600/70">Nothing yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? '#'}
                    className={`block rounded px-2 py-2 text-sm hover:bg-stone ${
                      !n.read_at ? 'bg-champagne-50/60' : ''
                    }`}
                  >
                    <p className="font-medium text-charcoal">{n.title}</p>
                    {n.body && <p className="text-charcoal-600/80">{n.body}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
