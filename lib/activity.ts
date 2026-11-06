import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Best-effort request context (IP + device) for the audit trail — the "από πού"
 * of who-did-what-when. Reads proxy headers; returns {} outside a request scope
 * (e.g. a cron tick), so it never throws. Stored under reserved metadata keys
 * `ip`/`ua` that ActivityFeed ignores (it only reads named keys), while the
 * global audit log surfaces them.
 */
async function requestContext(): Promise<{ ip?: string; ua?: string }> {
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for');
    const ip = (fwd ? fwd.split(',')[0] : h.get('x-real-ip'))?.trim();
    const ua = h.get('user-agent')?.slice(0, 400);
    return { ...(ip ? { ip } : {}), ...(ua ? { ua } : {}) };
  } catch {
    return {};
  }
}

/**
 * Single chokepoint for writing to activity_log. Every Server Action that
 * mutates a meaningful entity should call this rather than inserting into
 * activity_log directly — keeps the metadata shape consistent so
 * ActivityFeed can render any entity's history the same way. Also stamps the
 * caller's IP + device into metadata for the global audit log.
 */
export async function logActivity(params: {
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const ctx = await requestContext();

  await supabase.from('activity_log').insert({
    entity_type: params.entityType,
    entity_id: params.entityId,
    actor_id: auth.user?.id ?? null,
    action: params.action,
    metadata: { ...(params.metadata ?? {}), ...ctx },
  });
}
