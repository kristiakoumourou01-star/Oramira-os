import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { INTERNAL_ROLES } from '@/lib/permissions';
import { isCalendarConnected } from '@/lib/calendar-sync';
import { getCalendarFeed } from '@/lib/calendar-feed';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { CalendarView } from '@/components/calendar/CalendarView';

export const dynamic = 'force-dynamic';

type View = 'day' | 'week' | 'month';

const p2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

/** Load window [from, to] covering the view, padded a day each side so no event
 *  near a timezone boundary is dropped (the client filters to exact local days). */
function windowFor(anchor: Date, view: View): { from: Date; to: Date } {
  if (view === 'day') return { from: addDays(anchor, -1), to: addDays(anchor, 2) };
  if (view === 'week') { const s = mondayOf(anchor); return { from: addDays(s, -1), to: addDays(s, 8) }; }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = mondayOf(first);
  return { from: addDays(gridStart, -1), to: addDays(gridStart, 43) };
}

export default async function CalendarPage({ searchParams }: { searchParams: { date?: string; view?: string } }) {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const view: View = searchParams.view === 'day' || searchParams.view === 'month' ? searchParams.view : 'week';
  const anchor = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? new Date(`${searchParams.date}T00:00:00`) : new Date();
  const date = ymd(anchor);
  const { from, to } = windowFor(anchor, view);

  const [items, conn, projectsRes, leadsRes, teamRes] = await Promise.all([
    getCalendarFeed(profile.id, from.toISOString(), to.toISOString()),
    isCalendarConnected(profile.id),
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('leads').select('id, full_name, contact_id').order('created_at', { ascending: false }).limit(200),
    supabase.from('profiles').select('id, full_name, avatar_url, contacts(email)').in('role', INTERNAL_ROLES).order('full_name'),
  ]);

  const projects = (projectsRes?.data ?? []).map((p) => ({ id: p.id, name: p.name }));
  const leads = (leadsRes?.data ?? []).map((l: any) => ({ id: l.id, name: l.full_name ?? 'Lead', contactId: l.contact_id ?? null }));
  const team = (teamRes?.data ?? []).map((m: any) => ({ id: m.id, name: m.full_name ?? 'Team member', email: m.contacts?.email ?? '', avatar_url: m.avatar_url ?? null }));

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        eyebrow="Workspace"
        title="Calendar"
        description="Ραντεβού, viewings και Google Calendar σε μία προβολή — ημέρα/εβδομάδα/μήνας, με μετάβαση σε οποιαδήποτε μέρα."
      />
      <CalendarView
        date={date}
        view={view}
        items={items}
        leads={leads}
        projects={projects}
        team={team}
        googleConnected={conn.connected}
        googleConfigured={conn.configured}
      />
    </div>
  );
}
