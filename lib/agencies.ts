import 'server-only';

export interface AgencyRow { id: string; name: string; contact_name: string | null; email: string | null; phone: string | null; default_commission_pct: number | null }
export interface ListingRow { id: string; agency_id: string; project_id: string | null; unit_id: string | null; commission_pct: number | null; exclusive: boolean; start_date: string | null; end_date: string | null; notes: string | null }
export interface UnitAgency { id: string; name: string; pct: number | null; exclusive: boolean }

/** Όλα τα agencies + οι αναθέσεις ενός έργου. */
export async function loadProjectAgencies(supabase: any, projectId: string): Promise<{ agencies: AgencyRow[]; listings: ListingRow[] }> {
  try {
    const [{ data: a }, { data: l }] = await Promise.all([
      supabase.from('agencies').select('id, name, contact_name, email, phone, default_commission_pct').eq('active', true).order('name'),
      supabase.from('agency_listings').select('id, agency_id, project_id, unit_id, commission_pct, exclusive, start_date, end_date, notes').eq('project_id', projectId).order('created_at'),
    ]);
    return { agencies: (a ?? []) as AgencyRow[], listings: (l ?? []) as ListingRow[] };
  } catch { return { agencies: [], listings: [] }; }
}

/** Τα ενεργά agencies που πουλάνε μια μονάδα (όλο το έργο ή η συγκεκριμένη μονάδα). */
export async function agenciesForUnit(supabase: any, projectId: string, unitId: string): Promise<UnitAgency[]> {
  const { agencies, listings } = await loadProjectAgencies(supabase, projectId);
  const today = new Date().toISOString().slice(0, 10);
  const out = new Map<string, UnitAgency>();
  for (const l of listings) {
    if (l.end_date && l.end_date < today) continue;
    if (l.start_date && l.start_date > today) continue;
    if (l.unit_id && l.unit_id !== unitId) continue;
    const a = agencies.find((x) => x.id === l.agency_id); if (!a) continue;
    const prev = out.get(a.id);
    const pct = l.commission_pct != null ? Number(l.commission_pct) : a.default_commission_pct != null ? Number(a.default_commission_pct) : null;
    // Η ανάθεση στη συγκεκριμένη μονάδα υπερισχύει της γενικής.
    if (!prev || l.unit_id) out.set(a.id, { id: a.id, name: a.name, pct, exclusive: l.exclusive || !!prev?.exclusive });
  }
  return [...out.values()].sort((x, y) => Number(y.exclusive) - Number(x.exclusive));
}
