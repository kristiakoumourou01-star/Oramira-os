import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Receipt, Download, ExternalLink } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { openDocument } from '@/app/actions/storage';
import { formatDate, formatNumber } from '@/lib/format';

const STATUS_CLASS: Record<string, string> = {
  submitted: 'badge-champagne',
  approved: 'badge-forest',
  paid: 'badge-forest',
  rejected: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge',
};

export default async function ContractorInvoicesPage() {
  const profile = await requireRole(['contractor', 'admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: invoices } = profile.contractorId
    ? await supabase
        .from('contractor_invoices')
        .select('id, amount, status, submitted_at, ticket_id, documents(storage_path, bucket), maintenance_tickets(title)')
        .eq('contractor_id', profile.contractorId)
        .order('submitted_at', { ascending: false })
    : { data: [] as any[] };

  const all = invoices ?? [];
  const total = all.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Billing</p>
        <h1 className="font-display text-3xl">Invoices</h1>
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          description="Upload an invoice from any job you've worked on. It links to the ticket and is sent to the Oramira team for processing."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="panel p-5"><p className="eyebrow mb-1">Submitted total</p><p className="figure text-3xl text-forest">€{formatNumber(total)}</p></div>
            <div className="panel p-5"><p className="eyebrow mb-1">Awaiting</p><p className="figure text-3xl text-forest">{all.filter((i) => i.status === 'submitted').length}</p></div>
            <div className="panel p-5"><p className="eyebrow mb-1">Approved</p><p className="figure text-3xl text-forest">{all.filter((i) => i.status === 'approved' || i.status === 'paid').length}</p></div>
          </div>

          <div className="panel overflow-hidden">
            <table className="table-base w-full">
              <thead>
                <tr><th>Job</th><th>Submitted</th><th>Amount</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {all.map((inv) => {
                  const doc = (inv as any).documents;
                  return (
                    <tr key={inv.id} className="hover:bg-stone/60">
                      <td>
                        {inv.ticket_id ? (
                          <Link href={`/contractor/jobs/${inv.ticket_id}`} className="text-forest hover:underline">
                            {(inv as any).maintenance_tickets?.title ?? 'View job'} <ExternalLink size={11} className="inline" strokeWidth={1.75} />
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="figure text-charcoal-600">{formatDate(inv.submitted_at)}</td>
                      <td className="figure">€{formatNumber(Number(inv.amount))}</td>
                      <td><span className={STATUS_CLASS[inv.status] ?? 'badge-neutral'}>{inv.status}</span></td>
                      <td className="text-right">
                        {doc?.storage_path && (
                          <form action={openDocument.bind(null, (doc.bucket as any) ?? 'contractor-invoices', doc.storage_path)}>
                            <button className="btn-ghost text-xs"><Download size={13} strokeWidth={1.75} /> Download</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
