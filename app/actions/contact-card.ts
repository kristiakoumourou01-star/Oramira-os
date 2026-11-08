'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { BEST_TIME, CHANNELS, LANGUAGES, RELATIONS, cleanKyc, computeRisk, reviewDue, verifyMissing, type KycData } from '@/lib/kyc-shared';

type Result = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIG = 'Λείπει το migration 0067 στη βάση (supabase/ΕΚΚΡΕΜΕΙ_ΣΤΗ_ΒΑΣΗ.sql).';
const missing = (m: string) => /does not exist|schema cache|Could not find/i.test(m);
const page = (id: string) => revalidatePath(`/crm/${id}`);

/** Γλώσσα, κανάλι, ώρα επικοινωνίας. */
export async function savePreferences(contactId: string, p: { language: string | null; channel: string | null; bestTime: string | null; bestTimeNote: string | null }): Promise<Result> {
  await requirePermission('leads', 'edit');
  if (!UUID.test(contactId ?? '')) return { ok: false, error: 'Άγνωστη επαφή.' };
  const one = (v: string | null, list: { v: string }[]) => (v && list.some((o) => o.v === v) ? v : null);
  const supabase = await createSupabaseServerClient();
  const { error } = await (supabase as any).from('contacts').update({
    preferred_language: one(p.language, LANGUAGES), communication_preference: one(p.channel, CHANNELS),
    best_time: one(p.bestTime, BEST_TIME), best_time_note: (p.bestTimeNote ?? '').trim().slice(0, 200) || null,
    updated_at: new Date().toISOString(),
  }).eq('id', contactId);
  if (error) return { ok: false, error: missing(error.message) ? MIG : error.message };
  page(contactId);
  return { ok: true };
}

/* ----------------------------------------------------------- relations -- */

export interface ContactHit { id: string; name: string; email: string | null; phone: string | null }

