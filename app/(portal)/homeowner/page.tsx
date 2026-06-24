import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHomeownerUnit } from '@/lib/homeowner';
import Link from 'next/link';
import { Home, Wrench, ShieldCheck, FileText, History, HardHat, Bell, ArrowRight, Megaphone } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function HomeownerOverviewPage() {
  const profile = await requireRole(['homeowner', 'admin', 'sales', 'management']);
  const unit = await getHomeownerUnit(profile.contactId);

  if (!unit) {
    return (
      <div className="space-y-8">
        <div>
          <p className="eyebrow mb-1">Your home</p>
          <h1 className="font-display text-3xl">Welcome{profile.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}</h1>
        </div>
        <EmptyState
          icon={Home}
          title="Your home isn't linked yet"
          description="Once your handover is complete, your maintenance, warranties, and full property history will live here."
        />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ count: openTickets }, { count: activeWarranties }, { data: notifications }, { data: announcement }] = await Promise.all([
    supabase.from('maintenance_tickets').select('id', { count: 'exact', head: true }).eq('unit_id', unit.id).not('status', 'in', '("resolved","closed")'),
    supabase.from('warranties').select('id', { count: 'exact', head: true }).eq('unit_id', unit.id).gte('ends_on', new Date().toISOString().slice(0, 10)),
    supabase.from('notifications').select('id, title, body, link, read_at, created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(4),
    supabase.from('announcements').select('id, title, body, published_at').or(`project_id.is.null,project_id.eq.${unit.project_id}`).order('published_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const tiles = [
    { href: '/homeowner/maintenance', label: 'Maintenance', icon: Wrench, hint: openTickets ? `${openTickets} open` : 'All clear' },
    { href: '/homeowner/warranty', label: 'Warranty Center', icon: ShieldCheck, hint: activeWarranties ? `${activeWarranties} active` : 'View cover' },
    { href: '/homeowner/contractor', label: 'Contractor', icon: HardHat, hint: 'Visits & schedule' },
    { href: '/homeowner/documents', label: 'Home Documents', icon: FileText, hint: 'Manuals & legal' },
    { href: '/homeowner/history', label: 'Property History', icon: History, hint: 'Contract to handover' },
    { href: '/homeowner/notifications', label: 'Notifications', icon: Bell, hint: 'Updates & reminders' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-1">Your home</p>
        <h1 className="font-display text-3xl">Welcome home{profile.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}</h1>
      </div>

      <div className="overflow-hidden rounded-md bg-forest p-8 text-stone-100 shadow-soft">
        <p className="text-[11px] uppercase tracking-eyebrow text-champagne">{unit.project_name}{unit.project_location ? ` · ${unit.project_location}` : ''}</p>
        <h2 className="mt-1 font-display text-3xl text-stone-100">Unit {unit.unit_number}</h2>
        <p className="mt-2 text-sm text-stone-100/70">
          {[unit.building_name, unit.bedrooms != null ? `${unit.bedrooms} bed` : null, unit.sqm != null ? `${unit.sqm} m²` : null].filter(Boolean).join('  ·  ')}
          {unit.moved_in_at ? `  ·  Since ${new Date(unit.moved_in_at).toLocaleDateString()}` : ''}
        </p>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-stone-100/60">
          Welcome to your dedicated after-sales space. Anything your home needs — a repair, a warranty question,
          a document — your Oramira team is one tap away.
        </p>
      </div>

      {announcement && (
        <Link href="/homeowner/notifications" className="panel flex items-start gap-3 p-5 transition-shadow hover:shadow-overlay">
          <Megaphone size={18} className="mt-0.5 shrink-0 text-champagne-600" strokeWidth={1.75} />
          <div className="flex-1">
            <p className="text-sm font-medium text-charcoal">{announcement.title}</p>
            <p className="mt-0.5 line-clamp-2 text-sm text-charcoal-600/80">{announcement.body}</p>
          </div>
          <ArrowRight size={15} className="mt-1 shrink-0 text-charcoal-600/40" strokeWidth={1.75} />
        </Link>
      )}

      <div className="grid grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="panel flex items-center gap-4 p-5 transition-shadow hover:shadow-overlay">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sand-100 text-forest">
              <t.icon size={18} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-medium text-charcoal">{t.label}</p>
              <p className="text-xs text-charcoal-600/60">{t.hint}</p>
            </div>
          </Link>
        ))}
      </div>

      {(notifications ?? []).length > 0 && (
        <div className="panel p-6">
          <h4 className="mb-4">Recent activity</h4>
          <ul className="divide-y divide-stone-line">
            {(notifications ?? []).map((n) => (
              <li key={n.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm text-charcoal">{n.title}</p>
                  <p className="text-xs text-charcoal-600/50">{new Date(n.created_at).toLocaleDateString()}</p>
                </div>
                {!n.read_at && <span className="h-2 w-2 rounded-full bg-champagne" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
