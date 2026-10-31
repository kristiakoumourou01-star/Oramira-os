import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgSettings } from '@/lib/org-settings';
import { areasIn } from '@/lib/areas';
import { cleanRequirements, cleanValues } from '@/lib/unit-forms-shared';
import type { MapLead, MapProject, MapUnit } from '@/lib/map-shared';

export * from '@/lib/map-shared';

/**
 * Everything the Map needs, read with the user's own session (RLS applies).
 * Projects without coordinates are placed at their area's centre when the
 * location text names a known area (flagged `approx`), else left off the map.
 */
export async function loadMapData(opts: { withLeads: boolean }) {
  const supabase = await createSupabaseServerClient();
  const { unitForms } = await getOrgSettings();
  const [{ data: projects }, { data: units }, { data: feats }] = await Promise.all([
    (supabase as any).from('projects').select('id, name, location, latitude, longitude').order('name'),
    supabase.from('units').select('id, project_id, unit_number, type, price, bedrooms, sqm, status').in('status', ['available', 'reserved']).order('unit_number').limit(3000),
    (supabase as any).from('units').select('id, custom_fields').in('status', ['available', 'reserved']).limit(3000),
  ]);
  const featById = new Map<string, unknown>(((feats ?? []) as any[]).map((u) => [u.id, u.custom_fields]));

  const placed: MapProject[] = [];
  const unplaced: { id: string; name: string; location: string | null }[] = [];
  for (const p of (projects ?? []) as any[]) {
    if (p.latitude != null && p.longitude != null) placed.push({ id: p.id, name: p.name, location: p.location, lat: Number(p.latitude), lng: Number(p.longitude), approx: false });
    else {
      const a = areasIn(p.location)[0];
      if (a) placed.push({ id: p.id, name: p.name, location: p.location, lat: a.lat, lng: a.lng, approx: true });
      else unplaced.push({ id: p.id, name: p.name, location: p.location });
    }
  }

  const mapUnits: MapUnit[] = ((units ?? []) as any[]).map((u) => ({
    id: u.id, projectId: u.project_id, unitNumber: String(u.unit_number ?? ''), type: u.type ?? null,
    price: u.price != null ? Number(u.price) : null, bedrooms: u.bedrooms ?? null, sqm: u.sqm != null ? Number(u.sqm) : null,
    status: u.status, features: cleanValues(featById.get(u.id), unitForms.fields),
  }));

  let leads: MapLead[] = [];
  if (opts.withLeads) {
    const { data } = await supabase
      .from('leads')
      .select('id, status, budget_min, budget_max, preferred_project_id, contact_id, contacts(full_name, email, phone)')
      .not('status', 'in', '("won","lost")')
      .order('created_at', { ascending: false })
      .limit(1500);
    const { data: extra } = await (supabase as any).from('leads').select('id, preferred_areas, unit_requirements').not('status', 'in', '("won","lost")').limit(1500);
    const ex = new Map<string, any>(((extra ?? []) as any[]).map((r) => [r.id, r]));
    leads = ((data ?? []) as any[]).map((l) => {
      const e = ex.get(l.id) ?? {};
      const areas: string[] = Array.isArray(e.preferred_areas) ? e.preferred_areas : [];
      return {
        leadId: l.id, contactId: l.contact_id, name: l.contacts?.full_name || l.contacts?.email || '—',
        email: l.contacts?.email ?? null, phone: l.contacts?.phone ?? null, areas,
        criteria: {
          budgetMin: l.budget_min != null ? Number(l.budget_min) : null, budgetMax: l.budget_max != null ? Number(l.budget_max) : null,
          preferredProjectId: l.preferred_project_id ?? null, areas, requirements: cleanRequirements(e.unit_requirements, unitForms.fields),
        },
      };
    });
  }

  return { projects: placed, unplaced, units: mapUnits, leads, fields: unitForms.fields };
}
