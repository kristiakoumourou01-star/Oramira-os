import { requirePermission } from '@/lib/auth';
import { getCustomers } from '@/lib/customers';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { CustomersTable } from '@/components/crm/CustomersTable';

/**
 * Customers workspace — the whole book of business in one place: everyone who
 * is a buyer, investor or homeowner (or holds a contract/reservation), with
 * their committed value and collected total rolled up, filterable by value,
 * type and recency.
 */
export default async function CustomersPage() {
  await requirePermission('leads');
  const { rows } = await getCustomers();

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        eyebrow="CRM"
        title="Customers"
        description="Όλοι οι πελάτες σε μία λίστα — φίλτρο κατά ποσό, τύπο και προσφάτως."
      />
      <CustomersTable rows={rows} />
    </div>
  );
}
