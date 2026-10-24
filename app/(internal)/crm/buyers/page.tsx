import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function BuyersPage() {
  await requirePermission('leads');
  const supabase = await createSupabaseServerClient();

  const { data: buyers } = await supabase
    .from('buyers')
    .select('id, contact_id, portal_eligible, portal_activated, contacts(full_name, email)')
    .order('id', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">CRM</p>
        <h1 className="text-3xl">Buyers</h1>
      </div>

      <div className="panel overflow-hidden">
        <table className="table-base w-full">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Portal status</th>
            </tr>
          </thead>
          <tbody>
            {(buyers ?? []).map((b: any) => (
              <tr key={b.id} className="hover:bg-stone/60">
                <td>
                  <Link href={`/crm/${b.contact_id}`} className="font-medium text-forest hover:underline">
                    {b.contacts?.full_name ?? 'Unnamed'}
                  </Link>
                  <p className="text-xs text-charcoal-600/70">{b.contacts?.email}</p>
                </td>
                <td>
                  <span className={b.portal_activated ? 'badge-forest' : b.portal_eligible ? 'badge-champagne' : 'badge-neutral'}>
                    {b.portal_activated ? 'Active' : b.portal_eligible ? 'Eligible' : 'Not yet eligible'}
                  </span>
                </td>
              </tr>
            ))}
            {(!buyers || buyers.length === 0) && (
              <tr><td colSpan={2} className="py-12 text-center text-charcoal-600/70">No buyers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
