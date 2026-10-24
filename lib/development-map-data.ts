import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { buildDevelopmentTree, buildHouseList, floorLabel, toDisplayStatus, type MapBlock, type MapUnit, type UnitDetail } from '@/lib/development-map';

export interface DevelopmentMapData {
  developmentType: string;          // 'houses' | 'apartments'
  blocks: MapBlock[];               // apartment drill-down
  houses: MapUnit[];                // flat villa site map
  unitDetails: Record<string, UnitDetail>;
}

/**
 * Loads everything the interactive development map needs for a project: the flat
 * house list (villa projects) AND the Block → Floor → Unit tree (apartment
 * projects), plus a per-unit detail map (specs + owner + maintenance flag).
 *
 * Staff call this with the session client (RLS gives them everything). The owner
 * portal needs the WHOLE development (units RLS would otherwise expose only the
 * owner's own house), so it passes `serviceRole` after independently verifying
 * the owner belongs to the project — and `redactOwners` so other buyers' names
 * are never exposed in the portal.
 */
export async function loadDevelopmentMapData(
  projectId: string,
  opts: { serviceRole?: boolean; redactOwners?: boolean } = {},
): Promise<DevelopmentMapData> {
  const supabase = opts.serviceRole ? createSupabaseServiceRoleClient() : await createSupabaseServerClient();

  const [{ data: project }, { data: units }] = await Promise.all([
    supabase.from('projects').select('development_type').eq('id', projectId).maybeSingle(),
    supabase
      .from('units')
      .select(`id, unit_number, floor, status, type, bedrooms, sqm, price, building_id,
               internal_sqm, covered_veranda_sqm, uncovered_veranda_sqm, storage_sqm, parking_spaces,
               plot_size_sqm, garden_sqm, has_pool, map_x, map_y, handover_date,
               buildings(name), contacts:buyer_contact_id(full_name)`)
      .eq('project_id', projectId),
  ]);

  const rows = (units ?? []) as any[];

  // Flag houses with open maintenance tickets (red indicator).
  const issueSet = new Set<string>();
  if (rows.length > 0) {
    const { data: tickets } = await supabase
      .from('maintenance_tickets')
      .select('unit_id, status')
      .in('unit_id', rows.map((u) => u.id))
      .not('status', 'in', '("resolved","closed")');
    for (const t of tickets ?? []) if (t.unit_id) issueSet.add(t.unit_id);
  }
  for (const u of rows) u.has_issue = issueSet.has(u.id);

  const blocks = buildDevelopmentTree(rows);
  const houses = buildHouseList(rows);

  const unitDetails: Record<string, UnitDetail> = {};
  for (const u of rows) {
    unitDetails[u.id] = {
      id: u.id,
      unit_number: u.unit_number,
      floor_label: floorLabel(u.floor ?? 0),
      status: toDisplayStatus(u.status),
      type: u.type,
      bedrooms: u.bedrooms,
      internal_sqm: u.internal_sqm ?? u.sqm ?? null,
      covered_veranda_sqm: u.covered_veranda_sqm,
      uncovered_veranda_sqm: u.uncovered_veranda_sqm,
      storage_sqm: u.storage_sqm,
      parking_spaces: u.parking_spaces,
      plot_size_sqm: u.plot_size_sqm,
      garden_sqm: u.garden_sqm,
      has_pool: !!u.has_pool,
      has_issue: issueSet.has(u.id),
      handover_date: u.handover_date,
      owner_name: opts.redactOwners ? null : u.contacts?.full_name ?? null,
    };
  }

  return { developmentType: project?.development_type ?? 'houses', blocks, houses, unitDetails };
}
