import { requirePermission } from '@/lib/auth';
import { getNewLeads, getSalesAgents } from '@/lib/sales-hub-data';
import { canAssignOthers, canClaimLeads } from '@/lib/sales-hub-shared';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { NewLeadsInbox } from '@/components/sales/NewLeadsInbox';
import { NewLeadForm } from '@/components/crm/NewLeadForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgSettings } from '@/lib/org-settings';

export const dynamic = 'force-dynamic';

/** Διαχείριση leads → Νέα leads: όλα τα εισερχόμενα χωρίς υπεύθυνο. */
export default async function NewLeadsPage() {
  const profile = await requirePermission('leads');
  const supabase = await createSupabaseServerClient();
  const [leads, agents, { data: projects }, settings] = await Promise.all([
    getNewLeads(), getSalesAgents(), supabase.from('projects').select('id, name'), getOrgSettings(),
  ]);
  const cfg = settings.pipelines;
  const ordered = [cfg.pipelines.find((p) => p.key === cfg.defaultKey) ?? cfg.pipelines[0], ...cfg.pipelines.filter((p) => p.key !== cfg.defaultKey)];
  // «Νέο lead» χειροκίνητα — όπως στο Pipeline. Χωρίς υπεύθυνο μένει εδώ, στα Νέα leads.
  const addLead = (
    <NewLeadForm projects={projects ?? []} agents={agents} required={settings.fields.staff}
      pipelines={ordered.map((p) => ({ key: p.key, name: p.name }))}
      deal={{ pipelines: ordered.map((p) => ({ key: p.key, name: p.name, stages: p.stages.filter((x) => x.status !== 'won').map((x) => ({ key: x.key, label: x.label })) })), labels: cfg.dealLabels }} />
  );
  return (
    <div className="space-y-4">
      <WorkspaceHeader eyebrow="Sales" title="Leads" description="Όλα τα εισερχόμενα που δεν έχουν ακόμη υπεύθυνο. Αναλάβετε ένα lead και εμφανίζεται στο pipeline σας." action={addLead} />
      <NewLeadsInbox leads={leads} agents={agents} currentUserId={profile.id} canClaim={canClaimLeads(profile)} canAssign={canAssignOthers(profile)} />
    </div>
  );
}
