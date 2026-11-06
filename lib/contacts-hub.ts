import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCustomers } from '@/lib/customers';
import { rolesFromRow, type ContactEvent, type ContactListRow, type ContactStatus } from '@/lib/contacts-hub-shared';

export interface StaffOption { id: string; name: string }

/** Η ομάδα (για «υπεύθυνος» σε φίλτρα, ανάθεση και ιστορικό). */
export async function loadStaff(): Promise<StaffOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('profiles').select('id, full_name, role').in('role', ['admin', 'management', 'sales', 'finance', 'construction', 'viewer']).order('full_name');
  return ((data ?? []) as any[]).map((p) => ({ id: p.id, name: p.full_name ?? 'Χωρίς όνομα' }));
}

/** Όλες οι επαφές με ιδιότητες, κατάσταση, υπεύθυνο, τελευταία επαφή και αξία. */
export async function loadContactList(): Promise<{ rows: ContactListRow[]; staff: StaffOption[]; missing: boolean }> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as any;
  const [{ data: contacts, error }, { data: overview }, ledger, staff] = await Promise.all([
    db.from('contacts')
      .select('id, full_name, email, phone, is_lead, is_buyer, is_investor, is_homeowner, is_newsletter_subscriber, extra_roles, status, owner_id, first_touch_source, tags, groups, preferred_language, created_at, anonymized_at')
      .is('anonymized_at', null)
      .order('created_at', { ascending: false })
      .limit(5000),
    db.from('contact_overview').select('id, last_contact_at, open_leads, effective_owner, kyc_status').limit(5000),
    getCustomers(),
    loadStaff(),
  ]);
  if (error) return { rows: [], staff, missing: /column|does not exist|schema cache/i.test(error.message) };
  const ov = new globalThis.Map<string, any>(((overview ?? []) as any[]).map((o) => [o.id, o]));
  const money = new globalThis.Map(ledger.rows.map((r) => [r.contactId, r]));
  const names = new globalThis.Map(staff.map((s) => [s.id, s.name]));
  const rows: ContactListRow[] = ((contacts ?? []) as any[]).map((c) => {
    const o = ov.get(c.id) ?? {};
    const m = money.get(c.id);
    const ownerId = (o.effective_owner as string | null) ?? c.owner_id ?? null;
    return {
      id: c.id, name: c.full_name ?? c.email ?? 'Χωρίς όνομα', email: c.email, phone: c.phone,
      roles: rolesFromRow(c), status: (c.status ?? 'active') as ContactStatus,
      ownerId, ownerName: ownerId ? names.get(ownerId) ?? null : null,
      source: c.first_touch_source ?? null, tags: c.tags ?? [], groups: c.groups ?? [], language: c.preferred_language ?? null,
      createdAt: c.created_at, lastContactAt: o.last_contact_at ?? null, openLeads: Number(o.open_leads ?? 0), kycStatus: o.kyc_status ?? null,
      value: m?.contractValue ?? 0, paid: m?.paid ?? 0,
    };
  });
  return { rows, staff, missing: false };
}

/** Ιστορικό μιας επαφής: αλλαγές ιδιοτήτων/κατάστασης/υπεύθυνου, μετατροπές, leads. */
export async function loadContactEvents(contactId: string): Promise<{ events: ContactEvent[]; names: Record<string, string> }> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as any;
  const [{ data: ev }, { data: leads }, staff] = await Promise.all([
    db.from('contact_events').select('id, kind, from_value, to_value, note, created_at, actor:actor_id(full_name)').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(300),
    supabase.from('leads').select('id, source, created_at').eq('contact_id', contactId),
    loadStaff(),
  ]);
  const events: ContactEvent[] = [
    ...((ev ?? []) as any[]).map((e) => ({ id: e.id, kind: e.kind, from: e.from_value, to: e.to_value, note: e.note, actor: e.actor?.full_name ?? null, at: e.created_at })),
    ...((leads ?? []) as any[]).map((l) => ({ id: `lead-${l.id}`, kind: 'lead', from: null, to: l.source ?? null, note: null, actor: null, at: l.created_at })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return { events, names: Object.fromEntries(staff.map((s) => [s.id, s.name])) };
}
