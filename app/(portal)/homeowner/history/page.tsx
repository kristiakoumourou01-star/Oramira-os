import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHomeownerUnit } from '@/lib/homeowner';
import Link from 'next/link';
import { History, FileText } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PaymentProgress } from '@/components/buyer/PaymentProgress';
import { BuyerMilestoneTimeline } from '@/components/buyer/BuyerMilestoneTimeline';
import { HandoverChecklistView, type ChecklistItem } from '@/components/buyer/HandoverChecklistView';
import { TicketStatusBadge } from '@/components/homeowner/TicketStatusBadge';
import { formatDate, formatNumber, formatCurrency } from '@/lib/format';

export default async function PropertyHistoryPage() {
  const profile = await requireRole(['homeowner', 'admin', 'sales', 'management']);
  const unit = await getHomeownerUnit(profile.contactId);

  if (!unit) {
    return (
      <EmptyState
        icon={History}
        title="Property History"
        description="The full story of your home — contract, payments, construction, and handover — will live here."
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: payments }, { data: milestones }, { data: checklist }, { data: tickets }] = await Promise.all([
    unit.contract
      ? supabase.from('payments').select('id, amount_paid, paid_at, method').eq('contract_id', unit.contract.id).order('paid_at', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; amount_paid: number; paid_at: string; method: string | null }[] }),
    supabase.from('project_milestones').select('id, milestone_type, status, planned_end, actual_end').eq('project_id', unit.project_id),
    supabase.from('handover_checklist_items').select('id, label, description, is_complete, completed_at, sequence').eq('unit_id', unit.id).order('sequence'),
    supabase.from('maintenance_tickets').select('id, title, category, status, created_at').eq('unit_id', unit.id).order('created_at', { ascending: false }),
  ]);

  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount_paid), 0);
  const total = unit.contract?.total_price ?? unit.price ?? null;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">{unit.project_name} · Unit {unit.unit_number}</p>
        <h1 className="font-display text-3xl">Property History</h1>
        <p className="mt-2 max-w-2xl text-sm text-charcoal-600/70">
          Your complete record with Oramira — from the day you reserved through to today. Everything from your buyer
          journey stays here, always.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="panel p-6">
          <h4 className="mb-4">Original contract</h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-charcoal-600/70">Status</span><span className={unit.contract?.status === 'signed' ? 'badge-forest' : 'badge-neutral'}>{unit.contract?.status ?? 'Not recorded'}</span></div>
            <div className="flex justify-between"><span className="text-charcoal-600/70">Contract value</span><span className="figure text-charcoal">{total != null ? `${formatCurrency(Number(total))}` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-charcoal-600/70">Purchase price</span><span className="figure text-charcoal">{unit.price != null ? `${formatCurrency(Number(unit.price))}` : '—'}</span></div>
          </div>
          <Link href="/homeowner/documents" className="btn-ghost mt-4 text-xs"><FileText size={13} strokeWidth={1.75} /> View documents</Link>
        </div>

        <div className="panel p-6">
          <h4 className="mb-4">Payments</h4>
          <PaymentProgress paid={paid} total={total} />
          {(payments ?? []).length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-stone-line pt-3 text-sm">
              {(payments ?? []).slice(0, 5).map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span className="text-charcoal-600/70">{formatDate(p.paid_at)} · {p.method ?? 'payment'}</span>
                  <span className="figure text-charcoal">€{formatNumber(Number(p.amount_paid))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="panel col-span-1 p-6">
          <h4 className="mb-5">Construction record</h4>
          <BuyerMilestoneTimeline milestones={milestones ?? []} />
        </div>

        <div className="col-span-2 space-y-6">
          <div className="panel p-6">
            <h4 className="mb-4">Handover checklist</h4>
            <HandoverChecklistView items={(checklist ?? []) as ChecklistItem[]} />
          </div>

          <div className="panel p-6">
            <h4 className="mb-4">Maintenance & defect history</h4>
            {(tickets ?? []).length === 0 ? (
              <p className="text-sm text-charcoal-600/70">No maintenance or defects recorded for your home.</p>
            ) : (
              <ul className="divide-y divide-stone-line">
                {(tickets ?? []).map((t) => (
                  <li key={t.id}>
                    <Link href={`/homeowner/maintenance/${t.id}`} className="flex items-center justify-between py-2.5 transition-colors hover:bg-stone/60">
                      <div>
                        <p className="text-sm text-charcoal">{t.title}</p>
                        <p className="text-xs capitalize text-charcoal-600/60">{t.category ?? 'general'} · {formatDate(t.created_at)}</p>
                      </div>
                      <TicketStatusBadge status={t.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
