import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getBuyerUnit } from '@/lib/buyer';
import { Wallet, CheckCircle2, Clock } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PaymentProgress } from '@/components/buyer/PaymentProgress';
import { DocumentList } from '@/components/ui/DocumentList';
import { getDocumentUrl } from '@/app/actions/storage';

export default async function PaymentCenterPage() {
  const profile = await requireRole(['buyer', 'admin', 'sales', 'management']);
  const unit = await getBuyerUnit(profile.contactId);

  if (!unit || !unit.contract) {
    return (
      <EmptyState
        icon={Wallet}
        title="No payment plan yet"
        description="Your payment schedule, balance, and history will appear here once your contract is in place."
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: schedules }, { data: payments }, { data: receipts }] = await Promise.all([
    supabase.from('payment_schedules').select('id, installment_number, description, due_date, amount').eq('contract_id', unit.contract.id).order('installment_number'),
    supabase.from('payments').select('id, amount_paid, paid_at, method, reference').eq('contract_id', unit.contract.id).order('paid_at', { ascending: false }),
    supabase.from('documents').select('id, title, category, storage_path, bucket, created_at').eq('entity_type', 'contract').eq('entity_id', unit.contract.id).in('category', ['invoice', 'receipt']),
  ]);

  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount_paid), 0);
  const total = unit.contract.total_price ?? unit.price ?? null;
  const scheduledTotal = (schedules ?? []).reduce((s, r) => s + Number(r.amount), 0);

  // Mark each installment paid once cumulative payments cover it (best-effort
  // until per-installment reconciliation lands in the Payments module).
  let runningPaid = paid;
  const scheduleRows = (schedules ?? []).map((s) => {
    const covered = runningPaid >= Number(s.amount);
    if (covered) runningPaid -= Number(s.amount);
    return { ...s, covered };
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">{unit.project_name} · Unit {unit.unit_number}</p>
        <h1 className="font-display text-3xl">Payment Center</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="panel col-span-1 p-6">
          <p className="eyebrow mb-3">Paid to date</p>
          <PaymentProgress paid={paid} total={total} />
        </div>
        <div className="panel p-6">
          <p className="eyebrow mb-2">Remaining balance</p>
          <p className="figure text-3xl text-forest">{total != null ? `€${Math.max(0, total - paid).toLocaleString()}` : '—'}</p>
          <p className="mt-1 text-xs text-charcoal-600/60">across {(schedules ?? []).length} installments</p>
        </div>
        <div className="panel p-6">
          <p className="eyebrow mb-2">Contract value</p>
          <p className="figure text-3xl text-forest">{total != null ? `€${Number(total).toLocaleString()}` : '—'}</p>
          {scheduledTotal > 0 && total != null && scheduledTotal !== total && (
            <p className="mt-1 text-xs text-signal-warning">Scheduled €{scheduledTotal.toLocaleString()}</p>
          )}
        </div>
      </div>

      <div className="panel p-6">
        <h4 className="mb-4">Payment schedule</h4>
        {scheduleRows.length === 0 ? (
          <p className="text-sm text-charcoal-600/70">Your installment schedule will be published here.</p>
        ) : (
          <table className="table-base w-full">
            <thead>
              <tr><th>#</th><th>Description</th><th>Due date</th><th>Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {scheduleRows.map((s) => (
                <tr key={s.id}>
                  <td className="figure">{s.installment_number}</td>
                  <td>{s.description ?? '—'}</td>
                  <td className="figure text-charcoal-600">{s.due_date ? new Date(s.due_date).toLocaleDateString() : '—'}</td>
                  <td className="figure">€{Number(s.amount).toLocaleString()}</td>
                  <td>
                    {s.covered ? (
                      <span className="badge-forest"><CheckCircle2 size={11} strokeWidth={2} className="mr-1" /> Paid</span>
                    ) : (
                      <span className="badge-champagne"><Clock size={11} strokeWidth={2} className="mr-1" /> Due</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="panel p-6">
          <h4 className="mb-4">Payment history</h4>
          {(payments ?? []).length === 0 ? (
            <p className="text-sm text-charcoal-600/70">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-stone-line">
              {(payments ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-charcoal">€{Number(p.amount_paid).toLocaleString()}</p>
                    <p className="text-xs text-charcoal-600/60">
                      {new Date(p.paid_at).toLocaleDateString()} · {p.method ?? 'payment'}{p.reference ? ` · ${p.reference}` : ''}
                    </p>
                  </div>
                  <CheckCircle2 size={16} className="text-signal-success" strokeWidth={1.75} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-6">
          <h4 className="mb-4">Receipts & invoices</h4>
          <DocumentList documents={receipts ?? []} getSignedUrl={getDocumentUrl.bind(null, 'contracts')} />
        </div>
      </div>
    </div>
  );
}
