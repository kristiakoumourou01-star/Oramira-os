import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { ActivitiesView, type ActivityRow } from '@/components/sales/ActivitiesView';

export const dynamic = 'force-dynamic';

/** Sales → Activities: κλήσεις, συναντήσεις, εργασίες, προβολές — όπως στο Pipedrive. */
export default async function ActivitiesPage({ searchParams }: { searchParams: { type?: string } }) {
  const profile = await requirePermission('leads');
  const supabase = await createSupabaseServerClient() as any;
  const since = new Date(Date.now() - 45 * 86400000).toISOString();
  const SEL = 'id, due_at, done_at, is_done, note, type, priority, duration_min, lead_id, assigned_to, leads(title), contacts(full_name, phone), owner:assigned_to(full_name)';
  const [open, done, { data: agents }, { data: viewings }] = await Promise.all([
    supabase.from('follow_up_tasks').select(SEL).eq('is_done', false).order('due_at').limit(1000),
    supabase.from('follow_up_tasks').select(SEL).eq('is_done', true).gte('due_at', since).order('due_at', { ascending: false }).limit(500),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales', 'management']).eq('is_active', true).order('full_name'),
    supabase.from('viewings').select('id, scheduled_at, status, notes, lead_id, agent_id, contacts(full_name, phone), units(unit_number), projects(name), agent:agent_id(full_name), leads(title)').gte('scheduled_at', since).order('scheduled_at').limit(500),
  ]);
  const VST: Record<string, string> = { scheduled: 'Προγραμματισμένη', confirmed: 'Επιβεβαιωμένη', attended: 'Έγινε', completed: 'Έγινε', no_show: 'Δεν ήρθε', cancelled: 'Ακυρώθηκε', rescheduled: 'Αλλαγή ώρας' };
  const map = (r: any): ActivityRow => ({
    id: r.id, dueAt: r.due_at, doneAt: r.done_at ?? null, done: !!r.is_done, note: r.note ?? null, type: r.type ?? 'task', priority: r.priority ?? null, durationMin: r.duration_min ?? null,
    leadId: r.lead_id ?? null, dealTitle: r.leads?.title || r.contacts?.full_name || null, contactName: r.contacts?.full_name ?? null, phone: r.contacts?.phone ?? null,
    ownerId: r.assigned_to ?? null, ownerName: r.owner?.full_name ?? null,
  });
  const viewingRows: ActivityRow[] = ((viewings ?? []) as any[]).map((v) => ({
    id: `v:${v.id}`, dueAt: v.scheduled_at, doneAt: null, done: ['attended', 'completed', 'no_show', 'cancelled'].includes(v.status), readOnly: true, statusLabel: VST[v.status] ?? v.status,
    note: `Προβολή${v.projects?.name ? ` · ${v.projects.name}` : ''}${v.units?.unit_number ? ` ${v.units.unit_number}` : ''}`, type: 'viewing', priority: null, durationMin: null,
    leadId: v.lead_id ?? null, dealTitle: v.leads?.title || v.contacts?.full_name || null, contactName: v.contacts?.full_name ?? null, phone: v.contacts?.phone ?? null,
    ownerId: v.agent_id ?? null, ownerName: v.agent?.full_name ?? null,
  }));
  const rows = [...(open.data ?? []), ...(done.data ?? [])].map(map).concat(viewingRows);
  return (
    <div className="space-y-4">
      <WorkspaceHeader eyebrow="Sales" title="Activities" />
      {open.error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{open.error.message}</p>}
      <ActivitiesView rows={rows} agents={(agents ?? []) as any} currentUserId={profile.id} initialTypes={searchParams.type ? [searchParams.type] : []} />
    </div>
  );
}
