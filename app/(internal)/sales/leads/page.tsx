import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEnrichedLeads } from '@/lib/leads';
import { getOrgSettings } from '@/lib/org-settings';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { LeadsInbox } from '@/components/sales/LeadsInbox';

export const dynamic = 'force-dynamic';

/** Sales → Leads Inbox: τα νέα εισερχόμενα πριν γίνουν deals. */
export default async function LeadsInboxPage() {
  await requirePermission('leads');
  const supabase = await createSupabaseServerClient();
  const [leads, { data: agents }, settings] = await Promise.all([
    getEnrichedLeads(),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales', 'management']).eq('is_active', true).order('full_name'),
    getOrgSettings(),
  ]);
  return (
    <div className="space-y-4">
      <WorkspaceHeader eyebrow="Sales" title="Leads Inbox" description="Τα νέα εισερχόμενα (φόρμες, Meta, WhatsApp, κράτηση προβολής) πριν μπουν στο pipeline. Αναθέστε, βάλτε label και «Μετατροπή σε deal»." />
      <LeadsInbox leads={leads.filter((l) => l.in_inbox)} cfg={settings.pipelines} agents={(agents ?? []) as any} />
    </div>
  );
}
