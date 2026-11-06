import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AuditRow } from '@/lib/audit-shared';
export type { AuditRow } from '@/lib/audit-shared';

/**
 * Global audit / access log.
 *
 * The whole activity_log stream — every logged action across every user and
 * entity, including login/logout — joined with the actor's name + role and the
 * IP/device stamped into metadata. This is the owner's "who did what, when, and
 * from where" view (lib/activity writes it; here we read it back). Resilient:
 * any read error degrades to an empty log rather than breaking the page.
 */


export async function getAuditLog(limit = 500): Promise<AuditRow[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: events } = await supabase
      .from('activity_log')
      .select('id, entity_type, entity_id, actor_id, action, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!events) return [];

    // Resolve actor names/roles in one follow-up query (avoids embed ambiguity).
    const actorIds = Array.from(new Set(events.map((e) => e.actor_id).filter(Boolean))) as string[];
    const actors = new Map<string, { name: string | null; role: string | null }>();
    if (actorIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, role').in('id', actorIds);
      for (const p of profiles ?? []) actors.set(p.id, { name: p.full_name, role: p.role });
    }

    return events.map((e) => {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      const actor = e.actor_id ? actors.get(e.actor_id) : undefined;
      return {
        id: e.id,
        createdAt: e.created_at,
        action: e.action,
        entityType: e.entity_type,
        entityId: e.entity_id,
        actorId: e.actor_id,
        actorName: actor?.name ?? null,
        actorRole: actor?.role ?? null,
        ip: typeof meta.ip === 'string' ? meta.ip : null,
        ua: typeof meta.ua === 'string' ? meta.ua : null,
      };
    });
  } catch {
    return [];
  }
}
