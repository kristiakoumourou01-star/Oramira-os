'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { notifyTicketHomeowner } from '@/lib/notifications';

/**
 * Ιστορικό μονάδας & διαχείριση ακινήτου: ιδιοκτήτες στον χρόνο (πώληση,
 * μεταπώληση, μεταβίβαση), ενοικιάσεις, χρεώσεις προς τον ιδιοκτήτη και
 * ετήσια κοινόχρηστα/συντήρηση.
 */

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const sb = async () => (await createSupabaseServerClient()) as any;
const day = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const money = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
const MISSING = 'Η βάση δεν έχει ενημερωθεί ακόμη για αυτή τη λειτουργία. Δοκιμάστε ξανά αργότερα.';
const err = (e: { code?: string; message: string }) => (e.code === '42P01' || e.code === '42703' || e.code === 'PGRST204' || e.code === 'PGRST205' ? MISSING : e.message);

async function unitPaths(s: any, unitId: string) {
  const { data: u } = await s.from('units').select('project_id').eq('id', unitId).maybeSingle();
  if (u?.project_id) revalidatePath(`/projects/${u.project_id}/units/${unitId}`);
  revalidatePath('/property');
  return (u?.project_id as string | undefined) ?? null;
}

/**
 * Νέος ιδιοκτήτης (πώληση, μεταπώληση, μεταβίβαση, κληρονομιά) ή αφαίρεση
 * ιδιοκτήτη. Κρατά τον προηγούμενο στο ιστορικό· ο νέος παίρνει πρόσβαση στην
 * πλατφόρμα ιδιοκτητών, ο παλιός τη χάνει.
 */
export async function changeUnitOwner(p: { unitId: string; contactId: string | null; kind: string; date?: string | null; price?: number | null; note?: string }): Promise<Res> {
  const me = await requirePermission('property', 'edit');
  const s = await sb();
  const { data: unit } = await s.from('units').select('id, buyer_contact_id, status').eq('id', p.unitId).maybeSingle();
  if (!unit) return { ok: false, error: 'Η μονάδα δεν βρέθηκε.' };
  const { data: ho } = await s.from('homeowners').select('id, contact_id').eq('unit_id', p.unitId).maybeSingle();
  const previous = (ho?.contact_id ?? unit.buyer_contact_id ?? null) as string | null;
  if (p.contactId && p.contactId === previous) return { ok: false, error: 'Αυτός είναι ήδη ο ιδιοκτήτης.' };
  const when = day(p.date) ?? new Date().toISOString().slice(0, 10);

  if (p.contactId) {
    if (ho) await s.from('homeowners').update({ contact_id: p.contactId, moved_in_at: when }).eq('id', ho.id);
    else await s.from('homeowners').insert({ contact_id: p.contactId, unit_id: p.unitId, moved_in_at: when });
    const patch: Record<string, unknown> = { buyer_contact_id: p.contactId, updated_at: new Date().toISOString() };
    if (unit.status === 'available' || unit.status === 'reserved') patch.status = 'sold';
    await s.from('units').update(patch).eq('id', p.unitId);
    await s.from('contacts').update({ is_homeowner: true }).eq('id', p.contactId);
    const { data: prof } = await s.from('profiles').select('id, role').eq('contact_id', p.contactId).maybeSingle();
    if (prof && prof.role === 'buyer') await s.from('profiles').update({ role: 'homeowner' }).eq('id', prof.id);
  } else {
    if (ho) await s.from('homeowners').delete().eq('id', ho.id);
    await s.from('units').update({ buyer_contact_id: null, occupancy_status: 'vacant', updated_at: new Date().toISOString() }).eq('id', p.unitId);
  }

  const base = { unit_id: p.unitId, previous_contact_id: previous, new_contact_id: p.contactId, transfer_date: when, note: p.note?.trim().slice(0, 500) || null, created_by: me.id };
  const { error } = await s.from('unit_ownership_history').insert({ ...base, kind: p.contactId ? p.kind || 'transfer' : 'removed', price: money(p.price) });
  if (error) await s.from('unit_ownership_history').insert(base); // πριν το migration 0095
  await logActivity({ entityType: 'unit', entityId: p.unitId, action: p.contactId ? 'owner_changed' : 'owner_removed', metadata: { contactId: p.contactId, kind: p.kind } });
  await unitPaths(s, p.unitId);
  return { ok: true };
}

