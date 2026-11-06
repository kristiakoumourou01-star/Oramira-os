'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BadgePercent } from 'lucide-react';
import { setCommissionStatus } from '@/app/actions/hr';
import { formatDate, formatCurrency } from '@/lib/format';

export interface CommissionRow {
  id: string;
  employee: string | null;
  base_value: number | null;
  commission_pct: number | null;
  amount: number | null;
  status: string;
  created_at: string;
}


export function CommissionsAdmin({ commissions }: { commissions: CommissionRow[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const total = commissions.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const paid = commissions.filter((c) => c.status === 'paid').reduce((s, c) => s + Number(c.amount ?? 0), 0);

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2"><BadgePercent size={15} className="text-olive" strokeWidth={1.75} /> Sales commissions</h4>
        <span className="text-sm text-charcoal-600/70">{formatCurrency(paid)} paid · {formatCurrency(total - paid)} pending</span>
      </div>
      {commissions.length === 0 ? (
        <p className="text-sm text-charcoal-600/70">No commissions accrued yet. They are created automatically when an agent&apos;s lead converts to a reservation.</p>
      ) : (
        <ul className="divide-y divide-stone-line">
          {commissions.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <p className="font-medium text-charcoal">{c.employee ?? 'Agent'}</p>
                <p className="text-xs text-charcoal-600/60">{formatCurrency(c.base_value)} · {Number(c.commission_pct ?? 0)}% · {formatDate(c.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="figure text-charcoal">{formatCurrency(c.amount)}</span>
                <span className={c.status === 'paid' ? 'badge-forest' : 'badge-champagne'}>{c.status}</span>
                <button
                  onClick={() => startTransition(async () => { await setCommissionStatus(c.id, c.status === 'paid' ? 'pending' : 'paid'); router.refresh(); })}
                  disabled={isPending}
                  className="btn-ghost text-xs"
                >
                  {c.status === 'paid' ? 'Mark pending' : 'Mark paid'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
