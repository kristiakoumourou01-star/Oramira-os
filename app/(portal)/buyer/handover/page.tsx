import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBuyerUnit } from '@/lib/buyer';
import { KeyRound, ShieldCheck, BookOpen, ScrollText } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { HandoverChecklistView, type ChecklistItem } from '@/components/buyer/HandoverChecklistView';
import { TitleDeedTracker } from '@/components/buyer/TitleDeedTracker';
import { DocumentList } from '@/components/ui/DocumentList';
import { getDocumentUrl } from '@/app/actions/storage';
import { formatDate } from '@/lib/format';

export default async function HandoverCenterPage() {
  const profile = await requireRole(['buyer', 'admin', 'sales', 'management']);
  const unit = await getBuyerUnit(profile.contactId);

  if (!unit) {
    return (
      <EmptyState
        icon={KeyRound}
        title="Handover details coming soon"
        description="Your handover checklist, warranties, and title-deed progress will appear here as completion approaches."
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: checklist }, { data: warranties }, { data: manuals }] = await Promise.all([
    supabase
      .from('handover_checklist_items')
      .select('id, label, description, is_complete, completed_at, sequence')
      .eq('unit_id', unit.id)
      .order('sequence'),
    supabase.from('warranties').select('id, category, starts_on, ends_on, notes').eq('unit_id', unit.id).order('ends_on'),
    supabase
      .from('documents')
      .select('id, title, category, storage_path, bucket, created_at')
      .eq('entity_type', 'unit')
      .eq('entity_id', unit.id)
      .eq('category', 'manual'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">{unit.project_name} · Unit {unit.unit_number}</p>
        <h1 className="font-display text-3xl">Handover Center</h1>
      </div>

      <div className="panel p-6">
        <h4 className="mb-5 flex items-center gap-2"><ScrollText size={15} className="text-olive" strokeWidth={1.75} /> Title deed process</h4>
        <TitleDeedTracker status={unit.title_deed_status} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="panel p-6">
          <h4 className="mb-4 flex items-center gap-2"><KeyRound size={15} className="text-olive" strokeWidth={1.75} /> Handover checklist</h4>
          <HandoverChecklistView items={(checklist ?? []) as ChecklistItem[]} />
        </div>

        <div className="space-y-6">
          <div className="panel p-6">
            <h4 className="mb-4 flex items-center gap-2"><ShieldCheck size={15} className="text-olive" strokeWidth={1.75} /> Warranties</h4>
            {(warranties ?? []).length === 0 ? (
              <p className="text-sm text-charcoal-600/70">Your warranty certificates will be listed here at handover.</p>
            ) : (
              <ul className="divide-y divide-stone-line">
                {(warranties ?? []).map((w) => {
                  const active = new Date(w.ends_on) >= new Date();
                  return (
                    <li key={w.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium capitalize text-charcoal">{w.category}</p>
                        <p className="text-xs text-charcoal-600/60">
                          Until <span className="figure">{formatDate(w.ends_on)}</span>
                        </p>
                      </div>
                      <span className={active ? 'badge-forest' : 'badge-neutral'}>{active ? 'Active' : 'Expired'}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="panel p-6">
            <h4 className="mb-4 flex items-center gap-2"><BookOpen size={15} className="text-olive" strokeWidth={1.75} /> Appliance manuals</h4>
            <DocumentList documents={manuals ?? []} getSignedUrl={getDocumentUrl.bind(null, ((manuals?.[0]?.bucket as any) ?? 'project-media'))} />
          </div>
        </div>
      </div>
    </div>
  );
}
