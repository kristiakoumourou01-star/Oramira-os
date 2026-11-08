'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { logActivity } from '@/lib/activity';
import { MAX_IMPORT_ROWS, toUnitColumns, type ParsedUnit } from '@/lib/unit-import-shared';

export type ImportResult =
  | { ok: true; batchId: string | null; created: number; updated: number; skipped: number; buildingsCreated: number; note?: string }
  | { ok: false; error: string };
export type UndoResult = { ok: true; deleted: number; restored: number; kept: number } | { ok: false; error: string };
export interface ImportBatch { id: string; fileName: string | null; createdAt: string; created: number; updated: number; skipped: number; undoneAt: string | null; undoNote: string | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS = ['building_id', 'floor', 'type', 'status', 'price', 'sqm', 'internal_sqm', 'covered_veranda_sqm', 'uncovered_veranda_sqm', 'storage_sqm', 'plot_size_sqm', 'garden_sqm', 'bedrooms', 'bathrooms', 'parking_spaces', 'has_pool', 'commission_pct', 'description', 'custom_fields'];
const chunk = <T,>(a: T[], n: number): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/**
 * Write the units of one import. New unit numbers are created; existing ones
 * (same project, same number, case-insensitive) are updated only with the
 * columns the file filled — or skipped when `updateExisting` is off.
 */
export async function importUnits(input: { projectId: string; fileName?: string; units: ParsedUnit[]; updateExisting: boolean }): Promise<ImportResult> {
  const profile = await requirePermission('projects', 'edit');
  const { projectId } = input;
  if (!UUID.test(projectId ?? '')) return { ok: false, error: 'Άγνωστο έργο.' };
  if (!Array.isArray(input.units) || !input.units.length) return { ok: false, error: 'Δεν υπάρχουν μονάδες για εισαγωγή.' };
  if (input.units.length > MAX_IMPORT_ROWS) return { ok: false, error: `Έως ${MAX_IMPORT_ROWS} μονάδες ανά εισαγωγή.` };

  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase.from('projects').select('id, name').eq('id', projectId).maybeSingle();
  if (!project) return { ok: false, error: 'Το έργο δεν βρέθηκε.' };
  const { unitForms } = await getOrgSettingsRaw();

  const rows = input.units.map((u) => toUnitColumns(u, unitForms)).filter((x): x is NonNullable<typeof x> => !!x);
  const dupe = new Set<string>();
  for (const r of rows) { const k = r.unit_number.toLowerCase(); if (dupe.has(k)) return { ok: false, error: `Ο αριθμός «${r.unit_number}» υπάρχει δύο φορές.` }; dupe.add(k); }

  // Buildings by name (created when missing).
  const { data: bRows } = await supabase.from('buildings').select('id, name').eq('project_id', projectId);
  const buildings = new Map<string, string>(((bRows ?? []) as { id: string; name: string }[]).map((b) => [b.name.trim().toLowerCase(), b.id]));
  const createdBuildings: string[] = [];
  for (const name of Array.from(new Set(rows.map((r) => r.building).filter((b): b is string => !!b)))) {
    const k = name.toLowerCase();
    if (buildings.has(k)) continue;
    const { data: b, error } = await supabase.from('buildings').insert({ project_id: projectId, name }).select('id').single();
    if (error || !b) return { ok: false, error: `Το κτίριο «${name}» δεν δημιουργήθηκε: ${error?.message ?? ''}` };
    buildings.set(k, b.id); createdBuildings.push(b.id);
  }

  const { data: existingRaw, error: exErr } = await (supabase as any).from('units').select(`id, unit_number, ${COLS.join(', ')}`).eq('project_id', projectId);
  if (exErr) return { ok: false, error: `Οι μονάδες του έργου δεν διαβάστηκαν: ${exErr.message}` };
  const existing = new Map<string, any>(((existingRaw ?? []) as any[]).map((u) => [String(u.unit_number).toLowerCase(), u]));

  const toCreate: Record<string, unknown>[] = [];
  const toUpdate: { id: string; patch: Record<string, unknown>; before: Record<string, unknown> }[] = [];
  let skipped = 0;
  for (const r of rows) {
    const buildingId = r.building ? buildings.get(r.building.toLowerCase()) ?? null : undefined;
    const old = existing.get(r.unit_number.toLowerCase());
    if (!old) {
      toCreate.push({ project_id: projectId, unit_number: r.unit_number, ...(buildingId ? { building_id: buildingId } : {}), ...r.cols, custom_fields: r.custom });
      continue;
    }
    if (!input.updateExisting) { skipped++; continue; }
    const patch: Record<string, unknown> = { ...r.cols };
    if (buildingId !== undefined) patch.building_id = buildingId;
    if (Object.keys(r.custom).length) patch.custom_fields = { ...(old.custom_fields ?? {}), ...r.custom };
    const changed = Object.keys(patch).filter((k) => JSON.stringify(patch[k] ?? null) !== JSON.stringify(old[k] ?? null));
    if (!changed.length) { skipped++; continue; }
    const p: Record<string, unknown> = {}; const before: Record<string, unknown> = {};
    for (const k of changed) { p[k] = patch[k]; before[k] = old[k] ?? null; }
    toUpdate.push({ id: old.id, patch: p, before });
  }

  // Write. Keep what is done so far, so a failure half-way can still be undone.
  const createdIds: string[] = [];
  const updatedLog: { id: string; before: Record<string, unknown> }[] = [];
  let failure: string | null = null;
  for (const part of chunk(toCreate, 200)) {
    const { data, error } = await (supabase as any).from('units').insert(part).select('id');
    if (error) { failure = `Σταμάτησε στη δημιουργία μονάδων: ${error.message}`; break; }
    for (const d of data ?? []) createdIds.push(d.id);
  }
  // Price changes of existing units go through set_unit_prices so the price
  // history (migration 0065) says «εισαγωγή Excel» with the file name.
  const priceChanges: { id: string; price: number }[] = [];
  for (const u of toUpdate) if ('price' in u.patch) { priceChanges.push({ id: u.id, price: Number(u.patch.price) }); delete u.patch.price; }
  if (!failure) {
    for (const part of chunk(toUpdate, 20)) {
      const res = await Promise.all(part.map((u) => (Object.keys(u.patch).length ? (supabase as any).from('units').update({ ...u.patch, updated_at: new Date().toISOString() }).eq('id', u.id) : Promise.resolve({ error: null }))));
      res.forEach((r: any, i: number) => { if (!r.error) updatedLog.push({ id: part[i].id, before: part[i].before }); else failure ??= `Σταμάτησε στην ενημέρωση μονάδων: ${r.error.message}`; });
      if (failure) break;
    }
  }

  if (!failure && priceChanges.length) {
    const { error } = await (supabase as any).rpc('set_unit_prices', { p_changes: priceChanges, p_reason: `Εισαγωγή: ${(input.fileName ?? 'αρχείο').slice(0, 120)}`, p_source: 'import' });
    if (error) {
      // Older database without 0065: plain updates.
      for (const c of priceChanges) await (supabase as any).from('units').update({ price: c.price }).eq('id', c.id);
    }
  }

  let batchId: string | null = null;
  let note: string | undefined;
  if (createdIds.length || updatedLog.length || createdBuildings.length) {
    const { data: batch, error } = await (supabase as any).from('unit_import_batches').insert({
      project_id: projectId, file_name: (input.fileName ?? '').slice(0, 200) || null,
      created_units: createdIds, created_buildings: createdBuildings, updated: updatedLog, skipped, created_by: profile.id,
    }).select('id').single();
    if (error) note = 'Η εισαγωγή έγινε, αλλά δεν θα μπορεί να αναιρεθεί (λείπει το migration 0064 στη βάση).';
    else batchId = batch.id;
  }

  await logActivity({ entityType: 'project', entityId: projectId, action: 'units_imported', metadata: { created: createdIds.length, updated: updatedLog.length, skipped, file: input.fileName ?? null, batch: batchId } });
  revalidatePath(`/projects/${projectId}`);
  if (failure) return { ok: false, error: `${failure} Μέχρι εκεί: ${createdIds.length} νέες, ${updatedLog.length} ενημερώσεις${batchId ? ' (μπορείτε να τις αναιρέσετε)' : ''}.` };
  return { ok: true, batchId, created: createdIds.length, updated: updatedLog.length, skipped, buildingsCreated: createdBuildings.length, note };
}

/**
 * Undo an import: delete the units it created (unless they have moved on —
 * reserved, sold, linked to a buyer or contract), put back the old values of
 * the ones it changed, and remove buildings it created that are now empty.
 */
export async function undoImport(batchId: string): Promise<UndoResult> {
  const profile = await requirePermission('projects', 'edit');
  if (!UUID.test(batchId ?? '')) return { ok: false, error: 'Άγνωστη εισαγωγή.' };
  const supabase = await createSupabaseServerClient();
  const { data: b } = await (supabase as any).from('unit_import_batches').select('*').eq('id', batchId).maybeSingle();
  if (!b) return { ok: false, error: 'Η εισαγωγή δεν βρέθηκε.' };
  if (b.undone_at) return { ok: false, error: 'Έχει ήδη αναιρεθεί.' };

  let deleted = 0; let kept = 0; let restored = 0;
  const created: string[] = b.created_units ?? [];
  for (const part of chunk(created, 200)) {
    const { data: rows } = await (supabase as any).from('units').select('id, status, buyer_contact_id').in('id', part);
    const safe = ((rows ?? []) as any[]).filter((u) => u.status === 'available' && !u.buyer_contact_id).map((u) => u.id as string);
    kept += ((rows ?? []) as any[]).length - safe.length;
    if (!safe.length) continue;
    const { error } = await (supabase as any).from('units').delete().in('id', safe);
    if (!error) { deleted += safe.length; continue; }
    // Something links to one of them (reservation, document…): go one by one.
    for (const id of safe) {
      const { error: e1 } = await (supabase as any).from('units').delete().eq('id', id);
      if (e1) kept++; else deleted++;
    }
  }
  for (const u of (b.updated ?? []) as { id: string; before: Record<string, unknown> }[]) {
    const before: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(u.before ?? {})) if (COLS.includes(k)) before[k] = v;
    if (!Object.keys(before).length) continue;
    const { error } = await (supabase as any).from('units').update({ ...before, updated_at: new Date().toISOString() }).eq('id', u.id);
    if (!error) restored++;
  }
  for (const id of (b.created_buildings ?? []) as string[]) {
    const { count } = await supabase.from('units').select('id', { count: 'exact', head: true }).eq('building_id', id);
    if (!count) await supabase.from('buildings').delete().eq('id', id);
  }
  const note = kept ? `${kept} μονάδες κρατήθηκαν γιατί έχουν ήδη κράτηση, αγοραστή ή συνδεδεμένα έγγραφα.` : null;
  await (supabase as any).from('unit_import_batches').update({ undone_at: new Date().toISOString(), undone_by: profile.id, undo_note: note }).eq('id', batchId);
  await logActivity({ entityType: 'project', entityId: b.project_id, action: 'units_import_undone', metadata: { batch: batchId, deleted, restored, kept } });
  revalidatePath(`/projects/${b.project_id}`);
  return { ok: true, deleted, restored, kept };
}

/** The last imports of a project, newest first (for the «Αναίρεση» list). */
export async function listImportBatches(projectId: string): Promise<ImportBatch[]> {
  await requirePermission('projects', 'view');
  if (!UUID.test(projectId ?? '')) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any).from('unit_import_batches')
    .select('id, file_name, created_at, created_units, updated, skipped, undone_at, undo_note')
    .eq('project_id', projectId).order('created_at', { ascending: false }).limit(5);
  if (error) return [];
  return ((data ?? []) as any[]).map((b) => ({
    id: b.id, fileName: b.file_name, createdAt: b.created_at,
    created: (b.created_units ?? []).length, updated: (b.updated ?? []).length, skipped: b.skipped ?? 0,
    undoneAt: b.undone_at, undoNote: b.undo_note,
  }));
}
