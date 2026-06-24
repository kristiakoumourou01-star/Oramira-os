import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Calculator, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { NewDealButton } from '@/components/deals/NewDealButton';
import { eur, pct } from '@/lib/deal-analyzer';

const STATUS_CLASS: Record<string, string> = {
  draft: 'badge-neutral',
  reviewing: 'badge-champagne',
  approved: 'badge-forest',
  acquired: 'badge-forest',
  rejected: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge',
  on_hold: 'badge-neutral',
};

function riskBand(score: number | null): { label: string; cls: string } {
  if (score == null) return { label: '—', cls: 'badge-neutral' };
  if (score < 30) return { label: 'Low', cls: 'badge-forest' };
  if (score < 50) return { label: 'Moderate', cls: 'badge-champagne' };
  if (score < 70) return { label: 'Elevated', cls: 'border-signal-warning/30 bg-champagne-50 text-signal-warning badge' };
  return { label: 'High', cls: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge' };
}

export default async function DealAnalyzerPage() {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, status, net_profit, roi, profit_margin, estimated_units, risk_score, updated_at')
    .order('updated_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">Acquisitions intelligence</p>
          <h1 className="text-3xl">Deal Analyzer</h1>
        </div>
        <NewDealButton />
      </div>

      {!deals || deals.length === 0 ? (
        <EmptyState
          icon={Calculator}
          title="No deals analysed yet"
          description="Model a land or development opportunity end to end — buildable area, costs, returns, risk, and an AI verdict — before you commit capital."
          action={<NewDealButton />}
        />
      ) : (
        <div className="panel overflow-hidden">
          <table className="table-base w-full">
            <thead>
              <tr><th>Deal</th><th>Status</th><th>Units</th><th>Net profit</th><th>ROI</th><th>Margin</th><th>Risk</th><th></th></tr>
            </thead>
            <tbody>
              {deals.map((d) => {
                const band = riskBand(d.risk_score);
                return (
                  <tr key={d.id} className="hover:bg-stone/60">
                    <td>
                      <Link href={`/deal-analyzer/${d.id}`} className="font-medium text-forest hover:underline">{d.name}</Link>
                    </td>
                    <td><span className={STATUS_CLASS[d.status] ?? 'badge-neutral'}>{d.status?.replace(/_/g, ' ')}</span></td>
                    <td className="figure text-charcoal-600">{d.estimated_units ?? '—'}</td>
                    <td className="figure">{d.net_profit != null ? eur(d.net_profit, { compact: true }) : '—'}</td>
                    <td className="figure">{d.roi != null ? pct(d.roi) : '—'}</td>
                    <td className="figure text-charcoal-600">{d.profit_margin != null ? pct(d.profit_margin) : '—'}</td>
                    <td><span className={band.cls}>{band.label}</span></td>
                    <td className="text-right"><Link href={`/deal-analyzer/${d.id}`}><ChevronRight size={16} className="text-charcoal-600/40" strokeWidth={1.75} /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
