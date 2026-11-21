import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSignedDocumentUrl } from '@/lib/storage';
import { inverseRelation, normGender, type FamilyRow } from '@/lib/family-shared';

/**
 * Καρτέλα πελάτη — φόρτωση των κομματιών που χρειάζονται τα νέα components:
 * επαφές/οικογένεια, κατάσταση προεπιλεγμένου κωδικού, φωτογραφία, ομάδες/tags.
 */

/** Οι επαφές του πελάτη: όσες έγραψε ο ίδιος + όσες τον έχουν δηλώσει χωρίς αντίστροφη εγγραφή. */
export async function loadFamily(contactId: string): Promise<{ rows: FamilyRow[]; missing: boolean }> {
  const db = (await createSupabaseServerClient()) as any;
  const [out, inc] = await Promise.all([
    db.from('contact_relations').select('*, other:related_contact_id(full_name, email, phone)').eq('contact_id', contactId).order('created_at'),
    db.from('contact_relations').select('*, other:contact_id(*)').eq('related_contact_id', contactId).order('created_at'),
  ]);
  if (out.error) return { rows: [], missing: /does not exist|schema cache|Could not find/i.test(out.error.message) };
  const rows: FamilyRow[] = ((out.data ?? []) as any[]).map((r) => ({
    id: r.id, relation: r.relation, contactId: r.related_contact_id ?? null,
    name: r.other?.full_name ?? ([r.first_name, r.last_name].filter(Boolean).join(' ') || r.related_name || '—'),
    phone: r.other?.phone ?? r.related_phone ?? null, email: r.other?.email ?? r.related_email ?? null,
    note: r.note ?? null, decisionMaker: !!r.is_decision_maker, incoming: false,
  }));
  const linked = new Set(rows.map((r) => r.contactId).filter(Boolean));
  for (const r of (inc.data ?? []) as any[]) {
    if (linked.has(r.contact_id)) continue; // υπάρχει ήδη η αντίστροφη εγγραφή
    rows.push({
      id: r.id, relation: inverseRelation(r.relation, normGender(r.other?.gender)), contactId: r.contact_id,
      name: r.other?.full_name ?? '—', phone: r.other?.phone ?? null, email: r.other?.email ?? null, note: r.note ?? null, decisionMaker: false, incoming: true,
    });
  }
  return { rows, missing: false };
}

/** «Ορίστηκε» (ημερομηνία) ή null. Ποτέ ο ίδιος ο κωδικός. */
export async function loadOtpStatus(contactId: string): Promise<{ setAt: string | null; available: boolean }> {
  const db = (await createSupabaseServerClient()) as any;
  const { data, error } = await db.rpc('contact_default_otp_status', { p_contact: contactId });
  if (error) return { setAt: null, available: false };
  return { setAt: (data as string | null) ?? null, available: true };
}

export async function loadPhotoUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  try { return await getSignedDocumentUrl('contracts', path, 3600); } catch { return null; }
}

/** Οι ομάδες και τα tags που μπορεί να διαλέξει κανείς στη φόρμα. */
export async function loadGroupTagOptions(defs: { groups: string[]; tags: string[] }): Promise<{ groups: string[]; tags: string[] }> {
  const db = (await createSupabaseServerClient()) as any;
  const { data } = await db.from('contact_groups').select('name').order('name');
  const groups = [...new Set([...((data ?? []) as any[]).map((g) => g.name as string), ...defs.groups])].filter(Boolean);
  return { groups, tags: [...new Set(defs.tags)].filter(Boolean) };
}

