'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';

type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = 'contracts';
const MAX = 25 * 1024 * 1024;
const KIND_CAT: Record<string, string> = { id: 'legal', contract: 'contract', cv: 'other', certificate: 'other', medical: 'other', payroll: 'invoice', other: 'other' };

/** Ανέβασμα εγγράφου υπαλλήλου (ταυτότητα, σύμβαση, βιογραφικό, πιστοποιητικό…) — βήμα 1: υπογεγραμμένο URL. */
export async function getEmployeeDocUploadUrl(profileId: string, fileName: string, size: number): Promise<R<{ path: string; token: string; bucket: string }>> {
  await requirePermission('hr', 'edit');
  if (!UUID.test(profileId)) return { ok: false, error: 'Άγνωστος υπάλληλος.' };
  if (size > MAX) return { ok: false, error: `«${fileName}»: μέχρι 25MB.` };
  const svc = createSupabaseServiceRoleClient() as any;
  const safe = fileName.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-80) || 'file';
  const path = `hr/${profileId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const { data, error } = await svc.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? 'Δεν ξεκίνησε το ανέβασμα.' };
  return { ok: true, path, token: data.token, bucket: BUCKET };
}

/** Βήμα 2: καταχώριση (ο υπάλληλος βλέπει τα δικά του έγγραφα στο My account). */
export async function recordEmployeeDoc(input: { profileId: string; path: string; title: string; kind: string; notes?: string; expires?: string }): Promise<R> {
  const me = await requirePermission('hr', 'edit');
  if (!UUID.test(input.profileId) || !input.path.startsWith(`hr/${input.profileId}/`)) return { ok: false, error: 'Μη έγκυρο αρχείο.' };
  const svc = createSupabaseServiceRoleClient() as any;
  const { error } = await svc.from('documents').insert({
    bucket: BUCKET, storage_path: input.path, entity_type: 'profile', entity_id: input.profileId, category: KIND_CAT[input.kind] ?? 'other',
    title: (input.title ?? '').trim().slice(0, 200) || 'Έγγραφο', description: [input.kind, input.expires ? `λήξη:${input.expires}` : ''].filter(Boolean).join('|'),
    notes: (input.notes ?? '').trim().slice(0, 2000) || null, uploaded_by: me.id,
  });
  if (error) { await svc.storage.from(BUCKET).remove([input.path]); return { ok: false, error: error.message }; }
  await logActivity({ entityType: 'profile', entityId: input.profileId, action: 'document_uploaded', metadata: { title: input.title } });
  revalidatePath('/hr');
  return { ok: true };
}

export async function deleteEmployeeDoc(id: string): Promise<R> {
  await requirePermission('hr', 'edit');
  if (!UUID.test(id)) return { ok: false, error: 'Άγνωστο έγγραφο.' };
  const svc = createSupabaseServiceRoleClient() as any;
  const { data: d } = await svc.from('documents').select('bucket, storage_path, entity_type').eq('id', id).maybeSingle();
  if (!d || d.entity_type !== 'profile') return { ok: false, error: 'Το έγγραφο δεν βρέθηκε.' };
  await svc.from('documents').delete().eq('id', id);
  if (d.storage_path) await svc.storage.from(d.bucket).remove([d.storage_path]);
  revalidatePath('/hr');
  return { ok: true };
}
