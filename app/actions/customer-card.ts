'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { sendMessage } from '@/lib/communications';
import { RELATION_KEYS, inverseRelation, normGender } from '@/lib/family-shared';
import { cleanCustomerProfile, type CustomerProfileInput } from '@/lib/customer-card-shared';

type Result = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const missingCol = (m: string) => /does not exist|schema cache|Could not find/i.test(m);
const refresh = (...ids: (string | null | undefined)[]) => { for (const id of ids) if (id) revalidatePath(`/crm/${id}`); revalidatePath('/crm/customers'); };

/* ------------------------------------------------------------- contacts -- */

/**
 * «Νέα επαφή» στην καρτέλα πελάτη: συγγενής ή συνεργάτης. Αν συνδέεται με
 * υπάρχοντα πελάτη, γράφεται και η αντίστροφη σχέση στη δική του καρτέλα
 * (Πατέρας ↔ Γιος / Κόρη, από το φύλο αν το ξέρουμε, αλλιώς «Παιδί»).
 */
export async function addFamilyContact(contactId: string, p: { relatedContactId?: string | null; relation: string; firstName?: string; lastName?: string; phone?: string; email?: string; note?: string }): Promise<Result> {
  const me = await requirePermission('leads', 'edit');
  if (!UUID.test(contactId ?? '')) return { ok: false, error: 'Άγνωστος πελάτης.' };
  if (!RELATION_KEYS.includes(p.relation)) return { ok: false, error: 'Διαλέξτε σχέση.' };
  const linked = p.relatedContactId && UUID.test(p.relatedContactId) && p.relatedContactId !== contactId ? p.relatedContactId : null;
  const first = (p.firstName ?? '').trim().slice(0, 80);
  const last = (p.lastName ?? '').trim().slice(0, 80);
  if (!linked && !first) return { ok: false, error: 'Συμπληρώστε το όνομα.' };
  const email = (p.email ?? '').trim().toLowerCase().slice(0, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Το email δεν είναι έγκυρο.' };
  const db = (await createSupabaseServerClient()) as any;

  const row: Record<string, unknown> = {
    contact_id: contactId, related_contact_id: linked, relation: p.relation,
    related_name: linked ? null : [first, last].filter(Boolean).join(' '), first_name: linked ? null : first || null, last_name: linked ? null : last || null,
    related_phone: linked ? null : (p.phone ?? '').trim().slice(0, 40) || null, related_email: linked ? null : email || null,
    note: (p.note ?? '').trim().slice(0, 300) || null, created_by: me.id,
  };
  let ins = await db.from('contact_relations').insert(row).select('id').single();
  if (ins.error && missingCol(ins.error.message)) { delete row.first_name; delete row.last_name; ins = await db.from('contact_relations').insert(row).select('id').single(); }
  if (ins.error) return { ok: false, error: missingCol(ins.error.message) ? 'Λείπει το migration 0092 στη βάση.' : ins.error.message };

  if (linked) {
    // Η αντίστροφη σχέση στον άλλο πελάτη (αν δεν υπάρχει ήδη).
    const { data: a } = await db.from('contacts').select('*').eq('id', contactId).maybeSingle();
    const inv = inverseRelation(p.relation, normGender(a?.gender));
    const { data: exists } = await db.from('contact_relations').select('id').eq('contact_id', linked).eq('related_contact_id', contactId).limit(1);
    if (!(exists ?? []).length) {
      const back = await db.from('contact_relations').insert({ contact_id: linked, related_contact_id: contactId, relation: inv, created_by: me.id, reciprocal_id: ins.data.id }).select('id').single();
      if (back.error && missingCol(back.error.message)) await db.from('contact_relations').insert({ contact_id: linked, related_contact_id: contactId, relation: inv, created_by: me.id });
      else if (back.data?.id) await db.from('contact_relations').update({ reciprocal_id: back.data.id }).eq('id', ins.data.id);
    }
  }
  await logActivity({ entityType: 'contact', entityId: contactId, action: 'relation_added', metadata: { relation: p.relation, linked } });
  refresh(contactId, linked);
  return { ok: true };
}

/** Αφαίρεση επαφής — μαζί και η αντίστροφη σχέση στον άλλο πελάτη. */
export async function removeFamilyContact(id: string, contactId: string): Promise<Result> {
  await requirePermission('leads', 'edit');
  if (!UUID.test(id ?? '')) return { ok: false, error: 'Άγνωστη εγγραφή.' };
  const db = (await createSupabaseServerClient()) as any;
  const { data: r } = await db.from('contact_relations').select('*').eq('id', id).maybeSingle();
  if (!r) return { ok: false, error: 'Η επαφή δεν βρέθηκε.' };
  const { error } = await db.from('contact_relations').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (r.reciprocal_id) await db.from('contact_relations').delete().eq('id', r.reciprocal_id);
  else if (r.related_contact_id) await db.from('contact_relations').delete().eq('contact_id', r.related_contact_id).eq('related_contact_id', r.contact_id);
  await db.from('contact_relations').delete().eq('reciprocal_id', id);
  refresh(contactId, r.contact_id, r.related_contact_id);
  return { ok: true };
}

/* --------------------------------------------------------------- profile -- */

/** «Επεξεργασία πελάτη»: όλα τα στοιχεία της φόρμας σε μία αποθήκευση. */
export async function saveCustomerProfile(contactId: string, input: CustomerProfileInput): Promise<Result> {
  await requirePermission('leads', 'edit');
  if (!UUID.test(contactId ?? '')) return { ok: false, error: 'Άγνωστος πελάτης.' };
  const c = cleanCustomerProfile(input);
  if (c.error !== undefined) return { ok: false, error: c.error };
  const db = (await createSupabaseServerClient()) as any;
  const base: Record<string, unknown> = { full_name: c.fullName, email: c.email, phone: c.phone, groups: c.groups, tags: c.tags, updated_at: new Date().toISOString() };
  const extra: Record<string, unknown> = {
    first_name: c.firstName, last_name: c.lastName, gender: c.gender, date_of_birth: c.dateOfBirth, id_number: c.idNumber, member_code: c.memberCode,
    phone2: c.phone2, fax: c.fax, address: c.address, city: c.city, postcode: c.postcode, country: c.country, profession: c.profession, company: c.company,
    registered_at: c.registeredAt, receive_sms: c.receiveSms, receive_email: c.receiveEmail, receive_push: c.receivePush, notes: c.notes,
    ...(c.photoPath !== undefined ? { photo_path: c.photoPath } : {}),
  };
  let { error } = await db.from('contacts').update({ ...base, ...extra }).eq('id', contactId);
  let partial = false;
  if (error && missingCol(error.message)) { partial = true; ({ error } = await db.from('contacts').update(base).eq('id', contactId)); }
  if (error) return { ok: false, error: /duplicate key|contacts_email_key/i.test(error.message) ? 'Αυτό το email ανήκει ήδη σε άλλον πελάτη.' : error.message };
  // Νέες ομάδες → και στη λίστα ομάδων (best-effort).
  if (c.groups.length) {
    const { data: known } = await db.from('contact_groups').select('name');
    const have = new Set(((known ?? []) as any[]).map((g) => g.name));
    const add = c.groups.filter((g) => !have.has(g));
    if (add.length) await db.from('contact_groups').insert(add.map((name) => ({ name })));
  }
  await logActivity({ entityType: 'contact', entityId: contactId, action: 'updated' });
  refresh(contactId);
  return partial ? { ok: false, error: 'Αποθηκεύτηκαν όνομα, επικοινωνία, ομάδες και tags. Τα υπόλοιπα πεδία θέλουν το migration 0094.' } : { ok: true };
}

/* ------------------------------------------------------------ default OTP -- */

/**
 * Προεπιλεγμένος κωδικός σύνδεσης στην εφαρμογή. Αποθηκεύεται μόνο ως hash
 * (migration 0093) και δεν επιστρέφεται ποτέ — η καρτέλα δείχνει μόνο
 * «Ορίστηκε» / «Δεν έχει οριστεί». Κενό = καθαρισμός.
 */
export async function setDefaultOtp(contactId: string, code: string | null): Promise<Result & { setAt?: string | null }> {
  await requirePermission('leads', 'edit');
  if (!UUID.test(contactId ?? '')) return { ok: false, error: 'Άγνωστος πελάτης.' };
  const v = (code ?? '').trim();
  if (v && !/^\d{4,8}$/.test(v)) return { ok: false, error: 'Ο κωδικός πρέπει να έχει 4 έως 8 ψηφία.' };
  const db = (await createSupabaseServerClient()) as any;
  const { data, error } = await db.rpc('set_contact_default_otp', { p_contact: contactId, p_code: v || null });
  if (error) return { ok: false, error: missingCol(error.message) || /function/i.test(error.message) ? 'Λείπει το migration 0093 στη βάση.' : error.message };
  await logActivity({ entityType: 'contact', entityId: contactId, action: v ? 'default_otp_set' : 'default_otp_cleared' });
  refresh(contactId);
  return { ok: true, setAt: (data as string | null) ?? null };
}

/* ---------------------------------------------------------- communication -- */

/** «Αποστολή μηνύματος» από την καρτέλα πελάτη. Η ημερομηνία καταγράφεται αυτόματα. */
export async function sendCustomerMessage(contactId: string, p: { channel: 'email' | 'sms' | 'whatsapp'; subject?: string; body: string }): Promise<Result & { status?: string }> {
  await requirePermission('leads', 'edit');
  if (!UUID.test(contactId ?? '')) return { ok: false, error: 'Άγνωστος πελάτης.' };
  if (!['email', 'sms', 'whatsapp'].includes(p.channel)) return { ok: false, error: 'Διαλέξτε κανάλι.' };
  const body = (p.body ?? '').trim().slice(0, 4000);
  if (!body) return { ok: false, error: 'Γράψτε το μήνυμα.' };
  const db = (await createSupabaseServerClient()) as any;
  const { data: c } = await db.from('contacts').select('email, phone').eq('id', contactId).maybeSingle();
  if (!c) return { ok: false, error: 'Ο πελάτης δεν βρέθηκε.' };
  const to = p.channel === 'email' ? c.email : c.phone;
  if (!to) return { ok: false, error: p.channel === 'email' ? 'Ο πελάτης δεν έχει email.' : 'Ο πελάτης δεν έχει κινητό.' };
  const { data: lead } = await db.from('leads').select('id').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const r = await sendMessage({ contactId, leadId: lead?.id ?? null, channel: p.channel, to, subject: (p.subject ?? '').trim().slice(0, 200) || null, body, firstResponse: true });
  refresh(contactId);
  if (r.status === 'failed') return { ok: false, error: 'Το μήνυμα δεν στάλθηκε — ελέγξτε τη ρύθμιση του καναλιού (Ρυθμίσεις → Επικοινωνία).' };
  return { ok: true, status: r.status };
}
