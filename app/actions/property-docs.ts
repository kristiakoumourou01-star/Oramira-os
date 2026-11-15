'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';

type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATS = ['floorplan', 'drawing', 'specification', 'contract', 'warranty', 'manual', 'invoice', 'legal', 'marketing', 'other'];
const BUCKET = 'contracts';
const MAX = 25 * 1024 * 1024;
const t = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '') || null;

/** Το ακίνητο (unit) ανήκει στο έργο; */
async function unitInProject(svc: any, projectId: string, unitId: string | null) {
  if (!unitId) return true;
  if (!UUID.test(unitId)) return false;
  const { data } = await svc.from('units').select('id').eq('id', unitId).eq('project_id', projectId).maybeSingle();
  return !!data;
}

/** Βήμα 1: υπογεγραμμένο URL για απευθείας ανέβασμα από τον browser. */
export async function getPropertyDocUploadUrl(projectId: string, unitId: string | null, fileName: string, size: number): Promise<R<{ path: string; token: string; bucket: string }>> {
  await requirePermission('property', 'edit');
  if (!UUID.test(projectId)) return { ok: false, error: 'Άγνωστο έργο.' };
  if (size > MAX) return { ok: false, error: `«${fileName}»: μέχρι 25MB.` };
  const svc = createSupabaseServiceRoleClient() as any;
  if (!(await unitInProject(svc, projectId, unitId))) return { ok: false, error: 'Άγνωστο ακίνητο.' };
  const safe = fileName.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-80) || 'file';
  const path = `projects/${projectId}/property/${unitId ?? 'common'}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const { data, error } = await svc.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? 'Δεν ξεκίνησε το ανέβασμα.' };
  return { ok: true, path, token: data.token, bucket: BUCKET };
}

/** Βήμα 2: καταχώριση με τίτλο, κατηγορία, περιγραφή και σημειώσεις. */
export async function recordPropertyDoc(input: { projectId: string; unitId: string | null; path: string; title: string; category?: string; description?: string; notes?: string }): Promise<R> {
  const me = await requirePermission('property', 'edit');
  const { projectId, unitId, path } = input;
  if (!UUID.test(projectId) || !path.startsWith(`projects/${projectId}/property/${unitId ?? 'common'}/`)) return { ok: false, error: 'Μη έγκυρο αρχείο.' };
  const svc = createSupabaseServiceRoleClient() as any;
  if (!(await unitInProject(svc, projectId, unitId))) return { ok: false, error: 'Άγνωστο ακίνητο.' };
  const { data, error } = await svc.from('documents').insert({
    bucket: BUCKET, storage_path: path, entity_type: unitId ? 'unit' : 'project', entity_id: unitId ?? projectId,
    category: CATS.includes(input.category ?? '') ? input.category : 'other',
    title: t(input.title, 200), description: t(input.description, 1000), notes: t(input.notes, 4000), uploaded_by: me.id,
  }).select('id').single();
  if (error) { await svc.storage.from(BUCKET).remove([path]); return { ok: false, error: error.message }; }
  await logActivity({ entityType: unitId ? 'unit' : 'project', entityId: unitId ?? projectId, action: 'document_uploaded', metadata: { title: input.title } });
  revalidatePath('/property');
  return { ok: true };
}

/** Αλλαγή τίτλου / κατηγορίας / περιγραφής / σημειώσεων. */
export async function updatePropertyDoc(id: string, p: { title?: string; category?: string; description?: string; notes?: string }): Promise<R> {
  await requirePermission('property', 'edit');
  if (!UUID.test(id)) return { ok: false, error: 'Άγνωστο έγγραφο.' };
  const patch: Record<string, unknown> = {};
  if (p.title !== undefined) patch.title = t(p.title, 200);
  if (p.category !== undefined && CATS.includes(p.category)) patch.category = p.category;
  if (p.description !== undefined) patch.description = t(p.description, 1000);
  if (p.notes !== undefined) patch.notes = t(p.notes, 4000);
  const svc = createSupabaseServiceRoleClient() as any;
  const { error } = await svc.from('documents').update(patch).eq('id', id).in('entity_type', ['unit', 'project']);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/property');
  return { ok: true };
}

/** Διαγραφή εγγράφου (και του αρχείου). */
export async function deletePropertyDoc(id: string): Promise<R> {
  await requirePermission('property', 'edit');
  if (!UUID.test(id)) return { ok: false, error: 'Άγνωστο έγγραφο.' };
  const svc = createSupabaseServiceRoleClient() as any;
  const { data: d } = await svc.from('documents').select('bucket, storage_path, entity_type').eq('id', id).maybeSingle();
  if (!d || !['unit', 'project'].includes(d.entity_type)) return { ok: false, error: 'Το έγγραφο δεν βρέθηκε.' };
  const { error } = await svc.from('documents').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (d.storage_path) await svc.storage.from(d.bucket).remove([d.storage_path]);
  revalidatePath('/property');
  return { ok: true };
}
