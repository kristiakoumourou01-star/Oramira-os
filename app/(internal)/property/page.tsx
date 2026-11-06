import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Map as MapIcon, Home, Users, Wrench, FileText, ShieldCheck, History } from 'lucide-react';
import { loadDevelopmentMapData } from '@/lib/development-map-data';
import { loadSignedProjectMedia } from '@/lib/project-media';
import { SiteMap } from '@/components/property/SiteMap';
import { Tabs, type TabDef } from '@/components/ui/Tabs';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { STATUS_STYLES, toDisplayStatus } from '@/lib/development-map';
import { formatDate } from '@/lib/format';

const OPEN = ['open', 'acknowledged', 'in_progress', 'awaiting_parts', 'reopened'];
const Panel = ({ children }: { children: React.ReactNode }) => <div className="panel p-6">{children}</div>;
const Empty = ({ text }: { text: string }) => <p className="text-sm text-charcoal-600/70">{text}</p>;

/**
 * Property Management — the premium hub. One page: the interactive site map is
 * the hero, with Houses / Owners / Maintenance / Documents / Warranties /
 * Ownership History as in-page tabs. A development selector keeps it scalable
 * across multiple developments.
 */
export default async function PropertyManagementPage({ searchParams }: { searchParams: { dev?: string; tab?: string; city?: string } }) {
  await requirePermission('property');
  const supabase = await createSupabaseServerClient();

  const { data: projects } = await supabase.from('projects').select('id, name, location').order('name');
  if (!projects || projects.length === 0) {
    return (
      <div className="space-y-5">
        <WorkspaceHeader eyebrow="Property" title="Developments" />
        <Empty text="No developments yet." />
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

  const [mapData, media, { data: units }, { data: documents }] = await Promise.all([
    loadDevelopmentMapData(selected.id),
    loadSignedProjectMedia(selected.id),
    supabase.from('units').select('id, unit_number, status, occupancy_status, buyer_contact_id, owner:buyer_contact_id(full_name)').eq('project_id', selected.id).order('unit_number'),
    supabase.from('documents').select('id, title, category, created_at').eq('entity_type', 'project').eq('entity_id', selected.id).limit(20),
  ]);

  const unitIds = (units ?? []).map((u) => u.id);
  const [{ data: tickets }, { data: warranties }, { data: ownership }] = await Promise.all([
    unitIds.length ? supabase.from('maintenance_tickets').select('id, title, status, unit_id, created_at').in('unit_id', unitIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [] as any[] }),
    unitIds.length ? supabase.from('warranties').select('id, name, ends_on, unit_id').in('unit_id', unitIds).order('ends_on', { ascending: true }) : Promise.resolve({ data: [] as any[] }),
    unitIds.length ? supabase.from('unit_ownership_history').select('id, transfer_date, created_at, unit_id, next:new_contact_id(full_name), prev:previous_contact_id(full_name)').in('unit_id', unitIds).order('created_at', { ascending: false }).limit(12) : Promise.resolve({ data: [] as any[] }),
  ]);

  const numberById = new Map((units ?? []).map((u) => [u.id, u.unit_number]));
  const owners = (units ?? []).filter((u: any) => u.buyer_contact_id);
  const openTickets = (tickets ?? []).filter((t: any) => OPEN.includes(t.status));
  const houseHref = (id: string) => `/projects/${selected.id}/units/${id}`;

  const tabs: TabDef[] = [
    {
      id: 'houses', label: `Houses (${(units ?? []).length})`, content: (
        <Panel>
          <ul className="divide-y divide-stone-line">
            {(units ?? []).map((u: any) => (
              <li key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                <Link href={houseHref(u.id)} className="flex items-center gap-2 text-charcoal hover:text-forest">
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[toDisplayStatus(u.status)].dot}`} /> House {u.unit_number}
                </Link>
                <span className="text-xs text-charcoal-600/60">{u.owner?.full_name ?? STATUS_STYLES[toDisplayStatus(u.status)].label}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ),
    },
    {
      id: 'owners', label: `Owners (${owners.length})`, content: (
        <Panel>{owners.length === 0 ? <Empty text="No owners assigned yet." /> : (
          <ul className="divide-y divide-stone-line">
            {owners.map((u: any) => (
              <li key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-charcoal">{u.owner?.full_name ?? 'Owner'}</span>
                <Link href={houseHref(u.id)} className="text-xs text-forest hover:underline">House {u.unit_number}</Link>
              </li>
            ))}
          </ul>
        )}</Panel>
      ),
    },
    {
      id: 'maintenance', label: `Maintenance (${openTickets.length})`, content: (
        <Panel>
          <div className="mb-3 flex justify-end"><Link href="/property/maintenance" className="text-xs text-forest hover:underline">Maintenance Center →</Link></div>
          {openTickets.length === 0 ? <Empty text="No open maintenance tickets. 🎉" /> : (
            <ul className="divide-y divide-stone-line">
              {openTickets.map((t: any) => (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-charcoal">{t.title}</span>
                  <span className="text-xs text-charcoal-600/60">House {numberById.get(t.unit_id) ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ),
    },
    {
      id: 'documents', label: 'Documents', content: (
        <Panel>{(documents ?? []).length === 0 ? <Empty text="No development documents." /> : (
          <ul className="divide-y divide-stone-line">
            {(documents ?? []).map((d: any) => (
              <li key={d.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-charcoal">{d.title ?? d.category}</span>
                <span className="text-xs capitalize text-charcoal-600/50">{d.category}</span>
              </li>
            ))}
          </ul>
        )}</Panel>
      ),
    },
    {
      id: 'warranties', label: 'Warranties', content: (
        <Panel>{(warranties ?? []).length === 0 ? <Empty text="No warranties recorded." /> : (
          <ul className="divide-y divide-stone-line">
            {(warranties ?? []).map((w: any) => (
              <li key={w.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-charcoal">{w.name}</span>
                <span className="text-xs text-charcoal-600/60">House {numberById.get(w.unit_id) ?? '—'} · ends {w.ends_on ? formatDate(w.ends_on) : '—'}</span>
              </li>
            ))}
          </ul>
        )}</Panel>
      ),
    },
    {
      id: 'history', label: 'Ownership History', content: (
        <Panel>{(ownership ?? []).length === 0 ? <Empty text="No ownership transfers recorded." /> : (
          <ul className="divide-y divide-stone-line">
            {(ownership ?? []).map((o: any) => (
              <li key={o.id} className="py-2.5 text-sm">
                <p className="text-charcoal">{o.prev?.full_name ? `${o.prev.full_name} → ` : ''}{o.next?.full_name ?? 'Unassigned'} <span className="text-xs text-charcoal-600/50">· House {numberById.get(o.unit_id) ?? '—'}</span></p>
                <p className="text-xs text-charcoal-600/50">{formatDate(o.transfer_date ?? o.created_at)}</p>
              </li>
            ))}
          </ul>
        )}</Panel>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        eyebrow="Property"
        title={selected.name}
        description="Site map, owners, maintenance, documents, warranties, and ownership history."
        action={<Link href={`/projects/${selected.id}/map`} className="btn-secondary text-sm"><MapIcon size={14} strokeWidth={1.75} /> Edit map & plans</Link>}
      />

      {/* City filter */}
      {cities.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-charcoal-600/60">Πόλη:</span>
          <Link href="/property" className={`badge ${!activeCity ? 'badge-forest' : 'badge-neutral'}`}>Όλες</Link>
          {cities.map((c) => (
            <Link key={c} href={`/property?city=${encodeURIComponent(c)}`} className={`badge ${activeCity === c ? 'badge-forest' : 'badge-neutral'}`}>{c}</Link>
          ))}
        </div>
      )}

      {/* Development selector (within the chosen city) */}
      {visibleProjects.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {visibleProjects.map((p) => (
            <Link key={p.id} href={`/property?dev=${p.id}${cityQuery}`} className={`badge ${p.id === selected.id ? 'badge-forest' : 'badge-neutral'}`}>{p.name}</Link>
          ))}
        </div>
      )}

      {/* HERO — interactive site map */}
      <div className="panel p-6">
        <h4 className="mb-4 flex items-center gap-2"><MapIcon size={15} className="text-olive" strokeWidth={1.75} /> Interactive development map</h4>
        {mapData.houses.length === 0 ? (
          <Empty text="No houses yet. Add houses to build the site map." />
        ) : (
          <SiteMap houses={mapData.houses} media={media} unitDetails={mapData.unitDetails} unitBasePath={`/projects/${selected.id}/units`} />
        )}
      </div>

      <Tabs tabs={tabs} initial={searchParams?.tab} />
    </div>
  );
}
