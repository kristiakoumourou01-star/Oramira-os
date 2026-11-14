'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pctOf = (v: unknown) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null; };
const day = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Νέο συνεργαζόμενο agency. */
export async function createAgency(p: { name: string; contactName?: string; email?: string; phone?: string; defaultPct?: number | string | null }): Promise<R<{ id: string }>> {
  await requirePermission('projects', 'edit');
  const name = p.name?.trim().slice(0, 120);
  if (!name) return { ok: false, error: 'Δώστε όνομα agency.' };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any).from('agencies').insert({ name, contact_name: p.contactName?.trim() || null, email: p.email?.trim() || null, phone: p.phone?.trim() || null, default_commission_pct: pctOf(p.defaultPct) }).select('id').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

/**
 * Ανάθεση πώλησης σε agency: όλο το έργο (unitIds κενό) ή συγκεκριμένες μονάδες.
 * Αποκλειστικότητα: δεν επιτρέπεται δεύτερο agency εκεί που υπάρχει αποκλειστικό, και το αντίστροφο.
 */
export async function addAgencyListing(p: { agencyId: string; projectId: string; unitIds?: string[]; pct?: number | string | null; exclusive?: boolean; startDate?: string | null; endDate?: string | null; notes?: string }): Promise<R> {
  await requirePermission('projects', 'edit');
  if (!UUID.test(p.agencyId) || !UUID.test(p.projectId)) return { ok: false, error: 'Διαλέξτε agency.' };
  const units = (p.unitIds ?? []).filter((x) => UUID.test(x));
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await (supabase as any).from('agency_listings').select('id, agency_id, unit_id, exclusive, end_date, agencies(name)').eq('project_id', p.projectId);
  const active = ((existing ?? []) as any[]).filter((l) => !l.end_date || l.end_date >= today);
  const overlaps = (l: any) => !units.length || !l.unit_id || units.includes(l.unit_id);
  for (const l of active) {
    if (l.agency_id === p.agencyId || !overlaps(l)) continue;
    if (l.exclusive) return { ok: false, error: `Υπάρχει αποκλειστικότητα με «${l.agencies?.name ?? 'άλλο agency'}» σε αυτά τα ακίνητα.` };
    if (p.exclusive) return { ok: false, error: `Για αποκλειστικότητα δεν πρέπει να υπάρχει άλλο agency εκεί («${l.agencies?.name ?? ''}»). Αφαιρέστε το πρώτα.` };
  }
  const base = { agency_id: p.agencyId, project_id: p.projectId, commission_pct: pctOf(p.pct), exclusive: !!p.exclusive, start_date: day(p.startDate), end_date: day(p.endDate), notes: p.notes?.trim().slice(0, 500) || null };
  const rows = units.length ? units.map((unit_id) => ({ ...base, unit_id })) : [{ ...base, unit_id: null }];
  const { error } = await (supabase as any).from('agency_listings').insert(rows);
  if (error) return { ok: false, error: error.message };
  await logActivity({ entityType: 'project', entityId: p.projectId, action: 'agency_assigned', metadata: { agencyId: p.agencyId, units: units.length || 'all', exclusive: !!p.exclusive } });
  revalidatePath(`/projects/${p.projectId}`);
  return { ok: true };
}

/** Αφαίρεση ανάθεσης (μίας γραμμής ή όλων του agency στο έργο). */
export async function removeAgencyListing(projectId: string, listingIds: string[]): Promise<R> {
  await requirePermission('projects', 'edit');
  const ids = listingIds.filter((x) => UUID.test(x));
  if (!ids.length) return { ok: false, error: 'Τίποτα για αφαίρεση.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await (supabase as any).from('agency_listings').delete().in('id', ids).eq('project_id', projectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
