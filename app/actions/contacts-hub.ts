'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { onNewLead } from '@/lib/automation-events';
import { ALL_ROLES, CONTACT_STATUSES, EXTRA_ROLES, FLAG_COLUMN, FLAG_ROLES, rolesFromRow, rolesToColumns, type ContactRole, type ContactStatus } from '@/lib/contacts-hub-shared';
import { LEAD_SOURCES } from '@/lib/lead-automation-shared';

type Result = { ok: true; id?: string } | { ok: false; error: string; existingId?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIG = 'Λείπει το migration 0071 στη βάση.';
const missing = (m: string) => /does not exist|schema cache|Could not find|column/i.test(m);
const cleanRoles = (r: unknown): ContactRole[] => (Array.isArray(r) ? r.filter((x) => (ALL_ROLES as string[]).includes(x)) as ContactRole[] : []);
const refresh = (id?: string) => { revalidatePath('/crm/customers'); if (id) revalidatePath(`/crm/${id}`); };

export interface NewContactInput {
  name: string; email?: string; phone?: string; roles: ContactRole[]; status?: ContactStatus;
  ownerId?: string | null; source?: string; language?: string; tags?: string[]; note?: string; createLead?: boolean;
}

/** Νέα επαφή από το προσωπικό (πελάτης, αγοραστής, επενδυτής, συνεργάτης…). */
export async function createContact(input: NewContactInput): Promise<Result> {
  const me = await requirePermission('leads', 'edit');
  const name = (input.name ?? '').trim().slice(0, 160);
  const email = (input.email ?? '').trim().toLowerCase().slice(0, 200) || null;
  const phone = (input.phone ?? '').trim().slice(0, 40) || null;
  if (!name) return { ok: false, error: 'Γράψτε ονοματεπώνυμο.' };
  if (!email && !phone) return { ok: false, error: 'Χρειάζεται email ή τηλέφωνο.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Το email δεν φαίνεται σωστό.' };
  const roles = cleanRoles(input.roles);
  const source = (LEAD_SOURCES as readonly string[]).includes(input.source ?? '') ? input.source! : null;
  const supabase = await createSupabaseServerClient();
  const db = supabase as any;

  if (email) {
    const { data: same } = await db.from('contacts').select('id, full_name').ilike('email', email).maybeSingle();
    if (same) return { ok: false, error: `Υπάρχει ήδη επαφή με αυτό το email: ${same.full_name ?? email}.`, existingId: same.id };
  }

  const { data, error } = await db.from('contacts').insert({
    full_name: name, email, phone,
    status: (CONTACT_STATUSES as readonly string[]).includes(input.status ?? '') ? input.status : 'active',
    owner_id: input.ownerId && UUID.test(input.ownerId) ? input.ownerId : null,
    first_touch_source: source,
    preferred_language: (input.language ?? '').slice(0, 5) || null,
    tags: (input.tags ?? []).map((t) => String(t).slice(0, 40)).slice(0, 30),
    ...rolesToColumns(roles.length ? roles : ['lead']),
  }).select('id').single();
  if (error) return { ok: false, error: missing(error.message) ? MIG : error.message };

  const id = data.id as string;
  if (input.note?.trim()) await db.from('notes').insert({ entity_type: 'contact', entity_id: id, author_id: me.id, body: input.note.trim().slice(0, 4000) });
  if (input.createLead) {
    const { data: lead } = await db.from('leads').insert({ contact_id: id, source: source ?? 'other', status: 'new', assigned_to: input.ownerId && UUID.test(input.ownerId) ? input.ownerId : null }).select('id').single();
    if (lead?.id) await onNewLead(lead.id);
  }
  await logActivity({ entityType: 'contact', entityId: id, action: 'contact_created', metadata: { roles } });
  refresh(id);
  return { ok: true, id };
}

/** Ιδιότητες, κατάσταση, υπεύθυνος μιας επαφής (το ιστορικό γράφεται αυτόματα). */
export async function updateContactProfile(contactId: string, p: { roles?: ContactRole[]; status?: ContactStatus; ownerId?: string | null }, note?: string): Promise<Result> {
  const me = await requirePermission('leads', 'edit');
  if (!UUID.test(contactId ?? '')) return { ok: false, error: 'Άγνωστη επαφή.' };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.roles) Object.assign(patch, rolesToColumns(cleanRoles(p.roles)));
  if (p.status && (CONTACT_STATUSES as readonly string[]).includes(p.status)) patch.status = p.status;
  if (p.ownerId !== undefined) patch.owner_id = p.ownerId && UUID.test(p.ownerId) ? p.ownerId : null;
  const supabase = await createSupabaseServerClient();
  const { error } = await (supabase as any).from('contacts').update(patch).eq('id', contactId);
  if (error) return { ok: false, error: missing(error.message) ? MIG : error.message };
  if (note?.trim()) await (supabase as any).from('contact_events').insert({ contact_id: contactId, kind: 'note', note: note.trim().slice(0, 1000), actor_id: me.id });
  refresh(contactId);
  return { ok: true };
}

