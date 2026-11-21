import { requirePermission } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { PropertyDocuments, type PropertyDoc } from '@/components/property/PropertyDocuments';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Map as MapIcon, Home, Users, Wrench, FileText, ShieldCheck, History, Building2 } from 'lucide-react';
import { loadDevelopmentMapData } from '@/lib/development-map-data';
import { loadSignedProjectMedia } from '@/lib/project-media';
import { SiteMap } from '@/components/property/SiteMap';
import { HubTabs, type HubTabDef } from '@/components/ui/HubTabs';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { STATUS_STYLES, toDisplayStatus } from '@/lib/development-map';
import { formatDate } from '@/lib/format';
import { AnnualFeesPanel } from '@/components/property/AnnualFeesPanel';

const OPEN = ['open', 'acknowledged', 'in_progress', 'awaiting_parts', 'reopened'];
const Panel = ({ children }: { children: React.ReactNode }) => <div className="panel p-6">{children}</div>;
const Empty = ({ text }: { text: string }) => <p className="text-sm text-charcoal-600/70">{text}</p>;

/**
 * Property Management — the premium hub. One page: the interactive site map is
 * the hero, with Houses / Owners / Maintenance / Documents / Warranties /
 * Ownership History as in-page tabs. A development selector keeps it scalable
 * across multiple developments.
 */
async function loadPropertyDocs(supabase: any, projectId: string): Promise<{ data: PropertyDoc[] }> {
  const { data: us } = await supabase.from('units').select('id').eq('project_id', projectId);
  const unitIds = ((us ?? []) as { id: string }[]).map((u) => u.id);
  const svc = createSupabaseServiceRoleClient() as any;
  const cols = 'id, title, category, description, notes, bucket, storage_path, created_at, entity_type, entity_id, uploaded_by';
  const [{ data: a }, { data: b }] = await Promise.all([
    svc.from('documents').select(cols).eq('entity_type', 'project').eq('entity_id', projectId),
    unitIds.length ? svc.from('documents').select(cols).eq('entity_type', 'unit').in('entity_id', unitIds) : Promise.resolve({ data: [] }),
  ]);
  const rows = [...(a ?? []), ...(b ?? [])] as any[];
  const ids = Array.from(new Set(rows.map((r) => r.uploaded_by).filter(Boolean)));
  const { data: ppl } = ids.length ? await svc.from('profiles').select('id, full_name').in('id', ids) : { data: [] };
  const name = new Map(((ppl ?? []) as any[]).map((p) => [p.id, p.full_name]));
  return { data: rows.sort((x, y) => y.created_at.localeCompare(x.created_at)).map((r) => ({
    id: r.id, title: r.title, category: r.category, description: r.description ?? null, notes: r.notes ?? null, bucket: r.bucket, storage_path: r.storage_path,
    created_at: r.created_at, unitId: r.entity_type === 'unit' ? r.entity_id : null, uploader: r.uploaded_by ? name.get(r.uploaded_by) ?? null : null,
  })) };
}

