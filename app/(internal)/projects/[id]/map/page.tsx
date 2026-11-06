import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Map as MapIcon } from 'lucide-react';
import { loadDevelopmentMapData } from '@/lib/development-map-data';
import { loadSignedProjectMedia } from '@/lib/project-media';
import { SiteMap } from '@/components/property/SiteMap';
import { DevelopmentMap } from '@/components/property/DevelopmentMap';
import { HousePlacementEditor } from '@/components/property/HousePlacementEditor';
import { ProjectMediaManager, type BuildingOption } from '@/components/property/ProjectMediaManager';

/** Interactive development map + plan library for staff. */
export default async function ProjectMapPage({ params }: { params: { id: string } }) {
  await requirePermission('projects');
  const supabase = await createSupabaseServerClient();

  const { data: project } = await supabase.from('projects').select('id, name, development_type').eq('id', params.id).maybeSingle();
  if (!project) notFound();

  const [mapData, media, { data: buildings }] = await Promise.all([
    loadDevelopmentMapData(project.id),
    loadSignedProjectMedia(project.id),
    supabase.from('buildings').select('id, name').eq('project_id', project.id).order('name'),
  ]);

  const isHouses = project.development_type !== 'apartments';
  const sitePlanUrl = (media.find((m) => m.kind === 'masterplan') ?? media.find((m) => m.kind === 'block_layout' || m.kind === 'render'))?.url ?? null;
  const placeable = mapData.houses.map((h) => ({ id: h.id, unit_number: h.unit_number, map_x: h.map_x, map_y: h.map_y }));

  return (
    <div className="space-y-6">
      <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1 text-sm text-charcoal-600/70 hover:text-forest">
        <ArrowLeft size={14} strokeWidth={1.75} /> {project.name}
      </Link>
      <div>
        <p className="eyebrow mb-1 flex items-center gap-1"><MapIcon size={12} strokeWidth={1.75} /> Property Management</p>
        <h1 className="text-3xl">Interactive Map</h1>
      </div>

      <div className="panel p-6">
        {mapData.houses.length === 0 ? (
          <p className="text-sm text-charcoal-600/70">No {isHouses ? 'houses' : 'units'} yet — add them to build the map.</p>
        ) : isHouses ? (
          <SiteMap houses={mapData.houses} media={media} unitDetails={mapData.unitDetails} unitBasePath={`/projects/${project.id}/units`} />
        ) : (
          <DevelopmentMap blocks={mapData.blocks} media={media} unitDetails={mapData.unitDetails} unitBasePath={`/projects/${project.id}/units`} />
        )}
      </div>

      {isHouses && mapData.houses.length > 0 && (
        <div className="panel p-6">
          <h4 className="mb-4">Position houses on the site plan</h4>
          <HousePlacementEditor projectId={project.id} sitePlanUrl={sitePlanUrl} houses={placeable} />
        </div>
      )}

      <ProjectMediaManager projectId={project.id} buildings={(buildings ?? []) as BuildingOption[]} media={media} />
    </div>
  );
}
