import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import { ProjectStatusControl } from '@/components/projects/ProjectStatusControl';
import { EditProjectForm } from '@/components/projects/EditProjectForm';
import { StructureManager } from '@/components/projects/StructureManager';
import { ProjectTimeline } from '@/components/projects/ProjectTimeline';
import { ContractorAssignment } from '@/components/projects/ContractorAssignment';
import { ProjectGallery } from '@/components/projects/ProjectGallery';
import { NewUnitForm } from '@/components/units/NewUnitForm';
import { UnitInventoryTable } from '@/components/units/UnitInventoryTable';
import { DocumentList } from '@/components/ui/DocumentList';
import { getDocumentUrl } from '@/app/actions/storage';

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, location, description, status')
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
        .eq('entity_id', project.id),
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

  const galleryItems = (documents ?? [])
    .filter((d) => d.bucket === 'project-media')
    .map((d) => ({ id: d.id, storage_path: d.storage_path, title: d.title }));
  const fileDocs = (documents ?? []).filter((d) => d.bucket !== 'project-media');

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
        <div className="text-right">
          <p className="eyebrow mb-1">Status</p>
          <ProjectStatusControl projectId={project.id} status={project.status} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h4>Inventory <span className="text-charcoal-600/50">· {inventoryUnits.length} units</span></h4>
            <NewUnitForm projectId={project.id} buildings={buildingOpts} phases={phaseOpts} />
          </div>
          <UnitInventoryTable projectId={project.id} units={inventoryUnits} />

          <StructureManager projectId={project.id} buildings={buildingNodes} phases={phases ?? []} />

          <div className="panel p-6">
            <h4 className="mb-4">Gallery</h4>
            <ProjectGallery items={galleryItems} getUrl={getDocumentUrl.bind(null, 'project-media')} />
          </div>

          <div className="panel p-6">
            <h4 className="mb-4">Documents</h4>
            <DocumentList documents={fileDocs} getSignedUrl={getDocumentUrl.bind(null, 'contracts')} />
          </div>
        </div>

        <div className="space-y-6">
          <ProjectTimeline projectId={project.id} milestones={(milestones ?? []) as any} />
          <ContractorAssignment projectId={project.id} assignments={assignmentRows} />
        </div>
      </div>
    </div>
  );
}