/** Διόρθωση ή διαγραφή μιας εγγραφής ιστορικού ιδιοκτησίας (λάθος καταχώρηση). */
export async function deleteOwnershipEntry(unitId: string, id: string): Promise<Res> {
  await requirePermission('property', 'edit');
  const s = await sb();
  const { error } = await s.from('unit_ownership_history').delete().eq('id', id).eq('unit_id', unitId);
  if (error) return { ok: false, error: err(error) };
  await unitPaths(s, unitId);
  return { ok: true };
}

/** Χρήση της μονάδας: ιδιοκατοίκηση / ενοικίαση / κενό / εξοχικό. */
export async function setUnitOccupancy(unitId: string, status: string): Promise<Res> {
  await requirePermission('property', 'edit');
  if (!['owner_occupied', 'rented', 'vacant', 'holiday_home'].includes(status)) return { ok: false, error: 'Άγνωστη χρήση.' };
  const s = await sb();
  const { error } = await s.from('units').update({ occupancy_status: status, updated_at: new Date().toISOString() }).eq('id', unitId);
  if (error) return { ok: false, error: err(error) };
  await unitPaths(s, unitId);
  return { ok: true };
}

// ── Ενοικιάσεις ─────────────────────────────────────────────────────────────

export async function saveTenancy(p: { unitId: string; id?: string; tenantContactId?: string | null; tenantName?: string; startDate?: string | null; endDate?: string | null; monthlyRent?: number | null; deposit?: number | null; status?: string; notes?: string }): Promise<Res> {
  const me = await requirePermission('property', 'edit');
  if (!p.tenantContactId && !p.tenantName?.trim()) return { ok: false, error: 'Επιλέξτε ή γράψτε τον ενοικιαστή.' };
  const s = await sb();
  const status = ['active', 'ended', 'planned'].includes(p.status ?? '') ? p.status! : 'active';
  const { data: unit } = await s.from('units').select('buyer_contact_id').eq('id', p.unitId).maybeSingle();
  const row = {
    unit_id: p.unitId, tenant_contact_id: p.tenantContactId || null, tenant_name: p.tenantName?.trim().slice(0, 120) || null,
    start_date: day(p.startDate), end_date: day(p.endDate), monthly_rent: money(p.monthlyRent), deposit: money(p.deposit), status,
    notes: p.notes?.trim().slice(0, 1000) || null,
  };
  const { error } = p.id
    ? await s.from('unit_tenancies').update(row).eq('id', p.id).eq('unit_id', p.unitId)
    : await s.from('unit_tenancies').insert({ ...row, owner_contact_id: unit?.buyer_contact_id ?? null, created_by: me.id });
  if (error) return { ok: false, error: err(error) };
  if (status === 'active') await s.from('units').update({ occupancy_status: 'rented' }).eq('id', p.unitId);
  else if (status === 'ended') {
    const { count } = await s.from('unit_tenancies').select('id', { count: 'exact', head: true }).eq('unit_id', p.unitId).eq('status', 'active');
    if (!count) await s.from('units').update({ occupancy_status: unit?.buyer_contact_id ? 'owner_occupied' : 'vacant' }).eq('id', p.unitId);
  }
  await logActivity({ entityType: 'unit', entityId: p.unitId, action: p.id ? 'tenancy_updated' : 'tenancy_added', metadata: { status } });
  await unitPaths(s, p.unitId);
  return { ok: true };
}

export async function deleteTenancy(unitId: string, id: string): Promise<Res> {
  await requirePermission('property', 'edit');
  const s = await sb();
  const { error } = await s.from('unit_tenancies').delete().eq('id', id).eq('unit_id', unitId);
  if (error) return { ok: false, error: err(error) };
  await unitPaths(s, unitId);
  return { ok: true };
}

// ── Χρεώσεις & ετήσια συντήρηση ─────────────────────────────────────────────

/** Ετήσια χρέωση συντήρησης/κοινοχρήστων της μονάδας (κενό = καμία). */
export async function setAnnualFee(unitId: string, fee: number | null): Promise<Res> {
  await requirePermission('property', 'edit');
  const s = await sb();
  const { error } = await s.from('units').update({ annual_maintenance_fee: fee == null ? null : money(fee) }).eq('id', unitId);
  if (error) return { ok: false, error: err(error) };
  await unitPaths(s, unitId);
  return { ok: true };
}

