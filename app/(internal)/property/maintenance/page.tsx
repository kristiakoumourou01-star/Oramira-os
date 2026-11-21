import { requirePermission } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { MaintenanceDashboard, type AdminTicket, type ContractorOption } from '@/components/property/MaintenanceDashboard';

export default async function MaintenanceAdminPage() {
  const me = await requirePermission('property');
  const canEdit = effectiveCan(me.role, me.moduleAccess, 'property', 'edit', me.permissions);
  const supabase = (await createSupabaseServerClient()) as any;

  const [{ data: tickets }, { data: contractors }, chargesRes] = await Promise.all([
    supabase
      .from('maintenance_tickets')
      .select('id, title, description, category, status, priority, created_at, contractor_id, unit_id, project_id, units(unit_number, projects(name)), homeowners(contacts(full_name)), contractors(company_name)')
      .order('created_at', { ascending: false }),
    supabase.from('contractors').select('id, company_name').eq('is_active', true).order('company_name'),
    supabase.from('unit_charges').select('id, ticket_id, amount, status, description').not('ticket_id', 'is', null),
  ]);
  const byTicket = new Map<string, AdminTicket['charges']>();
  for (const c of ((chargesRes?.error ? [] : chargesRes?.data) ?? []) as any[]) {
    const arr = byTicket.get(c.ticket_id) ?? [];
    arr!.push({ id: c.id, amount: Number(c.amount), status: c.status, description: c.description });
    byTicket.set(c.ticket_id, arr);
  }

  const rows: AdminTicket[] = ((tickets ?? []) as any[]).map((t) => ({
    id: t.id, title: t.title, description: t.description ?? null, category: t.category, status: t.status, priority: t.priority, created_at: t.created_at,
    unit_id: t.unit_id, project_id: t.project_id,
    unit_number: t.units?.unit_number ?? null, project_name: t.units?.projects?.name ?? null, owner_name: t.homeowners?.contacts?.full_name ?? null,
    contractor_id: t.contractor_id, contractor_name: t.contractors?.company_name ?? null, charges: byTicket.get(t.id) ?? [],
  }));

  return (
    <div className="space-y-5">
      <Link href="/property" className="inline-flex items-center gap-1 text-sm text-charcoal-600 hover:text-forest">
        <ArrowLeft size={14} strokeWidth={1.75} /> Διαχείριση ακινήτων
      </Link>
      <WorkspaceHeader eyebrow="Διαχείριση ακινήτων" title="Αιτήματα ιδιοκτητών" description="Ό,τι ζητούν οι ιδιοκτήτες από την πλατφόρμα τους (υδραυλικά, ηλεκτρολογικά κ.ά.): ανάθεση σε συνεργείο, κατάσταση και χρέωση στον ιδιοκτήτη." />
      <MaintenanceDashboard tickets={rows} contractors={(contractors ?? []) as ContractorOption[]} canEdit={canEdit} />
    </div>
  );
}
