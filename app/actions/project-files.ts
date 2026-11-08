'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

type Kind = 'gallery' | 'documents';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATS = ['floorplan', 'drawing', 'specification', 'contract', 'warranty', 'manual', 'invoice', 'legal', 'marketing', 'other'];
const bucketOf = (k: Kind) => (k === 'gallery' ? 'project-media' : 'contracts');
const MAX = 25 * 1024 * 1024;

/** Βήμα 1: υπογεγραμμένο URL ώστε ο browser να ανεβάσει απευθείας (χωρίς όριο μεγέθους server action). */
export async function getProjectUploadUrl(projectId: string, kind: Kind, fileName: string, size: number, mime: string): Promise<{ ok: true; path: string; token: string; bucket: string } | { ok: false; error: string }> {
  await requirePermission('projects', 'edit');
  if (!UUID.test(projectId)) return { ok: false, error: 'Άγνωστο έργο.' };
  if (size > MAX) return { ok: false, error: `«${fileName}»: μέχρι 25MB.` };
  if (kind === 'gallery' && !/^image\//.test(mime)) return { ok: false, error: `«${fileName}»: η συλλογή δέχεται μόνο εικόνες.` };
  const safe = fileName.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-80) || 'file';
  const path = `projects/${projectId}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const svc = createSupabaseServiceRoleClient();
  const { data, error } = await svc.storage.from(bucketOf(kind)).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? 'Δεν ξεκίνησε το ανέβασμα.' };
  return { ok: true, path, token: data.token, bucket: bucketOf(kind) };
}

/** Βήμα 2: καταχώριση του αρχείου στο έργο. */
export async function recordProjectFile(projectId: string, kind: Kind, path: string, title: string, category?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requirePermission('projects', 'edit');
  if (!UUID.test(projectId) || !path.startsWith(`projects/${projectId}/${kind}/`)) return { ok: false, error: 'Μη έγκυρο αρχείο.' };
  const svc = createSupabaseServiceRoleClient();
  const { error } = await svc.from('documents').insert({
    bucket: bucketOf(kind), storage_path: path, entity_type: 'project', entity_id: projectId,
    category: (kind === 'gallery' ? 'marketing' : CATS.includes(category ?? '') ? category : 'other') as any,
    title: title.trim().slice(0, 200) || null, uploaded_by: me.id,
  });
  if (error) { await svc.storage.from(bucketOf(kind)).remove([path]); return { ok: false, error: error.message }; }
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/** Διαγραφή φωτογραφίας / εγγράφου του έργου. */
export async function deleteProjectFile(projectId: string, documentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('projects', 'edit');
  if (!UUID.test(projectId) || !UUID.test(documentId)) return { ok: false, error: 'Άγνωστο αρχείο.' };
  const svc = createSupabaseServiceRoleClient();
  const { data: d } = await svc.from('documents').select('bucket, storage_path').eq('id', documentId).eq('entity_type', 'project').eq('entity_id', projectId).maybeSingle();
  if (!d) return { ok: false, error: 'Το αρχείο δεν βρέθηκε.' };
  const { error } = await svc.from('documents').delete().eq('id', documentId);
  if (error) return { ok: false, error: error.message };
  await svc.storage.from(d.bucket).remove([d.storage_path]);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
