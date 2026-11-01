import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import type { ViewAsUser, ViewAsEvent } from '@/lib/view-as-shared';

/** Everyone an admin can view the system as, with email and roles. Admin pages only. */
export async function loadViewAsData(selfId: string): Promise<{ users: ViewAsUser[]; history: ViewAsEvent[] }> {
  const svc = createSupabaseServiceRoleClient();
  const [{ data: people }, { data: log }] = await Promise.all([
    svc.from('profiles').select('id, full_name, role, is_active, custom_role, job_title').order('full_name'),
    svc.from('activity_log').select('entity_id, action, actor_id, metadata, created_at').eq('entity_type', 'impersonation').order('created_at', { ascending: false }).limit(30),
  ]);
  const emails = new globalThis.Map<string, string>();
  try {
    const { data } = await svc.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? []) if (u.email) emails.set(u.id, u.email);
  } catch { /* service key missing — no emails */ }
  const names = new globalThis.Map<string, string>(((people ?? []) as any[]).map((p) => [p.id, p.full_name ?? '—']));
  const users: ViewAsUser[] = ((people ?? []) as any[])
    .filter((p) => p.id !== selfId)
    .map((p) => ({ id: p.id, name: p.full_name ?? 'Χωρίς όνομα', email: emails.get(p.id) ?? null, role: String(p.role), customRole: p.custom_role ?? null, title: p.job_title ?? null, active: p.is_active !== false }));
  const history: ViewAsEvent[] = ((log ?? []) as any[]).map((r) => ({
    at: r.created_at,
    started: r.action === 'impersonation_started',
    by: r.actor_id ? names.get(r.actor_id) ?? '—' : '—',
    target: r.action === 'impersonation_started' ? (r.metadata?.targetName ?? names.get(r.entity_id) ?? '—') : null,
  }));
  return { users, history };
}
