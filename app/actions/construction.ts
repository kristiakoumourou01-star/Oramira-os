'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { deliverNotification } from '@/lib/notifications';
import { cleanPhotos, MILESTONES, type UpdatePhoto } from '@/lib/construction-shared';

type Result = { ok: true; notified?: number } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIG = 'Λείπει το migration 0066 στη βάση (supabase/ΕΚΚΡΕΜΕΙ_ΣΤΗ_ΒΑΣΗ.sql).';
const missing = (m: string) => /does not exist|schema cache|Could not find/i.test(m);

export interface NewUpdate {
  projectId: string;
  buildingId?: string | null;
  unitId?: string | null;
  title: string;
  body?: string;
  progress?: number | null;
  milestoneType?: string | null;
  photos: UpdatePhoto[];
  visible: boolean;
  notify: boolean;
}

/** Units an update is about (whole project / one building / one unit). */
async function unitsInScope(supabase: any, u: { projectId: string; buildingId: string | null; unitId: string | null }) {
  let q = supabase.from('units').select('id, buyer_contact_id, status').eq('project_id', u.projectId);
  if (u.unitId) q = q.eq('id', u.unitId); else if (u.buildingId) q = q.eq('building_id', u.buildingId);
  const { data } = await q;
  return (data ?? []) as { id: string; buyer_contact_id: string | null; status: string }[];
}

/**
 * Publish a construction update. With a progress %, the progress of every unit
 * in scope moves to it (never backwards for units already further on). When
 * visible + notify, the buyers of those units get a notification.
 */
export async function createConstructionUpdate(input: NewUpdate): Promise<Result> {
  const profile = await requirePermission('projects', 'edit');
  if (!UUID.test(input.projectId ?? '')) return { ok: false, error: 'Άγνωστο έργο.' };
  const title = (input.title ?? '').trim().slice(0, 140);
  if (!title) return { ok: false, error: 'Γράψτε τίτλο (π.χ. «Ολοκληρώθηκε ο σκελετός του 3ου ορόφου»).' };
  const buildingId = input.buildingId && UUID.test(input.buildingId) ? input.buildingId : null;
  const unitId = input.unitId && UUID.test(input.unitId) ? input.unitId : null;
  const progress = input.progress === null || input.progress === undefined || (input.progress as any) === '' ? null : Math.min(100, Math.max(0, Math.round(Number(input.progress))));
  const milestone = MILESTONES.some((m) => m.value === input.milestoneType) ? input.milestoneType! : null;
  const photos = cleanPhotos(input.photos, input.projectId);

  const supabase = await createSupabaseServerClient();
  if (unitId) {
    const { data: u } = await supabase.from('units').select('id').eq('id', unitId).eq('project_id', input.projectId).maybeSingle();
    if (!u) return { ok: false, error: 'Η μονάδα δεν ανήκει σε αυτό το έργο.' };
  }
  if (buildingId) {
    const { data: b } = await supabase.from('buildings').select('id').eq('id', buildingId).eq('project_id', input.projectId).maybeSingle();
    if (!b) return { ok: false, error: 'Το κτίριο δεν ανήκει σε αυτό το έργο.' };
  }
  const { data: row, error } = await (supabase as any).from('construction_updates').insert({
    project_id: input.projectId, building_id: unitId ? null : buildingId, unit_id: unitId, title,
    body: (input.body ?? '').trim().slice(0, 4000) || null, progress: Number.isFinite(progress as number) ? progress : null,
    milestone_type: milestone, photos, visible_to_buyers: !!input.visible, created_by: profile.id,
  }).select('id').single();
  if (error) return { ok: false, error: missing(error.message) ? MIG : error.message };

  const scope = await unitsInScope(supabase, { projectId: input.projectId, buildingId: unitId ? null : buildingId, unitId });
  if (progress !== null && Number.isFinite(progress)) {
    const ids = scope.filter((u) => u.status !== 'handed_over').map((u) => u.id);
    if (ids.length) await supabase.from('units').update({ construction_progress: progress, updated_at: new Date().toISOString() }).in('id', ids).or(`construction_progress.is.null,construction_progress.lt.${progress}`);
  }

  let notified = 0;
  if (input.visible && input.notify) notified = await notifyBuyers(row.id, input.projectId, title, scope.map((u) => u.buyer_contact_id).filter((x): x is string => !!x));
  await logActivity({ entityType: 'project', entityId: input.projectId, action: 'construction_update', metadata: { update: row.id, unit: unitId, building: buildingId, progress, photos: photos.length, notified } });
  revalidatePath(`/projects/${input.projectId}`);
  if (unitId) revalidatePath(`/projects/${input.projectId}/units/${unitId}`);
  revalidatePath('/buyer/construction');
  return { ok: true, notified };
}

