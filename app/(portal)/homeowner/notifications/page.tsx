import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHomeownerUnit } from '@/lib/homeowner';
import { ShieldAlert, Megaphone } from 'lucide-react';
import { NotificationList, type NotificationRow } from '@/components/homeowner/NotificationList';
import { formatDate } from '@/lib/format';

export default async function NotificationsCenterPage() {
  const profile = await requireRole(['homeowner', 'admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();
  const unit = await getHomeownerUnit(profile.contactId);

  const [{ data: notifications }, warrantyRes, announcementRes] = await Promise.all([
    supabase.from('notifications').select('id, title, body, link, read_at, created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(50),
    unit
      ? supabase.from('warranties').select('id, category, ends_on').eq('unit_id', unit.id).order('ends_on')
      : Promise.resolve({ data: [] as { id: string; category: string; ends_on: string }[] }),
    unit
      ? supabase.from('announcements').select('id, title, body, published_at').or(`project_id.is.null,project_id.eq.${unit.project_id}`).order('published_at', { ascending: false }).limit(5)
      : Promise.resolve({ data: [] as { id: string; title: string; body: string; published_at: string }[] }),
  ]);

  // Derived warranty-expiry reminders (within 3 months) — computed, not stored,
  // so they're always accurate without a cron writing rows.
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + 3);
  const expiring = (warrantyRes.data ?? []).filter((w) => {
    const end = new Date(w.ends_on);
    return end >= new Date() && end <= horizon;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Stay informed</p>
        <h1 className="font-display text-3xl">Notifications</h1>
      </div>

      {expiring.length > 0 && (
        <div className="panel p-6">
          <h4 className="mb-4 flex items-center gap-2"><ShieldAlert size={15} className="text-signal-warning" strokeWidth={1.75} /> Warranty reminders</h4>
          <ul className="divide-y divide-stone-line">
            {expiring.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2.5">
                <p className="text-sm capitalize text-charcoal">{w.category} warranty</p>
                <p className="text-xs text-charcoal-600/70">Expires <span className="figure">{formatDate(w.ends_on)}</span></p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel p-6">
        <h4 className="mb-4">Your notifications</h4>
        <NotificationList initial={(notifications ?? []) as NotificationRow[]} />
      </div>

      {(announcementRes.data ?? []).length > 0 && (
        <div className="panel p-6">
          <h4 className="mb-4 flex items-center gap-2"><Megaphone size={15} className="text-champagne-600" strokeWidth={1.75} /> Announcements</h4>
          <ul className="space-y-4">
            {(announcementRes.data ?? []).map((a) => (
              <li key={a.id} className="border-b border-stone-line pb-4 last:border-0 last:pb-0">
                <p className="text-sm font-medium text-charcoal">{a.title}</p>
                <p className="mt-0.5 text-sm text-charcoal-600/80">{a.body}</p>
                <p className="mt-1 text-xs text-charcoal-600/50">{formatDate(a.published_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
