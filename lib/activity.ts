import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Single chokepoint for writing to activity_log. Every Server Action that
 * mutates a meaningful entity should call this rather than inserting into
 * activity_log directly — keeps the metadata shape consistent so
 * ActivityFeed can render any entity's history the same way.
 */
export async function logActivity(params: {
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();

  await supabase.from('activity_log').insert({
    entity_type: params.entityType,
    entity_id: params.entityId,
    actor_id: auth.user?.id ?? null,
    action: params.action,
    metadata: params.metadata ?? {},
  });
}
