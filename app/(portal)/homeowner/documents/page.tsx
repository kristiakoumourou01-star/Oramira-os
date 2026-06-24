import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHomeownerUnit } from '@/lib/homeowner';
import { FileText, ScrollText } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { DocumentCenter, type CenterDoc } from '@/components/buyer/DocumentCenter';
import { TitleDeedTracker } from '@/components/buyer/TitleDeedTracker';
import { getDocumentUrl } from '@/app/actions/storage';

export default async function HomeDocumentsPage() {
  const profile = await requireRole(['homeowner', 'admin', 'sales', 'management']);
  const unit = await getHomeownerUnit(profile.contactId);

  if (!unit) {
    return (
      <EmptyState
        icon={FileText}
        title="Home Documents"
        description="Manuals, warranties, legal documents, and handover paperwork will be collected here."
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const entityFilters = [`and(entity_type.eq.unit,entity_id.eq.${unit.id})`, `and(entity_type.eq.project,entity_id.eq.${unit.project_id})`];
  if (unit.contract) entityFilters.push(`and(entity_type.eq.contract,entity_id.eq.${unit.contract.id})`);

  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, category, storage_path, bucket, created_at')
    .or(entityFilters.join(','))
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">{unit.project_name} · Unit {unit.unit_number}</p>
        <h1 className="font-display text-3xl">Home Documents</h1>
      </div>

      <div className="panel p-6">
        <h4 className="mb-5 flex items-center gap-2"><ScrollText size={15} className="text-olive" strokeWidth={1.75} /> Title deed progress</h4>
        <TitleDeedTracker status={unit.title_deed_status} />
      </div>

      <DocumentCenter documents={(documents ?? []) as CenterDoc[]} getUrl={getDocumentUrl} />
    </div>
  );
}
