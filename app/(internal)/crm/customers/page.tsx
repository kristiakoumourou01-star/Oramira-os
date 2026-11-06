import { requirePermission } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { loadContactList } from '@/lib/contacts-hub';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { ContactsHub } from '@/components/crm/ContactsHub';
import { ALL_ROLES, type ContactRole } from '@/lib/contacts-hub-shared';

export const dynamic = 'force-dynamic';

/**
 * Πελάτες → Όλες οι επαφές: leads, αγοραστές, επενδυτές, ιδιοκτήτες,
 * συνεργάτες — με κατάσταση, υπεύθυνο, φίλτρα, μαζικές αλλαγές και εξαγωγή.
 */
export default async function ContactsPage({ searchParams }: { searchParams: { role?: string } }) {
  const profile = await requirePermission('leads');
  const { rows, staff, missing } = await loadContactList();
  const role = (ALL_ROLES as string[]).includes(searchParams.role ?? '') ? (searchParams.role as ContactRole) : '';
  const can = (a: 'edit') => effectiveCan(profile.role, profile.moduleAccess, 'leads', a, profile.permissions);
  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Πελάτες" title="Επαφές" description="Όλοι οι άνθρωποι σε μία λίστα. Προσθέστε, μετατρέψτε (π.χ. lead → αγοραστής), αναθέστε και φιλτράρετε." />
      {missing && <p className="panel p-4 text-sm text-signal-danger">Λείπει το migration 0071 στη βάση.</p>}
      <ContactsHub key={role} rows={rows} staff={staff} initialRole={role} canCreate={can('edit')} canEdit={can('edit')} />
    </div>
  );
}
