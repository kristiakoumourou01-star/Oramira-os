import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function InvestorsPage() {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: investors } = await supabase
    .from('investors')
    .select('id, contact_id, investor_type, contacts(full_name, email)')
    .order('id', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">CRM</p>
        <h1 className="text-3xl">Investors</h1>
      </div>

      <div className="panel overflow-hidden">
        <table className="table-base w-full">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {(investors ?? []).map((inv: any) => (
              <tr key={inv.id} className="hover:bg-stone/60">
                <td>
                  <Link href={`/crm/${inv.contact_id}`} className="font-medium text-forest hover:underline">
                    {inv.contacts?.full_name ?? 'Unnamed'}
                  </Link>
                  <p className="text-xs text-charcoal-600/70">{inv.contacts?.email}</p>
                </td>
                <td className="text-charcoal-600 capitalize">{inv.investor_type ?? '—'}</td>
              </tr>
            ))}
            {(!investors || investors.length === 0) && (
              <tr><td colSpan={2} className="py-12 text-center text-charcoal-600/70">No investors yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
