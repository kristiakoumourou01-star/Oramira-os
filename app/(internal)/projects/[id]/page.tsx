import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Map, Tags, Landmark, Calculator, ArrowRight } from 'lucide-react';
import { HubLinks } from '@/components/ui/HubTabs';
import { DeleteProjectButton } from '@/components/projects/DeleteProjectButton';
import { ProjectStatusControl } from '@/components/projects/ProjectStatusControl';
import { EditProjectForm } from '@/components/projects/EditProjectForm';
import { ProjectInfoForm } from '@/components/property/ProjectInfoForm';
import { StructureManager } from '@/components/projects/StructureManager';
import { ProjectTimeline } from '@/components/projects/ProjectTimeline';
import { LocationCard } from '@/components/units/LocationCard';
import { geocodeText } from '@/lib/geocode';
import { loadProjectAgencies } from '@/lib/agencies';
import { ProjectAgencies } from '@/components/projects/ProjectAgencies';
import { ContractorAssignment } from '@/components/projects/ContractorAssignment';
import { ProjectGalleryPanel, ProjectDocumentsPanel } from '@/components/projects/ProjectFiles';
import { NewUnitForm } from '@/components/units/NewUnitForm';
import { UnitImport } from '@/components/units/UnitImport';
import { AvailabilityBoard } from '@/components/units/AvailabilityBoard';
import { ConstructionUpdates } from '@/components/construction/ConstructionUpdates';
import { loadUpdates } from '@/lib/construction';
import { getBranding } from '@/lib/branding';
import { watermarkPlan } from '@/lib/watermark-shared';
import type { BoardUnit } from '@/lib/unit-board-shared';
import { getOrgSettings } from '@/lib/org-settings';
import { effectiveCan } from '@/lib/permissions';
import { UnitInventoryTable } from '@/components/units/UnitInventoryTable';
import { UnitsViewSwitch } from '@/components/units/UnitsViewSwitch';

