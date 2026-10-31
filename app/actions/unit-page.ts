'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';
import { scheduleViewing } from '@/app/actions/viewings';
import { cleanRooms, parseCoords, type Room } from '@/lib/unit-page-shared';

export type ActionResult = { ok: true } | { ok: false; error: string };
const MISSING = 'Χρειάζεται μια αλλαγή στη βάση (migration 0059) — τρέξτε το supabase/ΕΚΚΡΕΜΕΙ_ΣΤΗ_ΒΑΣΗ.sql.';
const friendly = (m: string) => (/does not exist|schema cache|column/i.test(m) ? MISSING : m);
const path = (projectId: string, unitId: string) => `/projects/${projectId}/units/${unitId}`;

/** Record a file the browser just uploaded to project-media (or an external video link). */
export async function addUnitMedia(p: { unitId: string; projectId: string; kind: 'photo' | 'video' | 'floor_plan' | 'video_link'; storagePath?: string; url?: string; caption?: string }): Promise<ActionResult> {
  const profile = await requirePermission('projects', 'edit');
  if (p.kind === 'video_link' && !/^https:\/\/\S+$/i.test(p.url ?? '')) return { ok: false, error: 'Βάλτε έναν σύνδεσμο που ξεκινά με https://' };
  if (p.kind !== 'video_link' && !p.storagePath?.startsWith(`${p.projectId}/units/${p.unitId}/`)) return { ok: false, error: 'Μη έγκυρο αρχείο.' };
  const supabase = await createSupabaseServerClient();
  const { data: last } = await (supabase as any).from('unit_media').select('sort').eq('unit_id', p.unitId).order('sort', { ascending: false }).limit(1).maybeSingle();
  const { error } = await (supabase as any).from('unit_media').insert({
    unit_id: p.unitId, project_id: p.projectId, kind: p.kind,
    storage_path: p.kind === 'video_link' ? null : p.storagePath, url: p.kind === 'video_link' ? p.url : null,
    caption: p.caption?.trim().slice(0, 200) || null, sort: (last?.sort ?? -1) + 1, created_by: profile.id,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath(path(p.projectId, p.unitId));
  return { ok: true };
}

export async function deleteUnitMedia(id: string, unitId: string, projectId: string): Promise<ActionResult> {
  await requirePermission('projects', 'edit');
  const supabase = await createSupabaseServerClient();
  const { data: row } = await (supabase as any).from('unit_media').select('bucket, storage_path').eq('id', id).eq('unit_id', unitId).maybeSingle();
  const { error } = await (supabase as any).from('unit_media').delete().eq('id', id).eq('unit_id', unitId);
  if (error) return { ok: false, error: friendly(error.message) };
  if (row?.storage_path) await supabase.storage.from(row.bucket).remove([row.storage_path]);
  revalidatePath(path(projectId, unitId));
  return { ok: true };
}

/** Make this photo the cover (first) of the unit. */
export async function makeCover(id: string, unitId: string, projectId: string): Promise<ActionResult> {
  await requirePermission('projects', 'edit');
  const supabase = await createSupabaseServerClient();
  const { data: first } = await (supabase as any).from('unit_media').select('sort').eq('unit_id', unitId).order('sort').limit(1).maybeSingle();
  const { error } = await (supabase as any).from('unit_media').update({ sort: (first?.sort ?? 0) - 1 }).eq('id', id).eq('unit_id', unitId);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath(path(projectId, unitId));
  return { ok: true };
}

export async function saveUnitRooms(unitId: string, projectId: string, rooms: Room[]): Promise<ActionResult> {
  await requirePermission('projects', 'edit');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('units').update({ rooms: cleanRooms(rooms) } as any).eq('id', unitId);
  if (error) return { ok: false, error: friendly(error.message) };
  await logActivity({ entityType: 'unit', entityId: unitId, action: 'rooms_updated', metadata: {} });
  revalidatePath(path(projectId, unitId));
  return { ok: true };
}

export async function setUnitAgent(unitId: string, projectId: string, agentId: string | null): Promise<ActionResult> {
  await requirePermission('projects', 'edit');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('units').update({ responsible_agent_id: agentId || null } as any).eq('id', unitId);
  if (error) return { ok: false, error: friendly(error.message) };
  await logActivity({ entityType: 'unit', entityId: unitId, action: 'agent_assigned', metadata: { agentId } });
  revalidatePath(path(projectId, unitId));
  return { ok: true };
}

export async function setUnitCommission(unitId: string, projectId: string, pct: number | null): Promise<ActionResult> {
  await requirePermission('projects', 'edit');
  const v = pct == null || !Number.isFinite(pct) ? null : Math.min(100, Math.max(0, Math.round(pct * 100) / 100));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('units').update({ commission_pct: v } as any).eq('id', unitId);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath(path(projectId, unitId));
  return { ok: true };
}

/** Project location for the map: coordinates or a Google Maps / OpenStreetMap link. */
export async function setProjectLocation(projectId: string, input: string, back: string): Promise<ActionResult> {
  await requirePermission('projects', 'edit');
  const c = parseCoords(input);
  if (!c) return { ok: false, error: 'Δεν βρέθηκαν συντεταγμένες. Επικολλήστε π.χ. «34.6786, 33.0413» ή έναν σύνδεσμο Google Maps.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('projects').update({ latitude: c.lat, longitude: c.lng } as any).eq('id', projectId);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath(back);
  return { ok: true };
}

/** «Κλείσε προβολή» from the unit page. Returns errors instead of throwing (production hides thrown messages). */
export async function bookUnitViewing(p: { unitId: string; projectId: string; contactId: string; leadId?: string | null; agentId?: string | null; scheduledAt: string; notes?: string }): Promise<ActionResult> {
  await requirePermission('leads', 'edit');
  if (!p.contactId) return { ok: false, error: 'Διαλέξτε πελάτη.' };
  const when = Date.parse(p.scheduledAt);
  if (!Number.isFinite(when)) return { ok: false, error: 'Διαλέξτε ημερομηνία και ώρα.' };
  if (when < Date.now() - 5 * 60_000) return { ok: false, error: 'Η ώρα έχει ήδη περάσει.' };
  try {
    await scheduleViewing({ contactId: p.contactId, leadId: p.leadId ?? null, unitId: p.unitId, projectId: p.projectId, agentId: p.agentId || null, scheduledAt: new Date(when).toISOString(), notes: p.notes });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Η προβολή δεν κλείστηκε.' };
  }
  revalidatePath(path(p.projectId, p.unitId));
  return { ok: true };
}