async function notifyBuyers(updateId: string, projectId: string, title: string, contactIds: string[]): Promise<number> {
  if (!contactIds.length) return 0;
  let svc: any;
  try { svc = createSupabaseServiceRoleClient(); } catch { return 0; }
  const [{ data: profiles }, { data: project }] = await Promise.all([
    svc.from('profiles').select('id').in('contact_id', Array.from(new Set(contactIds))).in('role', ['buyer', 'homeowner']),
    svc.from('projects').select('name').eq('id', projectId).maybeSingle(),
  ]);
  let n = 0;
  for (const p of (profiles ?? []) as { id: string }[]) {
    if (await deliverNotification(svc, { userId: p.id, title: `${project?.name ?? 'Το έργο σας'}: ${title}`, body: 'Νέα ενημέρωση κατασκευής με φωτογραφίες. / New construction update.', link: '/buyer/construction', event: 'construction_update' })) n++;
  }
  await svc.from('construction_updates').update({ notified_at: new Date().toISOString() }).eq('id', updateId);
  return n;
}

/** Show/hide an update in the buyers' portal, or fix its text. */
export async function editConstructionUpdate(id: string, patch: { visible?: boolean; title?: string; body?: string | null }): Promise<Result> {
  await requirePermission('projects', 'edit');
  if (!UUID.test(id ?? '')) return { ok: false, error: 'Άγνωστη ενημέρωση.' };
  const p: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.visible === 'boolean') p.visible_to_buyers = patch.visible;
  if (typeof patch.title === 'string') { const t = patch.title.trim().slice(0, 140); if (!t) return { ok: false, error: 'Ο τίτλος δεν μπορεί να είναι κενός.' }; p.title = t; }
  if (patch.body !== undefined) p.body = (patch.body ?? '').trim().slice(0, 4000) || null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any).from('construction_updates').update(p).eq('id', id).select('project_id, unit_id').maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (data) { revalidatePath(`/projects/${data.project_id}`); if (data.unit_id) revalidatePath(`/projects/${data.project_id}/units/${data.unit_id}`); }
  revalidatePath('/buyer/construction');
  return { ok: true };
}

/** Delete an update and its photos. */
export async function deleteConstructionUpdate(id: string): Promise<Result> {
  await requirePermission('projects', 'edit');
  if (!UUID.test(id ?? '')) return { ok: false, error: 'Άγνωστη ενημέρωση.' };
  const supabase = await createSupabaseServerClient();
  const { data: row } = await (supabase as any).from('construction_updates').select('project_id, unit_id, photos').eq('id', id).maybeSingle();
  if (!row) return { ok: false, error: 'Δεν βρέθηκε.' };
  const { error } = await (supabase as any).from('construction_updates').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  const paths = ((row.photos ?? []) as UpdatePhoto[]).map((p) => p.path).filter(Boolean);
  if (paths.length) await supabase.storage.from('project-media').remove(paths);
  await logActivity({ entityType: 'project', entityId: row.project_id, action: 'construction_update_deleted', metadata: { update: id } });
  revalidatePath(`/projects/${row.project_id}`);
  if (row.unit_id) revalidatePath(`/projects/${row.project_id}/units/${row.unit_id}`);
  revalidatePath('/buyer/construction');
  return { ok: true };
}
