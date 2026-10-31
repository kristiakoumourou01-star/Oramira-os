import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { rankLeadsForProperty, type MatchResult } from '@/lib/matching';
import type { UnitMediaItem } from '@/lib/unit-page-shared';
import { getOrgSettings } from '@/lib/org-settings';
import type { FieldValue } from '@/lib/unit-forms-shared';

export * from '@/lib/unit-page-shared';

/** The unit's photos, videos and floor plans, signed for display (1 hour). Empty until migration 0059. */
export async function loadUnitMedia(unitId: string): Promise<{ items: UnitMediaItem[]; missing: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any)
    .from('unit_media')
    .select('id, kind, caption, bucket, storage_path, url, sort')
    .eq('unit_id', unitId)
    .order('sort')
    .order('created_at');
  if (error) return { items: [], missing: /does not exist|schema cache/i.test(error.message) };
  const svc = createSupabaseServiceRoleClient();
  const items: UnitMediaItem[] = [];
  for (const r of (data ?? []) as any[]) {
    let url: string | null = r.url ?? null;
    if (r.storage_path) {
      const { data: s } = await svc.storage.from(r.bucket).createSignedUrl(r.storage_path, 3600);
      url = s?.signedUrl ?? null;
    }
    items.push({ id: r.id, kind: r.kind, caption: r.caption, url, isPdf: /\.pdf$/i.test(r.storage_path ?? ''), sort: r.sort });
  }
  return { items, missing: false };
}

export interface MatchingLead {
  leadId: string;
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  budgetMin: number | null;
  budgetMax: number | null;
  areas: string[];
  match: MatchResult;
}

/** Open leads whose budget / preferred development fit this unit, best first. */
export async function matchingLeadsForUnit(unit: { id: string; price: number | null; bedrooms: number | null; sqm: number | null; project_id: string; status: string; features?: Record<string, FieldValue> }): Promise<MatchingLead[]> {
  const supabase = await createSupabaseServerClient();
  // Where the unit is (project location text + coordinates, migration 0059) and
  // where each buyer wants to buy (migration 0060) — both optional.
  const { data: proj } = await (supabase as any).from('projects').select('name, location, latitude, longitude').eq('id', unit.project_id).maybeSingle();
  const { data: areaRows } = await (supabase as any).from('leads').select('id, preferred_areas, unit_requirements').not('status', 'in', '("won","lost")').limit(1000);
  const areasByLead = new Map<string, string[]>(((areaRows ?? []) as any[]).map((r) => [r.id, Array.isArray(r.preferred_areas) ? r.preferred_areas : []]));
  const reqByLead = new Map<string, any>(((areaRows ?? []) as any[]).map((r) => [r.id, r.unit_requirements ?? {}]));
  const { unitForms } = await getOrgSettings();
  const { data } = await supabase
    .from('leads')
    .select('id, status, budget_min, budget_max, preferred_project_id, contact_id, contacts(full_name, email, phone)')
    .not('status', 'in', '("won","lost")')
    .order('created_at', { ascending: false })
    .limit(1000);
  const leads = ((data ?? []) as any[]).map((l) => ({
    leadId: l.id as string,
    contactId: l.contact_id as string,
    name: (l.contacts?.full_name || l.contacts?.email || '—') as string,
    email: (l.contacts?.email ?? null) as string | null,
    phone: (l.contacts?.phone ?? null) as string | null,
    status: String(l.status),
    budgetMin: l.budget_min != null ? Number(l.budget_min) : null,
    budgetMax: l.budget_max != null ? Number(l.budget_max) : null,
    areas: areasByLead.get(l.id) ?? [],
    criteria: { budgetMin: l.budget_min != null ? Number(l.budget_min) : null, budgetMax: l.budget_max != null ? Number(l.budget_max) : null, preferredProjectId: l.preferred_project_id, areas: areasByLead.get(l.id) ?? [], requirements: reqByLead.get(l.id) ?? {} },
  }));
  // A reserved/sold unit still shows who WOULD fit (as a back-up list), so score it as available.
  const facts = {
    id: unit.id, price: unit.price, bedrooms: unit.bedrooms, sqm: unit.sqm, projectId: unit.project_id, status: 'available',
    locationText: [proj?.location, proj?.name].filter(Boolean).join(', '),
    lat: proj?.latitude != null ? Number(proj.latitude) : null, lng: proj?.longitude != null ? Number(proj.longitude) : null,
    features: unit.features ?? {},
  };
  return rankLeadsForProperty(facts, leads, { min: 45, limit: 30, fields: unitForms.fields }).map(({ criteria: _c, ...rest }) => rest);
}