export default async function PropertyManagementPage({ searchParams }: { searchParams: { dev?: string; tab?: string; city?: string } }) {
  const me = await requirePermission('property');
  const canEditProperty = effectiveCan(me.role, me.moduleAccess, 'property', 'edit', me.permissions);
  const supabase = await createSupabaseServerClient();

  const { data: projects } = await supabase.from('projects').select('id, name, location').order('name');
  if (!projects || projects.length === 0) {
    return (
      <div className="space-y-5">
        <WorkspaceHeader eyebrow="Διαχείριση ακινήτων" title="Ακίνητα" />
        <Empty text="Δεν υπάρχουν ακόμη έργα." />
      </div>
    );
  }

  // City filter — developments are grouped by their location (city). Selecting a
  // city narrows the development selector to that city.
  const cities = Array.from(new Set(projects.map((p) => p.location).filter((l): l is string => !!l))).sort();
  const activeCity = searchParams.city && cities.includes(searchParams.city) ? searchParams.city : null;
  const visibleProjects = activeCity ? projects.filter((p) => p.location === activeCity) : projects;
  const cityQuery = activeCity ? `&city=${encodeURIComponent(activeCity)}` : '';

  const selected = visibleProjects.find((p) => p.id === searchParams.dev) ?? visibleProjects[0] ?? projects[0];
  const [{ data: allUnits }, { data: allOpen }] = await Promise.all([
    supabase.from('units').select('project_id'),
    supabase.from('maintenance_tickets').select('project_id, status').in('status', OPEN),
  ]);
  const unitCount = new Map<string, number>(); for (const u of (allUnits ?? []) as any[]) unitCount.set(u.project_id, (unitCount.get(u.project_id) ?? 0) + 1);
  const openCount = new Map<string, number>(); for (const t of (allOpen ?? []) as any[]) if (t.project_id) openCount.set(t.project_id, (openCount.get(t.project_id) ?? 0) + 1);

  const [mapData, media, { data: units }, { data: documents }] = await Promise.all([
    loadDevelopmentMapData(selected.id),
    loadSignedProjectMedia(selected.id),
    supabase.from('units').select('id, unit_number, status, occupancy_status, buyer_contact_id, owner:buyer_contact_id(full_name)').eq('project_id', selected.id).order('unit_number'),
    loadPropertyDocs(supabase, selected.id),
  ]);

  const unitIds = (units ?? []).map((u) => u.id);
  const [{ data: tickets }, { data: warranties }, { data: ownership }] = await Promise.all([
    unitIds.length ? supabase.from('maintenance_tickets').select('id, title, status, unit_id, created_at').in('unit_id', unitIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [] as any[] }),
    unitIds.length ? supabase.from('warranties').select('id, name, ends_on, unit_id').in('unit_id', unitIds).order('ends_on', { ascending: true }) : Promise.resolve({ data: [] as any[] }),
    unitIds.length ? supabase.from('unit_ownership_history').select('id, transfer_date, created_at, unit_id, next:new_contact_id(full_name), prev:previous_contact_id(full_name)').in('unit_id', unitIds).order('created_at', { ascending: false }).limit(12) : Promise.resolve({ data: [] as any[] }),
  ]);

  const sx = supabase as any;
  const feeRes = unitIds.length ? await sx.from('units').select('id, annual_maintenance_fee').in('id', unitIds) : { data: [], error: null };
  const chRes = unitIds.length ? await sx.from('unit_charges').select('id, unit_id, kind, description, amount, status, due_date, created_at, contact:contact_id(full_name)').in('unit_id', unitIds).order('created_at', { ascending: false }) : { data: [], error: null };
  const feesReady = !feeRes.error && !chRes.error;
  const feeById = new Map(((feeRes.data ?? []) as any[]).map((u) => [u.id, u.annual_maintenance_fee != null ? Number(u.annual_maintenance_fee) : null]));
  const pendingCharges = ((chRes.data ?? []) as any[]).filter((c) => c.status === 'pending');
  const numberById = new Map((units ?? []).map((u) => [u.id, u.unit_number]));
  const owners = (units ?? []).filter((u: any) => u.buyer_contact_id);
  const openTickets = (tickets ?? []).filter((t: any) => OPEN.includes(t.status));
  const houseHref = (id: string) => `/projects/${selected.id}/units/${id}`;

  const ST: Record<string, string> = { open: 'Ανοιχτό', acknowledged: 'Παραλήφθηκε', in_progress: 'Σε εξέλιξη', awaiting_parts: 'Αναμονή υλικών', reopened: 'Ξανάνοιξε', resolved: 'Λύθηκε', closed: 'Κλειστό' };
  const OCC: Record<string, string> = { owner_occupied: 'Ιδιοκατοίκηση', rented: 'Ενοικιασμένο', vacant: 'Κενό', holiday_home: 'Εξοχικό' };
  const Table = ({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string | false }) => (
    <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {empty ? <p className="p-6 text-sm text-charcoal-600">{empty}</p> : (
        <div className="overflow-x-auto"><table className="o-table"><thead><tr>{head.map((h, i) => <th key={h + i} className={i === head.length - 1 && h === '' ? 'text-right' : ''}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
      )}
    </div>
  );
  const openLink = (id: string) => <Link href={houseHref(id)} className="inline-flex h-8 items-center rounded-[10px] border border-stone-line px-2.5 text-[12px] text-charcoal hover:border-forest/30">Άνοιγμα</Link>;

  const tabs: HubTabDef[] = [
    {
      id: 'houses', label: 'Σπίτια', icon: 'Home', value: (units ?? []).length, sub: `${owners.length} με ιδιοκτήτη`, content: (
        <Table head={['Μονάδα', 'Κατάσταση', 'Ιδιοκτήτης', 'Χρήση', '']} empty={(units ?? []).length === 0 && 'Δεν υπάρχουν μονάδες σε αυτό το έργο.'}>
          {(units ?? []).map((u: any) => (
            <tr key={u.id}>
              <td className="o-strong" data-no-tr><span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[toDisplayStatus(u.status)].dot}`} /> {u.unit_number}</span></td>
              <td>{STATUS_STYLES[toDisplayStatus(u.status)].label}</td>
              <td data-no-tr>{u.owner?.full_name ?? '—'}</td>
              <td>{u.occupancy_status ? OCC[u.occupancy_status] ?? u.occupancy_status : '—'}</td>
              <td className="text-right">{openLink(u.id)}</td>
            </tr>
          ))}
        </Table>
      ),
    },
    {
      id: 'owners', label: 'Ιδιοκτήτες', icon: 'Users', value: owners.length, sub: 'Αγοραστές με κλειδιά', content: (
        <Table head={['Ιδιοκτήτης', 'Μονάδα', '']} empty={owners.length === 0 && 'Δεν έχουν οριστεί ιδιοκτήτες ακόμη.'}>
          {owners.map((u: any) => (
            <tr key={u.id}><td className="o-strong" data-no-tr>{u.owner?.full_name ?? '—'}</td><td data-no-tr>{u.unit_number}</td><td className="text-right"><Link href={`${houseHref(u.id)}?tab=history`} className="inline-flex h-8 items-center rounded-[10px] border border-stone-line px-2.5 text-[12px] text-charcoal hover:border-forest/30">Ιστορικό</Link></td></tr>
          ))}
        </Table>
      ),
    },
    {
      id: 'maintenance', label: 'Συντήρηση', icon: 'Wrench', value: openTickets.length, sub: 'Ανοιχτά αιτήματα ιδιοκτητών', content: (
        <div className="space-y-3">
          <div className="flex justify-end"><Link href="/property/maintenance" className="inline-flex h-8 items-center rounded-[10px] bg-forest px-3 text-[13px] font-medium text-white hover:bg-forest/90">Όλα τα αιτήματα: ανάθεση & χρέωση →</Link></div>
          <Table head={['Αίτημα', 'Μονάδα', 'Κατάσταση', 'Ημερομηνία']} empty={openTickets.length === 0 && 'Κανένα ανοιχτό αίτημα συντήρησης.'}>
            {openTickets.map((t: any) => (
              <tr key={t.id}><td className="o-strong" data-no-tr><span className="block max-w-[260px] truncate">{t.title}</span></td><td data-no-tr>{numberById.get(t.unit_id) ?? '—'}</td><td>{ST[t.status] ?? t.status}</td><td>{formatDate(t.created_at)}</td></tr>
            ))}
          </Table>
        </div>
      ),
    },
    {
      id: 'fees', label: 'Χρεώσεις & συντήρηση', icon: 'Receipt', value: pendingCharges.length, sub: 'Εκκρεμείς χρεώσεις ιδιοκτητών', content: (
        <AnnualFeesPanel projectId={selected.id} canEdit={canEditProperty} ready={feesReady}
          units={(units ?? []).map((u: any) => ({ id: u.id, unitNumber: u.unit_number, owner: u.owner?.full_name ?? null, fee: feeById.get(u.id) ?? null }))}
          charges={((chRes.data ?? []) as any[]).map((c) => ({ id: c.id, unitId: c.unit_id, unitNumber: numberById.get(c.unit_id) ?? '—', owner: c.contact?.full_name ?? null, kind: c.kind, description: c.description, amount: Number(c.amount), status: c.status, dueDate: c.due_date, createdAt: c.created_at }))} />
      ),
    },
    {
      id: 'documents', label: 'Έγγραφα', icon: 'FolderOpen', value: documents.length, sub: 'Έργου και μονάδων', content: (
        <PropertyDocuments projectId={selected.id} canEdit={canEditProperty} docs={documents}
          units={(units ?? []).map((u: any) => ({ id: u.id, label: u.unit_number ?? 'Μονάδα' }))} />
      ),
    },
    {
      id: 'warranties', label: 'Εγγυήσεις', icon: 'ShieldCheck', value: (warranties ?? []).length, sub: 'Ανά μονάδα, με λήξη', content: (
        <Table head={['Εγγύηση', 'Μονάδα', 'Λήξη']} empty={(warranties ?? []).length === 0 && 'Δεν έχουν καταχωρηθεί εγγυήσεις.'}>
          {(warranties ?? []).map((w: any) => (
            <tr key={w.id}><td className="o-strong" data-no-tr>{w.name}</td><td data-no-tr>{numberById.get(w.unit_id) ?? '—'}</td><td>{w.ends_on ? formatDate(w.ends_on) : '—'}</td></tr>
          ))}
        </Table>
      ),
    },
    {
      id: 'history', label: 'Ιστορικό ιδιοκτησίας', icon: 'History', value: (ownership ?? []).length, sub: 'Μεταβιβάσεις μονάδων', content: (
        <Table head={['Ημερομηνία', 'Μονάδα', 'Από', 'Σε']} empty={(ownership ?? []).length === 0 && 'Δεν έχουν καταγραφεί μεταβιβάσεις.'}>
          {(ownership ?? []).map((o: any) => (
            <tr key={o.id}><td>{formatDate(o.transfer_date ?? o.created_at)}</td><td data-no-tr>{numberById.get(o.unit_id) ?? '—'}</td><td data-no-tr>{o.prev?.full_name ?? '—'}</td><td className="o-strong" data-no-tr>{o.next?.full_name ?? '—'}</td></tr>
          ))}
        </Table>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        eyebrow="Διαχείριση ακινήτων"
        title={selected.name}
        description="Χάρτης έργου, σπίτια, ιδιοκτήτες, συντήρηση, έγγραφα, εγγυήσεις και ιστορικό ιδιοκτησίας."
        action={<Link href={`/projects/${selected.id}/map`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-3 text-[14px] text-charcoal hover:border-forest/30"><MapIcon size={14} strokeWidth={1.75} /> Χάρτης & σχέδια</Link>}
      />

      {/* City filter */}
      {cities.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[13px] text-charcoal-600">Πόλη:</span>
          <Link href="/property" className={`inline-flex h-8 items-center rounded-full border px-3 text-[13px] ${!activeCity ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/30'}`}>Όλες</Link>
          {cities.map((c) => (
            <Link key={c} href={`/property?city=${encodeURIComponent(c)}`} className={`inline-flex h-8 items-center rounded-full border px-3 text-[13px] ${activeCity === c ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/30'}`}>{c}</Link>
          ))}
        </div>
      )}

      {/* Επιλογή έργου: κάρτες, με μονάδες και ανοιχτά αιτήματα ιδιοκτητών */}
      {visibleProjects.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleProjects.map((p) => {
            const on = p.id === selected.id;
            const nUnits = unitCount.get(p.id) ?? 0;
            const nOpen = openCount.get(p.id) ?? 0;
            return (
              <Link key={p.id} href={`/property?dev=${p.id}${cityQuery}`} aria-current={on ? 'page' : undefined}
                className={`group relative flex items-center gap-3 rounded-[14px] border px-4 py-3 shadow-sm transition-colors duration-150 ${on ? 'border-forest bg-forest text-white' : 'border-stone-line bg-white text-charcoal hover:border-forest/40'}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${on ? 'bg-white/15 text-white' : 'bg-forest/[0.09] text-forest'}`}><Building2 size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold" data-no-tr>{p.name}</span>
                  <span className={`block truncate text-[13px] ${on ? 'text-white/85' : 'text-charcoal-600'}`}>{[p.location, `${nUnits} μονάδες`].filter(Boolean).join(' · ')}</span>
                </span>
                {nOpen > 0 && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-rose-50 text-signal-danger`} title="Ανοιχτά αιτήματα ιδιοκτητών">{nOpen}</span>}
              </Link>
            );
          })}
        </div>
      )}

      {/* HERO — interactive site map */}
      <div className="rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-6">
        <p className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-charcoal"><MapIcon size={16} className="text-forest" strokeWidth={1.75} /> Διαδραστικός χάρτης έργου</p>
        {mapData.houses.length === 0 ? (
          <Empty text="Δεν υπάρχουν ακόμη σπίτια. Προσθέστε μονάδες για να στηθεί ο χάρτης." />
        ) : (
          <SiteMap houses={mapData.houses} media={media} unitDetails={mapData.unitDetails} unitBasePath={`/projects/${selected.id}/units`} />
        )}
      </div>

      <HubTabs tabs={tabs} initial={searchParams?.tab} cols={3} />
    </div>
  );
}