export default async function ProjectDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { edit?: string; tab?: string } }) {
  const profile = await requirePermission('projects');
  const supabase = await createSupabaseServerClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, location, description, status, delivery_date, development_type, common_areas, maintenance_schedule, management_contact, emergency_contact, latitude, longitude')
    .eq('id', params.id)
    .single();
  if (!project) notFound();

  const [{ data: buildings }, { data: phases }, { data: milestones }, { data: assignments }, { data: units }, { data: documents }] =
    await Promise.all([
      supabase.from('buildings').select('id, name, floors').eq('project_id', project.id).order('name'),
      supabase.from('project_phases').select('id, name, building_id, sequence').eq('project_id', project.id),
      supabase
        .from('project_milestones')
        .select('id, milestone_type, status, planned_start, planned_end, notes')
        .eq('project_id', project.id),
      supabase
        .from('contractor_project_assignments')
        .select('id, contractor_id, trade, contractors(company_name)')
        .eq('project_id', project.id),
      supabase
        .from('units')
        .select('id, unit_number, floor, type, sqm, bedrooms, bathrooms, price, status, building_id, phase_id, description, buildings(name), owner:buyer_contact_id(full_name)')
        .eq('project_id', project.id)
        .order('unit_number'),
      supabase
        .from('documents')
        .select('id, title, category, storage_path, bucket, created_at')
        .eq('entity_type', 'project')
        .eq('entity_id', project.id)
        .order('created_at', { ascending: false }),
    ]);

  const unitCountByBuilding = (units ?? []).reduce<Record<string, number>>((acc, u) => {
    if (u.building_id) acc[u.building_id] = (acc[u.building_id] ?? 0) + 1;
    return acc;
  }, {});

  const buildingNodes = (buildings ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    floors: b.floors,
    unitCount: unitCountByBuilding[b.id] ?? 0,
  }));

  const inventoryUnits = (units ?? []).map((u) => ({
    id: u.id,
    unit_number: u.unit_number,
    floor: u.floor,
    type: u.type,
    sqm: u.sqm,
    bedrooms: u.bedrooms,
    bathrooms: u.bathrooms,
    price: u.price,
    status: u.status,
    building_name: (u as any).buildings?.name ?? null,
    building_id: u.building_id ?? null,
    phase_name: (phases ?? []).find((p) => p.id === (u as any).phase_id)?.name ?? null,
    description: (u as any).description ?? null,
    owner_name: (u as any).owner?.full_name ?? null,
  }));

  const assignmentRows = (assignments ?? []).map((a) => ({
    id: a.id,
    contractor_id: a.contractor_id,
    trade: a.trade,
    company_name: (a as any).contractors?.company_name ?? 'Contractor',
  }));

  const fileDocs = (documents ?? []).filter((d) => d.bucket !== 'project-media');

  // Πίνακας διαθεσιμότητας: active reservations' expiry per unit.
  const unitIds = (units ?? []).map((u) => u.id);
  const { data: resv } = unitIds.length
    ? await supabase.from('reservations').select('unit_id, expires_at, status').in('unit_id', unitIds).eq('status', 'active')
    : { data: [] as { unit_id: string; expires_at: string | null; status: string }[] };
  const expiry = new globalThis.Map(((resv ?? []) as any[]).map((r) => [r.unit_id as string, (r.expires_at ?? null) as string | null]));
  const boardUnits: BoardUnit[] = (units ?? []).map((u) => ({
    id: u.id, unit_number: u.unit_number, floor: u.floor, type: u.type, sqm: u.sqm, bedrooms: u.bedrooms, price: u.price,
    status: u.status, building_id: u.building_id, building_name: (u as any).buildings?.name ?? null, reserved_until: expiry.get(u.id) ?? null,
  }));
  const orgSettings = await getOrgSettings();
  const { unitForms } = orgSettings;
  const [updates, branding] = await Promise.all([loadUpdates({ projectId: project.id, limit: 30 }), getBranding()]);
  const wm = watermarkPlan(orgSettings.watermark, branding.companyName, orgSettings.appearance.logoOnLight ?? branding.logoUrl);
  const watermark = { ...wm, logoUrl: wm.mode === 'logo' ? wm.logoUrl : null, logo: null };
  const canImport = effectiveCan(profile.role, profile.moduleAccess, 'projects', 'edit', profile.permissions);
  const ag = await loadProjectAgencies(supabase, project.id);
  const buildingOpts = (buildings ?? []).map((b) => ({ id: b.id, name: b.name }));
  const phaseOpts = (phases ?? []).map((p) => ({ id: p.id, name: p.name }));

  // Προέλευση: οικόπεδο → ανάλυση → έργο.
  const sbAny = supabase as any;
  const { data: src } = await sbAny.from('projects').select('source_parcel_id, source_deal_id').eq('id', project.id).maybeSingle();
  const { data: linkedDeal } = await sbAny.from('deals').select('id, name, inputs').or(`project_id.eq.${project.id}${src?.source_deal_id ? `,id.eq.${src.source_deal_id}` : ''}`).limit(1).maybeSingle();
  const parcelId = (src?.source_parcel_id ?? linkedDeal?.inputs?.sourceParcelId ?? null) as string | null;
  const { data: parcelRow } = parcelId
    ? await sbAny.from('land_parcels').select('id, reference').eq('id', parcelId).maybeSingle()
    : await sbAny.from('land_parcels').select('id, reference').eq('project_id', project.id).limit(1).maybeSingle();

  const stages = orgSettings.projectStages;
  const tab = ['units', 'structure', 'construction', 'files', 'info'].includes(searchParams?.tab ?? '') ? searchParams!.tab! : 'units';
  const here = `/projects/${project.id}`;
  const available = (units ?? []).filter((u) => u.status === 'available').length;
  const unitCountByPhase = (units ?? []).reduce<Record<string, number>>((acc, u: any) => { if (u.phase_id) acc[u.phase_id] = (acc[u.phase_id] ?? 0) + 1; return acc; }, {});
  const media = (documents ?? []).filter((d) => d.bucket === 'project-media');
  const lat = (project as any).latitude != null ? Number((project as any).latitude) : null;
  const lng = (project as any).longitude != null ? Number((project as any).longitude) : null;

  return (
    <div className="space-y-5">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-charcoal-600 hover:text-forest">
        <ArrowLeft size={14} strokeWidth={1.75} /> Έργα & μονάδες
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-1">Έργο</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[26px] leading-tight text-charcoal" data-no-tr>{project.name}</h1>
            {canImport && <EditProjectForm projectId={project.id} name={project.name} location={project.location} description={project.description}
              developmentType={(project as any).development_type ?? null} deliveryDate={project.delivery_date ?? null} autoOpen={searchParams?.edit === '1'} />}
          </div>
          {project.location && <p className="mt-1 flex items-center gap-1 text-sm text-charcoal-600" data-no-tr><MapPin size={13} strokeWidth={1.75} /> {project.location}</p>}
          {(parcelRow || linkedDeal) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
              <span className="text-charcoal-600">Προέλευση</span>
              {parcelRow && <Link href={`/acquisitions/${parcelRow.id}`} className="inline-flex h-7 items-center gap-1 rounded-full border border-stone-line px-2.5 text-charcoal hover:border-forest/40"><Landmark size={13} className="text-forest" /><span>Οικόπεδο</span> <span data-no-tr>{parcelRow.reference}</span></Link>}
              {parcelRow && linkedDeal && <ArrowRight size={13} className="text-charcoal-600/60" />}
              {linkedDeal && <Link href={`/deal-analyzer/${linkedDeal.id}`} className="inline-flex h-7 items-center gap-1 rounded-full border border-stone-line px-2.5 text-charcoal hover:border-forest/40"><Calculator size={13} className="text-forest" /><span>Ανάλυση</span> <span data-no-tr>{linkedDeal.name}</span></Link>}
              <ArrowRight size={13} className="text-charcoal-600/60" />
              <span className="inline-flex h-7 items-center rounded-full bg-forest px-2.5 font-medium text-white">Έργο</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <ProjectStatusControl projectId={project.id} status={project.status} stages={stages} />
          <div className="flex flex-wrap gap-2">
            <Link href={`/projects/${project.id}/prices`} className="btn-secondary text-sm"><Tags size={14} strokeWidth={1.75} /> Τιμοκατάλογος</Link>
            <Link href={`/projects/${project.id}/map`} className="btn-secondary text-sm"><Map size={14} strokeWidth={1.75} /> Διαδραστικός χάρτης</Link>
            {canImport && <DeleteProjectButton projectId={project.id} name={project.name} />}
          </div>
        </div>
      </div>

      <HubLinks cols={4} active={tab} cards={[
        { key: 'units', icon: 'Home', title: 'Μονάδες', value: inventoryUnits.length, sub: `${available} διαθέσιμες`, href: here },
        { key: 'structure', icon: 'Building2', title: 'Κτίρια & φάσεις', value: (buildings ?? []).length + (phases ?? []).length, sub: 'Δομή του έργου', href: `${here}?tab=structure` },
        { key: 'construction', icon: 'Hammer', title: 'Κατασκευή', value: (milestones ?? []).length, sub: 'Στάδια, ενημερώσεις, συνεργεία', href: `${here}?tab=construction` },
        { key: 'files', icon: 'FolderOpen', title: 'Αρχεία', value: fileDocs.length + media.length, sub: 'Φωτογραφίες και έγγραφα', href: `${here}?tab=files` },
      ]} />
      <div className="flex justify-end -mt-2">
        <Link href={`${here}?tab=info`} scroll={false} className={`inline-flex h-8 items-center rounded-[10px] px-3 text-[13px] ${tab === 'info' ? 'bg-forest text-white' : 'border border-stone-line text-charcoal hover:border-forest/30'}`}>Τοποθεσία, agencies & πληροφορίες ιδιοκτητών</Link>
      </div>

      {tab === 'units' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canImport && <UnitImport projectId={project.id} projectName={project.name} cfg={unitForms} existingNumbers={inventoryUnits.map((u) => u.unit_number)} />}
            {canImport && <NewUnitForm projectId={project.id} buildings={buildingOpts} phases={phaseOpts} />}
          </div>
          {inventoryUnits.length === 0 ? (
            <div className="rounded-2xl border border-stone-line bg-white p-8 text-center text-sm text-charcoal-600">Δεν υπάρχουν ακόμη μονάδες. Προσθέστε μία ή εισάγετε από Excel.</div>
          ) : (
            <UnitsViewSwitch
              board={<AvailabilityBoard projectId={project.id} projectName={project.name} units={boardUnits} />}
              table={<UnitInventoryTable projectId={project.id} units={inventoryUnits} buildings={buildingOpts} canEdit={canImport} />} />
          )}
        </div>
      )}

      {tab === 'structure' && (
        <StructureManager projectId={project.id} canEdit={canImport} buildings={buildingNodes} phases={(phases ?? []).map((p: any) => ({ ...p, unitCount: unitCountByPhase[p.id] ?? 0 }))} />
      )}

      {tab === 'construction' && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <ConstructionUpdates projectId={project.id} buildings={buildingOpts} units={(units ?? []).map((u) => ({ id: u.id, unit_number: u.unit_number, building_id: u.building_id }))}
            items={updates.items} missing={updates.missing} canEdit={canImport} watermark={watermark} />
          <div className="space-y-5">
            <ProjectTimeline projectId={project.id} milestones={(milestones ?? []) as any} />
            <ContractorAssignment projectId={project.id} assignments={assignmentRows} />
          </div>
        </div>
      )}

      {tab === 'files' && (
        <div className="space-y-5">
          <ProjectGalleryPanel projectId={project.id} canEdit={canImport} items={media as any} />
          <ProjectDocumentsPanel projectId={project.id} canEdit={canImport} items={fileDocs as any} />
        </div>
      )}

      {tab === 'info' && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <LocationCard projectId={project.id} projectName={project.name} location={project.location ?? null} lat={lat} lng={lng}
            approx={lat == null ? await geocodeText(project.location) : null} canEdit={canImport} back={`${here}?tab=info`} />
          <ProjectInfoForm projectId={project.id} deliveryDate={project.delivery_date} commonAreas={project.common_areas} maintenanceSchedule={project.maintenance_schedule}
            managementContact={project.management_contact} emergencyContact={project.emergency_contact} />
          <ProjectAgencies projectId={project.id} canEdit={canImport} agencies={ag.agencies as any} listings={ag.listings as any} units={((units ?? []) as any[]).map((u) => ({ id: u.id, unit_number: u.unit_number })).sort((x, y) => String(x.unit_number).localeCompare(String(y.unit_number), undefined, { numeric: true }))} />
        </div>
      )}
    </div>
  );
}
