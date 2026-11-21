'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { convertDealToProject } from '@/app/actions/deals';

/**
 * Έργα & μονάδες — η ροή «Αγορά γης → Deal Analyzer → Έργο» και η πλήρης
 * διαχείριση της δομής (έργο, κτίρια, φάσεις, μονάδες: δημιουργία, αλλαγή,
 * διαγραφή). Κάθε ενέργεια επιστρέφει { ok, error } με κατανοητό μήνυμα.
 */

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const FK = '23503';
const sb = async () => (await createSupabaseServerClient()) as any;

function slugify(name: string): string {
  return `${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project'}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Βρίσκει την ανάλυση (deal) που φτιάχτηκε από ένα οικόπεδο. */
async function dealForParcel(s: any, parcelId: string): Promise<string | null> {
  const { data: p } = await s.from('land_parcels').select('deal_id').eq('id', parcelId).maybeSingle();
  if (p?.deal_id) return p.deal_id as string;
  const { data: d } = await s.from('deals').select('id').eq('inputs->>sourceParcelId', parcelId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (d?.id as string) ?? null;
}

/** Συνδέει έργο ↔ ανάλυση ↔ οικόπεδο (σιωπηλά αν δεν υπάρχουν ακόμη οι στήλες). */
async function linkOrigin(s: any, projectId: string, dealId: string | null, parcelId: string | null) {
  const patch: Record<string, string> = {};
  if (dealId) patch.source_deal_id = dealId;
  if (parcelId) patch.source_parcel_id = parcelId;
  if (Object.keys(patch).length) await s.from('projects').update(patch).eq('id', projectId);
  if (parcelId) {
    await s.from('land_parcels').update({ project_id: projectId, ...(dealId ? { deal_id: dealId } : {}) }).eq('id', parcelId);
    await s.from('land_parcels').update({ stage: 'acquired' }).eq('id', parcelId);
    await logActivity({ entityType: 'land_parcel', entityId: parcelId, action: 'converted_to_project', metadata: { projectId } });
  }
}

/** Ανάλυση → Έργο, σε οποιοδήποτε στάδιο (όχι μόνο μετά την έγκριση). */
export async function convertDealNow(dealId: string): Promise<Res<{ projectId: string }>> {
  await requirePermission('projects', 'edit');
  const s = await sb();
  const { data: d } = await s.from('deals').select('id, project_id, inputs').eq('id', dealId).maybeSingle();
  if (!d) return { ok: false, error: 'Η ανάλυση δεν βρέθηκε.' };
  let projectId: string;
  try { projectId = await convertDealToProject(dealId); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Το έργο δεν δημιουργήθηκε.' }; }
  const parcelId = (d.inputs?.sourceParcelId as string | undefined) ?? null;
  await linkOrigin(s, projectId, dealId, parcelId);
  revalidatePath('/deal-analyzer'); revalidatePath(`/deal-analyzer/${dealId}`); revalidatePath('/acquisitions'); revalidatePath('/projects');
  return { ok: true, projectId };
}

/**
 * Οικόπεδο → Έργο απευθείας. Αν το οικόπεδο έχει ήδη ανάλυση, το έργο φτιάχνεται
 * από την ανάλυση (με τις μονάδες της)· αλλιώς ένα έργο με τα στοιχεία του οικοπέδου.
 */
export async function convertParcelToProject(parcelId: string): Promise<Res<{ projectId: string }>> {
  await requirePermission('projects', 'edit');
  const s = await sb();
  const { data: p } = await s.from('land_parcels').select('id, reference, location, plot_size_sqm, zone, latitude, longitude, notes').eq('id', parcelId).maybeSingle();
  if (!p) return { ok: false, error: 'Το οικόπεδο δεν βρέθηκε.' };
  const { data: linked } = await s.from('land_parcels').select('project_id').eq('id', parcelId).maybeSingle();
  if (linked?.project_id) return { ok: true, projectId: linked.project_id as string };

  const dealId = await dealForParcel(s, parcelId);
  if (dealId) return convertDealNow(dealId);

  const { data: org } = await s.from('organizations').select('id').limit(1).maybeSingle();
  const desc = [p.plot_size_sqm ? `Οικόπεδο ${p.plot_size_sqm} m²` : null, p.zone ? `Ζώνη ${p.zone}` : null].filter(Boolean).join(', ');
  const { data: project, error } = await s.from('projects').insert({
    name: p.reference, slug: slugify(p.reference), location: p.location ?? null, status: 'planning', description: desc || null,
    ...(p.latitude != null ? { latitude: p.latitude, longitude: p.longitude } : {}),
    ...(org ? { organization_id: org.id } : {}),
  }).select('id').single();
  if (error || !project) return { ok: false, error: error?.message ?? 'Το έργο δεν δημιουργήθηκε.' };
  await logActivity({ entityType: 'project', entityId: project.id, action: 'created_from_parcel', metadata: { parcelId } });
  await linkOrigin(s, project.id, null, parcelId);
  revalidatePath('/acquisitions'); revalidatePath(`/acquisitions/${parcelId}`); revalidatePath('/projects');
  return { ok: true, projectId: project.id as string };
}

/** Νέο έργο (με ημερομηνία παράδοσης) — επιστρέφει το id για να ανοίξει αμέσως. */
export async function createProjectFull(p: { name: string; location?: string; status?: string; deliveryDate?: string | null; description?: string }): Promise<Res<{ id: string }>> {
  await requirePermission('projects', 'edit');
  const name = p.name?.trim();
  if (!name) return { ok: false, error: 'Δώστε όνομα έργου.' };
  const s = await sb();
  const { data: org } = await s.from('organizations').select('id').limit(1).maybeSingle();
  const { data, error } = await s.from('projects').insert({
    name, slug: slugify(name), location: p.location?.trim() || null, status: p.status || 'planning', description: p.description?.trim() || null,
    ...(p.deliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(p.deliveryDate) ? { delivery_date: p.deliveryDate } : {}),
    ...(org ? { organization_id: org.id } : {}),
  }).select('id').single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Το έργο δεν δημιουργήθηκε.' };
  await logActivity({ entityType: 'project', entityId: data.id, action: 'created' });
  revalidatePath('/projects');
  return { ok: true, id: data.id as string };
}

/** Διαγραφή έργου. Δεν επιτρέπεται όταν κάποια μονάδα έχει κράτηση, συμβόλαιο ή ιδιοκτήτη. */
export async function deleteProject(projectId: string): Promise<Res> {
  await requirePermission('projects', 'edit');
  const s = await sb();
  const { data: us } = await s.from('units').select('id').eq('project_id', projectId);
  const ids = ((us ?? []) as { id: string }[]).map((u) => u.id);
  if (ids.length) {
    const [r, c, h] = await Promise.all([
      s.from('reservations').select('id', { count: 'exact', head: true }).in('unit_id', ids),
      s.from('contracts').select('id', { count: 'exact', head: true }).in('unit_id', ids),
      s.from('homeowners').select('id', { count: 'exact', head: true }).in('unit_id', ids),
    ]);
    if ((r.count ?? 0) + (c.count ?? 0) + (h.count ?? 0) > 0) return { ok: false, error: 'Το έργο έχει μονάδες με κρατήσεις, συμβόλαια ή ιδιοκτήτες και δεν μπορεί να διαγραφεί. Αλλάξτε την κατάστασή του σε «Ολοκληρώθηκε» ή «Σε αναμονή».' };
  }
  // Χαλαρές συνδέσεις: αποσυνδέονται, δεν διαγράφονται.
  await s.from('deals').update({ project_id: null }).eq('project_id', projectId);
  await s.from('land_parcels').update({ project_id: null }).eq('project_id', projectId);
  await s.from('leads').update({ preferred_project_id: null }).eq('preferred_project_id', projectId);
  await s.from('contractor_project_assignments').delete().eq('project_id', projectId);
  if (ids.length) {
    await s.from('viewings').delete().in('unit_id', ids);
    await s.from('units').update({ building_id: null, phase_id: null }).in('id', ids);
  }
  await s.from('project_milestones').update({ phase_id: null }).eq('project_id', projectId);
  const { error } = await s.from('projects').delete().eq('id', projectId);
  if (error) return { ok: false, error: error.code === FK ? 'Το έργο έχει συνδεδεμένα στοιχεία (π.χ. εργασίες κατασκευής ή αιτήματα συντήρησης) και δεν μπορεί να διαγραφεί.' : error.message };
  await logActivity({ entityType: 'project', entityId: projectId, action: 'deleted' });
  revalidatePath('/projects');
  return { ok: true };
}

// ── Κτίρια & φάσεις ─────────────────────────────────────────────────────────

export async function saveBuilding(p: { projectId: string; id?: string; name: string; floors?: number | null }): Promise<Res> {
  await requirePermission('projects', 'edit');
  if (!p.name?.trim()) return { ok: false, error: 'Δώστε όνομα κτιρίου.' };
  const s = await sb();
  const row = { name: p.name.trim().slice(0, 80), floors: p.floors ?? null };
  const { error } = p.id ? await s.from('buildings').update(row).eq('id', p.id).eq('project_id', p.projectId) : await s.from('buildings').insert({ ...row, project_id: p.projectId });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${p.projectId}`);
  return { ok: true };
}

