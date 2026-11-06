import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MaintenanceDashboard, type AdminTicket, type ContractorOption } from '@/components/property/MaintenanceDashboard';

export default async function MaintenanceAdminPage() {
  await requirePermission('property');
  const supabase = await createSupabaseServerClient();

  const [{ data: tickets }, { data: contractors }] = await Promise.all([
    supabase
      .from('maintenance_tickets')
      .select('id, title, category, status, priority, created_at, contractor_id, units(unit_number, projects(name)), homeowners(contacts(full_name)), contractors(company_name)')
      .order('created_at', { ascending: false }),
    supabase.from('contractors').select('id, company_name').eq('is_active', true).order('company_name'),
  ]);

  const rows: AdminTicket[] = (tickets ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    category: t.category,
    status: t.status,
    priority: t.priority,
    created_at: t.created_at,
    unit_number: t.units?.unit_number ?? null,
    project_name: t.units?.projects?.name ?? null,
    owner_name: t.homeowners?.contacts?.full_name ?? null,
    contractor_id: t.contractor_id,
    contractor_name: t.contractors?.company_name ?? null,
  }));

  return (
    <div className="space-y-6">
      <Link href="/property" className="inline-flex items-center gap-1 text-sm text-charcoal-600/70 hover:text-forest">
        <ArrowLeft size={14} strokeWidth={1.75} /> Property
      </Link>
      <div>
        <p className="eyebrow mb-1">Property Management</p>
        <h1 className="text-3xl">Maintenance dashboard</h1>
      </div>
      <MaintenanceDashboard tickets={rows} contractors={(contractors ?? []) as ContractorOption[]} />
    </div>
  );
}
