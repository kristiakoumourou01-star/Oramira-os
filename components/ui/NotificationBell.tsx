'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { t } from '@/lib/i18n';
import { markAllNotificationsRead } from '@/app/actions/notifications';
import { readNotifPrefs, writeNotifPrefs, playChime, NOTIF_PREFS_EVENT, type NotifPrefs } from '@/lib/notify-prefs-shared';

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
/* Per-person, per-device preferences (kept in this browser only) — also editable in Settings → Ειδοποιήσεις. */
type Prefs = NotifPrefs;
const readPrefs = readNotifPrefs;
const writePrefs = writeNotifPrefs;
const chime = () => playChime(readNotifPrefs().volume);

export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  // Όσα ήταν αδιάβαστα όταν άνοιξε η λίστα: μένουν τονισμένα μέχρι να κλείσει.
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const boxRef = useRef<HTMLDivElement>(null);
  const toggle = () => {
    if (open) { setOpen(false); setFresh(new Set()); return; }
    const unread = items.filter((n) => !n.read_at).map((n) => n.id);
    setOpen(true);
    if (unread.length) {
      setFresh(new Set(unread));
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now }))); // ο αριθμός φεύγει αμέσως
      void markAllNotificationsRead().catch(() => null);
    }
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) { setOpen(false); setFresh(new Set()); } };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setFresh(new Set()); } };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const [prefs, setPrefs] = useState<Prefs>({ sound: false, desktop: false, volume: 75 });
  const prefsRef = useRef(prefs);
  useEffect(() => {
    const load = () => { const p = readPrefs(); setPrefs(p); prefsRef.current = p; };
    load();
    window.addEventListener(NOTIF_PREFS_EVENT, load); window.addEventListener('storage', load);
    return () => { window.removeEventListener(NOTIF_PREFS_EVENT, load); window.removeEventListener('storage', load); };
  }, []);
  const updatePrefs = async (p: Prefs) => {
    if (p.desktop && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const r = await Notification.requestPermission().catch(() => 'denied');
      if (r !== 'granted') p = { ...p, desktop: false };
    }
    setPrefs(p); prefsRef.current = p; writePrefs(p);
    if (p.sound) chime();
  };
  const announce = (n: NotificationRow) => {
    const p = prefsRef.current;
    if (p.sound) chime();
    if (p.desktop && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      try {
        const d = new Notification(n.title, { body: n.body ?? undefined, tag: n.id });
        d.onclick = () => { window.focus(); if (n.link) window.location.href = n.link; };
      } catch { /* not supported */ }
    }
  };

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    supabase
      .from('notifications')
      .select('id, title, body, link, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setItems(data ?? []));

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => { setItems((prev) => [payload.new as NotificationRow, ...prev].slice(0, 20)); announce(payload.new as NotificationRow); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={toggle}
        className="relative rounded p-2 text-charcoal-600 transition-colors hover:bg-sand-100"
        aria-label={t('notifications')}
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-champagne px-1 text-[10px] font-medium text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-20 w-80 panel p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-xs uppercase tracking-eyebrow text-olive">{t('notifications')}</p>
            <div className="flex gap-3 text-[11px] text-charcoal-600">
              <label className="flex items-center gap-1" title="Ήχος σε κάθε νέα ειδοποίηση (σε αυτή τη συσκευή)"><input type="checkbox" checked={prefs.sound} onChange={(e) => updatePrefs({ ...prefs, sound: e.target.checked })} /> {t('sound')}</label>
              <label className="flex items-center gap-1" title="Ειδοποίηση του υπολογιστή όταν η καρτέλα δεν είναι μπροστά"><input type="checkbox" checked={prefs.desktop} onChange={(e) => updatePrefs({ ...prefs, desktop: e.target.checked })} /> {t('desktop')}</label>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-charcoal-600/70">{t('nothingYet')}</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? '#'}
                    className={`block rounded px-2 py-2 text-sm hover:bg-stone ${
                      !n.read_at || fresh.has(n.id) ? 'bg-champagne-50/60' : ''
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