/** Contacts to link as family/partner (name, email or phone). */
export async function findContacts(q: string, exclude: string): Promise<ContactHit[]> {
  await requirePermission('leads', 'view');
  const term = (q ?? '').trim().replace(/[%,()]/g, ' ').slice(0, 60);
  if (term.length < 2) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('contacts').select('id, full_name, email, phone')
    .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`).neq('id', exclude).is('anonymized_at', null).limit(8);
  return ((data ?? []) as any[]).map((c) => ({ id: c.id, name: c.full_name ?? c.email ?? '—', email: c.email, phone: c.phone }));
}

export async function addRelation(contactId: string, r: { relatedContactId?: string | null; name?: string; phone?: string; email?: string; relation: string; decisionMaker: boolean; note?: string }): Promise<Result> {
  const profile = await requirePermission('leads', 'edit');
  if (!UUID.test(contactId ?? '')) return { ok: false, error: 'Άγνωστη επαφή.' };
  if (!RELATIONS.some((x) => x.v === r.relation)) return { ok: false, error: 'Διαλέξτε σχέση.' };
  const linked = r.relatedContactId && UUID.test(r.relatedContactId) && r.relatedContactId !== contactId ? r.relatedContactId : null;
  const name = (r.name ?? '').trim().slice(0, 120);
  if (!linked && !name) return { ok: false, error: 'Διαλέξτε επαφή ή γράψτε όνομα.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await (supabase as any).from('contact_relations').insert({
    contact_id: contactId, related_contact_id: linked, related_name: linked ? null : name,
    related_phone: linked ? null : (r.phone ?? '').trim().slice(0, 40) || null, related_email: linked ? null : (r.email ?? '').trim().slice(0, 120) || null,
    relation: r.relation, is_decision_maker: !!r.decisionMaker, note: (r.note ?? '').trim().slice(0, 300) || null, created_by: profile.id,
  });
  if (error) return { ok: false, error: missing(error.message) ? MIG : error.message };
  page(contactId); if (linked) page(linked);
  return { ok: true };
}

export async function deleteRelation(id: string, contactId: string): Promise<Result> {
  await requirePermission('leads', 'edit');
  if (!UUID.test(id ?? '')) return { ok: false, error: 'Άγνωστη εγγραφή.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await (supabase as any).from('contact_relations').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  page(contactId);
  return { ok: true };
}

/* ----------------------------------------------------------------- KYC -- */

/**
 * Save the KYC/AML file. The risk score is always recomputed here (never
 * trusted from the browser). `verify` marks it verified — only when nothing
 * required is missing and there is no sanctions match.
 */
export async function saveKyc(contactId: string, raw: KycData, action: 'save' | 'verify' | 'reject'): Promise<{ ok: true; level: string; score: number } | { ok: false; error: string }> {
  const profile = await requirePermission('leads', 'edit');
  if (!UUID.test(contactId ?? '')) return { ok: false, error: 'Άγνωστη επαφή.' };
  const k = cleanKyc(raw);
  const { aml } = await getOrgSettingsRaw();
  const risk = computeRisk(k, aml);
  const supabase = await createSupabaseServerClient();
  const { data: prev } = await (supabase as any).from('contact_kyc').select('status, verified_at, verified_by').eq('contact_id', contactId).maybeSingle();

  let status = prev?.status === 'verified' || prev?.status === 'rejected' ? prev.status : (k.status === 'not_started' ? 'in_progress' : k.status);
  let verifiedAt: string | null = prev?.verified_at ?? null;
  let verifiedBy: string | null = prev?.verified_by ?? null;
  if (action === 'verify') {
    const m = verifyMissing(k);
    if (m.length) return { ok: false, error: `Για επαλήθευση λείπουν: ${m.join(', ')}.` };
    status = 'verified'; verifiedAt = new Date().toISOString(); verifiedBy = profile.id;
  } else if (action === 'reject') { status = 'rejected'; }
  if (risk.level === 'blocked' && status === 'verified') status = 'rejected';

  const row = {
    contact_id: contactId, ...k, status, risk_score: risk.score, risk_level: risk.level, risk_factors: risk.factors,
    review_due: status === 'verified' ? reviewDue(risk.level, verifiedAt, aml) : null,
    verified_at: status === 'verified' ? verifiedAt : null, verified_by: status === 'verified' ? verifiedBy : null,
    updated_by: profile.id, updated_at: new Date().toISOString(),
  };
  const { error } = await (supabase as any).from('contact_kyc').upsert(row, { onConflict: 'contact_id' });
  if (error) return { ok: false, error: missing(error.message) ? MIG : error.message };
  // The audit log keeps WHAT happened, never the ID number itself.
  await logActivity({ entityType: 'contact', entityId: contactId, action: action === 'verify' ? 'kyc_verified' : action === 'reject' ? 'kyc_rejected' : 'kyc_updated', metadata: { level: risk.level, score: risk.score, status } });
  page(contactId);
  return { ok: true, level: risk.level, score: risk.score };
}

/* ----------------------------------------------------------- documents -- */

const DOC_CATEGORIES = ['kyc_id', 'kyc_address', 'kyc_funds', 'kyc_other', 'contract', 'other'];

/** Record a file the browser uploaded to contracts/contacts/<id>/… */
export async function addContactDocument(contactId: string, d: { path: string; title: string; category: string }): Promise<Result> {
  const profile = await requirePermission('leads', 'edit');
  if (!UUID.test(contactId ?? '')) return { ok: false, error: 'Άγνωστη επαφή.' };
  if (!d.path?.startsWith(`contacts/${contactId}/`) || d.path.includes('..')) return { ok: false, error: 'Μη έγκυρο αρχείο.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('documents').insert({
    bucket: 'contracts', storage_path: d.path, entity_type: 'contact', entity_id: contactId,
    category: DOC_CATEGORIES.includes(d.category) ? d.category : 'other', title: (d.title ?? '').trim().slice(0, 160) || null, uploaded_by: profile.id,
  });
  if (error) return { ok: false, error: error.message };
  await logActivity({ entityType: 'contact', entityId: contactId, action: 'document_added', metadata: { category: d.category } });
  page(contactId);
  return { ok: true };
}

export async function deleteContactDocument(docId: string, contactId: string): Promise<Result> {
  await requirePermission('leads', 'edit');
  if (!UUID.test(docId ?? '')) return { ok: false, error: 'Άγνωστο έγγραφο.' };
  const supabase = await createSupabaseServerClient();
  const { data: doc } = await supabase.from('documents').select('bucket, storage_path, entity_type, entity_id').eq('id', docId).maybeSingle();
  if (!doc || doc.entity_type !== 'contact' || doc.entity_id !== contactId) return { ok: false, error: 'Δεν βρέθηκε.' };
  await supabase.storage.from(doc.bucket).remove([doc.storage_path]);
  const { error } = await supabase.from('documents').delete().eq('id', docId);
  if (error) return { ok: false, error: error.message };
  await logActivity({ entityType: 'contact', entityId: contactId, action: 'document_deleted' });
  page(contactId);
  return { ok: true };
}
