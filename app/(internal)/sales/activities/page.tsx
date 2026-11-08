import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { ActivitiesView, type ActivityRow } from '@/components/sales/ActivitiesView';

export const dynamic = 'force-dynamic';

/** Sales → Activities: κλήσεις, συναντήσεις, εργασίες, προβολές — όπως στο Pipedrive. */
export default async function ActivitiesPage() {
  const profile = await requirePermission('leads');
  const supabase = await createSupabaseServerClient() as any;
  const since = new Date(Date.now() - 45 * 86400000).toISOString();
  const SEL = 'id, due_at, done_at, is_done, note, type, priority, duration_min, lead_id, assigned_to, leads(title), contacts(full_name, phone), owner:assigned_to(full_name)';
  const [open, done, { data: agents }] = await Promise.all([
    supabase.from('follow_up_tasks').select(SEL).eq('is_done', false).order('due_at').limit(1000),
    supabase.from('follow_up_tasks').select(SEL).eq('is_done', true).gte('due_at', since).order('due_at', { ascending: false }).limit(500),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales', 'management']).eq('is_active', true).order('full_name'),
  ]);
  const map = (r: any): ActivityRow => ({
    id: r.id, dueAt: r.due_at, doneAt: r.done_at ?? null, done: !!r.is_done, note: r.note ?? null, type: r.type ?? 'task', priority: r.priority ?? null, durationMin: r.duration_min ?? null,
    leadId: r.lead_id ?? null, dealTitle: r.leads?.title || r.contacts?.full_name || null, contactName: r.contacts?.full_name ?? null, phone: r.contacts?.phone ?? null,
    ownerId: r.assigned_to ?? null, ownerName: r.owner?.full_name ?? null,
  });
  const rows = [...(open.data ?? []), ...(done.data ?? [])].map(map);
  return (
    <div className="space-y-4">
      <WorkspaceHeader eyebrow="Sales" title="Activities" />
      {open.error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{open.error.message}</p>}
      <ActivitiesView rows={rows} agents={(agents ?? []) as any} currentUserId={profile.id} />
    </div>
  );
}