/** Χρέωση στον ιδιοκτήτη (υπηρεσία / επισκευή / άλλο), προαιρετικά δεμένη σε αίτημα. */
export async function addCharge(p: { unitId: string; ticketId?: string | null; kind?: string; description: string; amount: number; dueDate?: string | null }): Promise<Res> {
  const me = await requirePermission('property', 'edit');
  const amount = money(p.amount);
  if (!amount) return { ok: false, error: 'Δώστε ποσό.' };
  if (!p.description?.trim()) return { ok: false, error: 'Γράψτε περιγραφή.' };
  const s = await sb();
  const { data: ho } = await s.from('homeowners').select('contact_id').eq('unit_id', p.unitId).maybeSingle();
  const { data: unit } = await s.from('units').select('buyer_contact_id').eq('id', p.unitId).maybeSingle();
  const kind = ['service', 'maintenance_fee', 'other'].includes(p.kind ?? '') ? p.kind! : 'service';
  const { error } = await s.from('unit_charges').insert({
    unit_id: p.unitId, contact_id: ho?.contact_id ?? unit?.buyer_contact_id ?? null, ticket_id: p.ticketId || null, kind,
    description: p.description.trim().slice(0, 300), amount, due_date: day(p.dueDate), created_by: me.id,
  });
  if (error) return { ok: false, error: err(error) };
  if (p.ticketId) {
    await s.from('ticket_updates').insert({ ticket_id: p.ticketId, author_id: me.id, note: `Χρέωση: €${amount} — ${p.description.trim()}` });
    await notifyTicketHomeowner(p.ticketId, { title: 'Νέα χρέωση για το αίτημά σας', body: `€${amount} — ${p.description.trim()}`, link: `/homeowner/maintenance/${p.ticketId}` }).catch(() => {});
    revalidatePath('/property/maintenance');
  }
  await logActivity({ entityType: 'unit', entityId: p.unitId, action: 'charge_added', metadata: { amount, kind } });
  await unitPaths(s, p.unitId);
  return { ok: true };
}

export async function setChargeStatus(id: string, status: 'pending' | 'paid' | 'cancelled'): Promise<Res> {
  await requirePermission('property', 'edit');
  const s = await sb();
  const { data: c, error } = await s.from('unit_charges').update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null }).eq('id', id).select('unit_id').maybeSingle();
  if (error) return { ok: false, error: err(error) };
  if (c?.unit_id) await unitPaths(s, c.unit_id);
  revalidatePath('/property/maintenance');
  return { ok: true };
}

export async function deleteCharge(id: string): Promise<Res> {
  await requirePermission('property', 'edit');
  const s = await sb();
  const { data: c } = await s.from('unit_charges').select('unit_id').eq('id', id).maybeSingle();
  const { error } = await s.from('unit_charges').delete().eq('id', id);
  if (error) return { ok: false, error: err(error) };
  if (c?.unit_id) await unitPaths(s, c.unit_id);
  revalidatePath('/property/maintenance');
  return { ok: true };
}

/**
 * Δημιουργεί τις ετήσιες χρεώσεις συντήρησης για ένα έτος: μία ανά μονάδα που
 * έχει ετήσιο ποσό και ιδιοκτήτη. Όσες υπάρχουν ήδη για το έτος παραλείπονται.
 */
export async function generateAnnualFees(p: { year: number; projectId?: string | null; dueDate?: string | null }): Promise<Res<{ created: number; skipped: number }>> {
  const me = await requirePermission('property', 'edit');
  const year = Math.round(Number(p.year));
  if (!year || year < 2000 || year > 2100) return { ok: false, error: 'Μη έγκυρο έτος.' };
  const s = await sb();
  let q = s.from('units').select('id, buyer_contact_id, annual_maintenance_fee').gt('annual_maintenance_fee', 0).not('buyer_contact_id', 'is', null);
  if (p.projectId) q = q.eq('project_id', p.projectId);
  const { data: units, error } = await q;
  if (error) return { ok: false, error: err(error) };
  const ids = ((units ?? []) as any[]).map((u) => u.id);
  if (!ids.length) return { ok: true, created: 0, skipped: 0 };
  const { data: existing } = await s.from('unit_charges').select('unit_id').eq('kind', 'maintenance_fee').eq('period_year', year).neq('status', 'cancelled').in('unit_id', ids);
  const have = new Set(((existing ?? []) as any[]).map((x) => x.unit_id));
  const rows = ((units ?? []) as any[]).filter((u) => !have.has(u.id)).map((u) => ({
    unit_id: u.id, contact_id: u.buyer_contact_id, kind: 'maintenance_fee', period_year: year, amount: Number(u.annual_maintenance_fee),
    description: `Ετήσια συντήρηση ${year}`, due_date: day(p.dueDate) ?? `${year}-03-31`, created_by: me.id,
  }));
  if (rows.length) {
    const { error: e2 } = await s.from('unit_charges').insert(rows);
    if (e2) return { ok: false, error: err(e2) };
  }
  revalidatePath('/property');
  return { ok: true, created: rows.length, skipped: have.size };
}
