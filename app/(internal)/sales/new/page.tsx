import { requirePermission } from '@/lib/auth';
import { getNewLeads, getSalesAgents, getAssignedLeads } from '@/lib/sales-hub-data';
import { AssignedLeads } from '@/components/sales/AssignedLeads';
import Link from 'next/link';
import { canAssignOthers, canClaimLeads } from '@/lib/sales-hub-shared';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { NewLeadsInbox } from '@/components/sales/NewLeadsInbox';
import { NewLeadForm } from '@/components/crm/NewLeadForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgSettings } from '@/lib/org-settings';

export const dynamic = 'force-dynamic';

/** Διαχείριση leads → Νέα leads: όλα τα εισερχόμενα χωρίς υπεύθυνο. */
export default async function NewLeadsPage({ searchParams }: { searchParams: { view?: string } }) {
  const profile = await requirePermission('leads');
  const supabase = await createSupabaseServerClient();
  const [leads, agents, { data: projects }, settings] = await Promise.all([
    getNewLeads(), getSalesAgents(), supabase.from('projects').select('id, name'), getOrgSettings(),
  ]);
  const manager = canAssignOthers(profile);
  const view = manager && searchParams.view === 'assigned' ? 'assigned' : 'new';
  const assigned = view === 'assigned' ? await getAssignedLeads(60) : [];
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
      {manager && (
        <div className="inline-flex rounded-xl border border-stone-line bg-white p-1">
          <Link href="/sales/new" scroll={false} className={`rounded-lg px-3.5 py-1.5 text-[13px] ${view === 'new' ? 'bg-forest text-white' : 'text-charcoal hover:bg-forest/[0.06]'}`}><span>Νέα, χωρίς υπεύθυνο</span> <span className="tabular-nums opacity-80">{leads.length}</span></Link>
          <Link href="/sales/new?view=assigned" scroll={false} className={`rounded-lg px-3.5 py-1.5 text-[13px] ${view === 'assigned' ? 'bg-forest text-white' : 'text-charcoal hover:bg-forest/[0.06]'}`}>Ποιος πήρε τι</Link>
        </div>
      )}
      {view === 'assigned'
        ? <AssignedLeads rows={assigned} />
        : <NewLeadsInbox leads={leads} agents={agents} currentUserId={profile.id} canClaim={canClaimLeads(profile)} canAssign={manager} />}
    </div>
  );
}