export async function deleteBuilding(projectId: string, id: string): Promise<Res> {
  await requirePermission('projects', 'edit');
  const s = await sb();
  await s.from('units').update({ building_id: null }).eq('building_id', id);
  await s.from('project_phases').update({ building_id: null }).eq('building_id', id);
  const { error } = await s.from('buildings').delete().eq('id', id).eq('project_id', projectId);
  if (error) return { ok: false, error: error.code === FK ? 'Το κτίριο χρησιμοποιείται ακόμη και δεν μπορεί να διαγραφεί.' : error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function savePhase(p: { projectId: string; id?: string; name: string; buildingId?: string | null; sequence?: number | null }): Promise<Res> {
  await requirePermission('projects', 'edit');
  if (!p.name?.trim()) return { ok: false, error: 'Δώστε όνομα φάσης.' };
  const s = await sb();
  const row = { name: p.name.trim().slice(0, 80), building_id: p.buildingId || null, sequence: p.sequence ?? 1 };
  const { error } = p.id ? await s.from('project_phases').update(row).eq('id', p.id).eq('project_id', p.projectId) : await s.from('project_phases').insert({ ...row, project_id: p.projectId });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${p.projectId}`);
  return { ok: true };
}

export async function deletePhase(projectId: string, id: string): Promise<Res> {
  await requirePermission('projects', 'edit');
  const s = await sb();
  await s.from('units').update({ phase_id: null }).eq('phase_id', id);
  await s.from('project_milestones').update({ phase_id: null }).eq('phase_id', id);
  await s.from('construction_tasks').update({ phase_id: null }).eq('phase_id', id);
  const { error } = await s.from('project_phases').delete().eq('id', id).eq('project_id', projectId);
  if (error) return { ok: false, error: error.code === FK ? 'Η φάση χρησιμοποιείται ακόμη και δεν μπορεί να διαγραφεί.' : error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// ── Μονάδες ─────────────────────────────────────────────────────────────────

/** Γρήγορη αλλαγή κατάστασης μονάδας από τον πίνακα. */
export async function setUnitStatus(projectId: string, unitId: string, status: string): Promise<Res> {
  await requirePermission('projects', 'edit');
  if (!['available', 'reserved', 'sold', 'handed_over', 'blocked'].includes(status)) return { ok: false, error: 'Άγνωστη κατάσταση.' };
  const s = await sb();
  const { error } = await s.from('units').update({ status, updated_at: new Date().toISOString() }).eq('id', unitId).eq('project_id', projectId);
  if (error) return { ok: false, error: error.message };
  await logActivity({ entityType: 'unit', entityId: unitId, action: 'status_changed', metadata: { to: status } });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/** Διαγραφή μονάδας — μόνο αν δεν έχει ιστορικό πώλησης (κράτηση, συμβόλαιο, ιδιοκτήτη, αιτήματα). */
export async function deleteUnit(projectId: string, unitId: string): Promise<Res> {
  await requirePermission('projects', 'edit');
  const s = await sb();
  const [r, c, h, t] = await Promise.all([
    s.from('reservations').select('id', { count: 'exact', head: true }).eq('unit_id', unitId),
    s.from('contracts').select('id', { count: 'exact', head: true }).eq('unit_id', unitId),
    s.from('homeowners').select('id', { count: 'exact', head: true }).eq('unit_id', unitId),
    s.from('maintenance_tickets').select('id', { count: 'exact', head: true }).eq('unit_id', unitId),
  ]);
  if ((r.count ?? 0) + (c.count ?? 0) + (h.count ?? 0) + (t.count ?? 0) > 0) return { ok: false, error: 'Η μονάδα έχει ιστορικό (κράτηση, συμβόλαιο, ιδιοκτήτη ή αιτήματα) και δεν διαγράφεται. Ορίστε την ως «Μη διαθέσιμη».' };
  await s.from('viewings').delete().eq('unit_id', unitId);
  const { error } = await s.from('units').delete().eq('id', unitId).eq('project_id', projectId);
  if (error) return { ok: false, error: error.code === FK ? 'Η μονάδα έχει συνδεδεμένα στοιχεία και δεν μπορεί να διαγραφεί. Ορίστε την ως «Μη διαθέσιμη».' : error.message };
  await logActivity({ entityType: 'unit', entityId: unitId, action: 'deleted' });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