/** Μετατροπή: π.χ. Lead → Αγοραστής (το «από» φεύγει, αν δοθεί). Με σημείωση στο ιστορικό. */
export async function convertContact(contactId: string, from: ContactRole | null, to: ContactRole, note?: string): Promise<Result> {
  const me = await requirePermission('leads', 'edit');
  if (!UUID.test(contactId ?? '') || !(ALL_ROLES as string[]).includes(to)) return { ok: false, error: 'Μη έγκυρη μετατροπή.' };
  const supabase = await createSupabaseServerClient();
  const db = supabase as any;
  const { data: c, error: e1 } = await db.from('contacts').select('is_lead, is_buyer, is_investor, is_homeowner, is_newsletter_subscriber, extra_roles').eq('id', contactId).single();
  if (e1) return { ok: false, error: missing(e1.message) ? MIG : e1.message };
  const roles = new Set(rolesFromRow(c));
  if (from) roles.delete(from);
  roles.add(to);
  const { error } = await db.from('contacts').update({ ...rolesToColumns([...roles]), updated_at: new Date().toISOString() }).eq('id', contactId);
  if (error) return { ok: false, error: error.message };
  await db.from('contact_events').insert({ contact_id: contactId, kind: 'converted', from_value: from, to_value: to, note: note?.trim().slice(0, 1000) || null, actor_id: me.id });
  await logActivity({ entityType: 'contact', entityId: contactId, action: 'contact_converted', metadata: { from, to } });
  refresh(contactId);
  return { ok: true };
}

/** Μαζικές αλλαγές από τη λίστα (επιλεγμένες επαφές). */
export async function bulkUpdateContacts(ids: string[], op: { addRole?: ContactRole; removeRole?: ContactRole; status?: ContactStatus; ownerId?: string | null }): Promise<Result & { updated?: number }> {
  await requirePermission('leads', 'edit');
  const list = (ids ?? []).filter((x) => UUID.test(x)).slice(0, 500);
  if (!list.length) return { ok: false, error: 'Δεν επιλέξατε επαφές.' };
  const supabase = await createSupabaseServerClient();
  const db = supabase as any;
  const simple: Record<string, unknown> = {};
  if (op.status && (CONTACT_STATUSES as readonly string[]).includes(op.status)) simple.status = op.status;
  if (op.ownerId !== undefined) simple.owner_id = op.ownerId && UUID.test(op.ownerId) ? op.ownerId : null;
  const role = op.addRole ?? op.removeRole;
  if (role && (FLAG_ROLES as readonly string[]).includes(role)) simple[FLAG_COLUMN[role as keyof typeof FLAG_COLUMN]] = !!op.addRole;
  if (Object.keys(simple).length) {
    const { error } = await db.from('contacts').update({ ...simple, updated_at: new Date().toISOString() }).in('id', list);
    if (error) return { ok: false, error: missing(error.message) ? MIG : error.message };
  }
  if (role && (EXTRA_ROLES as readonly string[]).includes(role)) {
    const { data: rows } = await db.from('contacts').select('id, extra_roles').in('id', list);
    for (const r of (rows ?? []) as any[]) {
      const cur = new Set<string>(r.extra_roles ?? []);
      if (op.addRole) cur.add(role); else cur.delete(role);
      await db.from('contacts').update({ extra_roles: [...cur] }).eq('id', r.id);
    }
  }
  refresh();
  return { ok: true, updated: list.length };
}

/** Νέο lead για μια υπάρχουσα επαφή (π.χ. επιστρέφων πελάτης). */
export async function createLeadForContact(contactId: string, source: string): Promise<Result> {
  await requirePermission('leads', 'edit');
  if (!UUID.test(contactId ?? '')) return { ok: false, error: 'Άγνωστη επαφή.' };
  const src = (LEAD_SOURCES as readonly string[]).includes(source) ? source : 'other';
  const supabase = await createSupabaseServerClient();
  const db = supabase as any;
  const { data, error } = await db.from('leads').insert({ contact_id: contactId, source: src, status: 'new' }).select('id').single();
  if (error) return { ok: false, error: error.message };
  await db.from('contacts').update({ is_lead: true }).eq('id', contactId);
  await onNewLead(data.id);
  refresh(contactId);
  revalidatePath('/crm/leads');
  return { ok: true, id: data.id };
}
