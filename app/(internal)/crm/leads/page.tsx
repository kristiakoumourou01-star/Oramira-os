import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEnrichedLeads } from '@/lib/leads';
import { LeadTable } from '@/components/crm/LeadTable';
import { NeedsActionToday } from '@/components/crm/NeedsActionToday';
import { NewLeadForm } from '@/components/crm/NewLeadForm';

export default async function LeadsPage() {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const leads = await getEnrichedLeads(); // sorted by priority desc
  const { data: projects } = await supabase.from('projects').select('id, name');
  const needsAction = leads.filter((l) => l.needs_action);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">CRM</p>
          <h1 className="text-3xl">Leads</h1>
        </div>
        <NewLeadForm projects={projects ?? []} />
      </div>

      <NeedsActionToday leads={needsAction} />
      <LeadTable leads={leads} />
    </div>
  );
}
