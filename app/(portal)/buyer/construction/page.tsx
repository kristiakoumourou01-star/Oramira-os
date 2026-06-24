import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBuyerUnit } from '@/lib/buyer';
import { HardHat, CalendarCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { BuyerMilestoneTimeline } from '@/components/buyer/BuyerMilestoneTimeline';
import { ProjectGallery } from '@/components/projects/ProjectGallery';
import { getDocumentUrl } from '@/app/actions/storage';

export default async function ConstructionProgressPage() {
  const profile = await requireRole(['buyer', 'admin', 'sales', 'management']);
  const unit = await getBuyerUnit(profile.contactId);

  if (!unit) {
    return (
      <EmptyState
        icon={HardHat}
        title="Construction updates coming soon"
        description="Once your unit is linked, you'll follow every stage of construction here — live."
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: milestones }, { data: photos }] = await Promise.all([
    supabase
      .from('project_milestones')
      .select('id, milestone_type, status, planned_end, actual_end')
      .eq('project_id', unit.project_id),
    supabase
      .from('documents')
      .select('id, storage_path, title, bucket')
      .eq('entity_type', 'project')
      .eq('entity_id', unit.project_id)
      .eq('bucket', 'project-media')
      .order('created_at', { ascending: false }),
  ]);

  // Estimated handover: the unit's set date, else the planned end of the
  // delivery milestone.
  const deliveryMilestone = (milestones ?? []).find((m) => m.milestone_type === 'delivery');
  const estimatedHandover = unit.handover_date ?? deliveryMilestone?.planned_end ?? null;

  const galleryItems = (photos ?? []).map((p) => ({ id: p.id, storage_path: p.storage_path, title: p.title }));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1">{unit.project_name} · Unit {unit.unit_number}</p>
          <h1 className="font-display text-3xl">Construction Progress</h1>
        </div>
        {estimatedHandover && (
          <div className="flex items-center gap-2 rounded-md bg-forest px-4 py-2.5 text-stone-100">
            <CalendarCheck size={16} className="text-champagne" strokeWidth={1.75} />
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-eyebrow text-stone-100/60">Estimated handover</p>
              <p className="figure text-sm">{new Date(estimatedHandover).toLocaleDateString()}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="panel col-span-1 p-6">
          <h4 className="mb-5">Build stages</h4>
          <BuyerMilestoneTimeline milestones={milestones ?? []} />
        </div>

        <div className="panel col-span-2 p-6">
          <h4 className="mb-4">Site photos</h4>
          <ProjectGallery items={galleryItems} getUrl={getDocumentUrl.bind(null, 'project-media')} />
        </div>
      </div>
    </div>
  );
}
