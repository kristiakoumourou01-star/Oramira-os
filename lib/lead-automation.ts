import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import type { TeamMember } from '@/lib/lead-automation-shared';

/** Η ομάδα πωλήσεων για τη φόρμα «Leads & αυτοματισμοί»: ποιος λείπει σήμερα
 *  και πότε πήρε τελευταία lead (για το «Επόμενος τώρα»). Μόνο για admins. */
export async function loadLeadTeam(): Promise<TeamMember[]> {
  try {
    const svc = createSupabaseServiceRoleClient();
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: people }, { data: leave }, { data: assigns }] = await Promise.all([
      svc.from('profiles').select('id, full_name, role, is_active').in('role', ['admin', 'management', 'sales']).order('full_name'),
      svc.from('leave_requests').select('profile_id').eq('status', 'approved').lte('start_date', today).gte('end_date', today),
      svc.from('lead_assignments').select('assigned_to, created_at').order('created_at', { ascending: false }).limit(2000),
    ]);
    const away = new Set((leave ?? []).map((l: any) => l.profile_id));
    const last: Record<string, string> = {};
    for (const a of (assigns ?? []) as any[]) if (a.assigned_to && !last[a.assigned_to]) last[a.assigned_to] = a.created_at;
    return ((people ?? []) as any[])
      .filter((p) => p.is_active !== false)
      .map((p) => ({ id: p.id, name: p.full_name ?? 'Χωρίς όνομα', role: String(p.role), onLeave: away.has(p.id), lastAssigned: last[p.id] ?? null }));
  } catch {
    return [];
  }
}
