import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import type { ConstructionUpdate, UpdatePhoto } from '@/lib/construction-shared';

/**
 * Server half of «Πρόοδος κατασκευής». Rows are always read with the caller's
 * session, so RLS decides what they may see (staff: everything; buyers: their
 * own project/building/unit, visible updates only). Only the photos of rows
 * that came back are then signed with the service client — the bucket itself
 * stays private.
 */
export async function signPhotos(paths: string[], seconds = 3600): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return out;
  try {
    const svc = createSupabaseServiceRoleClient();
    const { data } = await svc.storage.from('project-media').createSignedUrls(unique, seconds);
    for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  } catch { /* no service key in this environment: photos show as unavailable */ }
  return out;
}

const SELECT = 'id, project_id, building_id, unit_id, title, body, progress, milestone_type, photos, visible_to_buyers, notified_at, created_at, buildings(name), units(unit_number), profiles:created_by(full_name)';

export async function loadUpdates(filter: { projectId: string; unitId?: string; buildingId?: string | null; limit?: number }): Promise<{ items: ConstructionUpdate[]; missing: boolean }> {
  const supabase = await createSupabaseServerClient();
  let q = (supabase as any).from('construction_updates').select(SELECT).eq('project_id', filter.projectId);
  // A unit sees: whole-project updates, its building's, and its own.
  if (filter.unitId) {
    const ors = ['and(unit_id.is.null,building_id.is.null)', `unit_id.eq.${filter.unitId}`];
    if (filter.buildingId) ors.push(`and(unit_id.is.null,building_id.eq.${filter.buildingId})`);
    q = q.or(ors.join(','));
  }
  const { data, error } = await q.order('created_at', { ascending: false }).limit(filter.limit ?? 50);
  if (error) return { items: [], missing: /does not exist|schema cache|Could not find/i.test(error.message) };
  const rows = (data ?? []) as any[];
  const urls = await signPhotos(rows.flatMap((r) => ((r.photos ?? []) as UpdatePhoto[]).map((p) => p.path)));
  return {
    missing: false,
    items: rows.map((r) => ({
      id: r.id, projectId: r.project_id, buildingId: r.building_id, buildingName: r.buildings?.name ?? null,
      unitId: r.unit_id, unitNumber: r.units?.unit_number ?? null, title: r.title, body: r.body,
      progress: r.progress, milestoneType: r.milestone_type,
      photos: ((r.photos ?? []) as UpdatePhoto[]).map((p) => ({ ...p, url: urls.get(p.path) ?? null })),
      visible: !!r.visible_to_buyers, notifiedAt: r.notified_at, createdAt: r.created_at, by: r.profiles?.full_name ?? null,
    })),
  };
}
