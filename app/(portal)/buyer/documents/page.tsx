import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBuyerUnit } from '@/lib/buyer';
import { FileText } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { DocumentCenter, type CenterDoc } from '@/components/buyer/DocumentCenter';
import { getDocumentUrl } from '@/app/actions/storage';

export default async function BuyerDocumentsPage() {
  const profile = await requireRole(['buyer', 'admin', 'sales', 'management']);
  const unit = await getBuyerUnit(profile.contactId);

  if (!unit) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents yet"
        description="Contracts, receipts, permits, floorplans, and legal documents will be collected here."
      />
    );
  }

  const supabase = await createSupabaseServerClient();

  // The buyer's documents span three entities, each RLS-gated to them:
  // their contract, their unit, and the project (permits/floorplans/media).
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
        <h1 className="font-display text-3xl">Documents</h1>
      </div>
      <DocumentCenter documents={(documents ?? []) as CenterDoc[]} getUrl={getDocumentUrl} />
    </div>
  );
}
