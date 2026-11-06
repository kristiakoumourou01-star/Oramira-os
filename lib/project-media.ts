import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import type { SignedMedia } from '@/lib/project-media-shared';

/**
 * Loads a project's media library and signs each file for display. Rows are read
 * with the caller's session client (RLS gates staff vs owners); the private
 * 'project-media' bucket is signed with the service role so owners can view the
 * plans of the development they belong to without a broad storage policy.
 * The SignedMedia type is re-exported from the client-safe shared module.
 */
export type { SignedMedia } from '@/lib/project-media-shared';

export async function loadSignedProjectMedia(projectId: string): Promise<SignedMedia[]> {
  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .from('project_media')
    .select('id, kind, title, building_id, floor, bucket, storage_path, sort')
    .eq('project_id', projectId)
    .order('sort', { ascending: true });
  if (!rows || rows.length === 0) return [];

  const svc = createSupabaseServiceRoleClient();
  const out: SignedMedia[] = [];
  for (const r of rows) {
    const { data } = await svc.storage.from(r.bucket).createSignedUrl(r.storage_path, 3600);
    out.push({ id: r.id, kind: r.kind, title: r.title, building_id: r.building_id, floor: r.floor, url: data?.signedUrl ?? null });
  }
  return out;
}
