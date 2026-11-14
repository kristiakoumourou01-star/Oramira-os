import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Map, Tags } from 'lucide-react';
import { ProjectStatusControl } from '@/components/projects/ProjectStatusControl';
import { EditProjectForm } from '@/components/projects/EditProjectForm';
import { ProjectInfoForm } from '@/components/property/ProjectInfoForm';
import { StructureManager } from '@/components/projects/StructureManager';
import { ProjectTimeline } from '@/components/projects/ProjectTimeline';
import { LocationCard } from '@/components/units/LocationCard';
import { geocodeText } from '@/lib/geocode';
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

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const profile = await requirePermission('projects');
  const supabase = await createSupabaseServerClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, location, description, status, delivery_date, common_areas, maintenance_schedule, management_contact, emergency_contact, latitude, longitude')
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
        .select('id, unit_number, floor, type, sqm, bedrooms, bathrooms, price, status, building_id, buildings(name)')
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
  const buildingOpts = (buildings ?? []).map((b) => ({ id: b.id, name: b.name }));
  const phaseOpts = (phases ?? []).map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-charcoal-600/70 hover:text-forest">
        <ArrowLeft size={14} strokeWidth={1.75} /> Projects
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl">{project.name}</h1>
            <EditProjectForm
              projectId={project.id}
              name={project.name}
              location={project.location}
              description={project.description}
            />
          </div>
          {project.location && (
            <p className="mt-1 flex items-center gap-1 text-sm text-charcoal-600/70">
              <MapPin size={13} strokeWidth={1.75} /> {project.location}
            </p>
          )}
          {project.description && <p className="mt-3 max-w-2xl text-sm text-charcoal-600/80">{project.description}</p>}
        </div>
        <div className="flex flex-col items-end gap-3 text-right">
          <div>
            <p className="eyebrow mb-1">Status</p>
            <ProjectStatusControl projectId={project.id} status={project.status} />
          </div>
          <div className="flex gap-2">
            <Link href={`/projects/${project.id}/prices`} className="btn-secondary text-sm">
              <Tags size={14} strokeWidth={1.75} /> Τιμοκατάλογος
            </Link>
            <Link href={`/projects/${project.id}/map`} className="btn-secondary text-sm">
              <Map size={14} strokeWidth={1.75} /> Interactive Map
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h4>Houses <span className="text-charcoal-600/50">· {inventoryUnits.length}</span></h4>
            <div className="flex items-center gap-2">
              {canImport && <UnitImport projectId={project.id} projectName={project.name} cfg={unitForms} existingNumbers={inventoryUnits.map((u) => u.unit_number)} />}
              <NewUnitForm projectId={project.id} buildings={buildingOpts} phases={phaseOpts} />
            </div>
          </div>
          <AvailabilityBoard projectId={project.id} projectName={project.name} units={boardUnits} />
          <UnitInventoryTable projectId={project.id} units={inventoryUnits} />

          <ConstructionUpdates projectId={project.id} buildings={buildingOpts} units={(units ?? []).map((u) => ({ id: u.id, unit_number: u.unit_number, building_id: u.building_id }))}
            items={updates.items} missing={updates.missing} canEdit={canImport} watermark={watermark} />

          <StructureManager projectId={project.id} buildings={buildingNodes} phases={phases ?? []} />

          <ProjectGalleryPanel projectId={project.id} canEdit={canImport} items={(documents ?? []).filter((d) => d.bucket === 'project-media') as any} />

          <ProjectDocumentsPanel projectId={project.id} canEdit={canImport} items={fileDocs as any} />
        </div>

        <div className="space-y-6">
          <LocationCard projectId={project.id} projectName={project.name} location={project.location ?? null} lat={(project as any).latitude != null ? Number((project as any).latitude) : null} lng={(project as any).longitude != null ? Number((project as any).longitude) : null}
            approx={(project as any).latitude == null ? await geocodeText(project.location) : null} canEdit={canImport} back={`/projects/${project.id}`} />
          <ProjectTimeline projectId={project.id} milestones={(milestones ?? []) as any} />
          <ContractorAssignment projectId={project.id} assignments={assignmentRows} />
          <ProjectInfoForm
            projectId={project.id}
            deliveryDate={project.delivery_date}
            commonAreas={project.common_areas}
            maintenanceSchedule={project.maintenance_schedule}
            managementContact={project.management_contact}
            emergencyContact={project.emergency_contact}
          />
        </div>
      </div>
    </div>
  );
}
