import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Calculator, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { HubLinks } from '@/components/ui/HubTabs';
import { NewDealButton } from '@/components/deals/NewDealButton';
import { DealRowActions } from '@/components/deals/DealRowActions';
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
  if (score == null) return { label: '—', cls: 'text-charcoal-600' };
  const pill = 'rounded-full border px-2 py-0.5 text-[11px] font-medium';
  if (score < 30) return { label: 'Χαμηλό', cls: `${pill} border-forest/30 bg-forest/[0.08] text-forest` };
  if (score < 50) return { label: 'Μέτριο', cls: `${pill} border-stone-line text-charcoal` };
  if (score < 70) return { label: 'Αυξημένο', cls: `${pill} border-signal-warning/40 text-signal-warning` };
  return { label: 'Υψηλό', cls: `${pill} border-signal-danger/40 text-signal-danger` };
}

export default async function DealAnalyzerPage({ searchParams }: { searchParams?: { f?: string } }) {
  await requirePermission('deals');
  const supabase = await createSupabaseServerClient();

  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, status, project_id, net_profit, roi, profit_margin, estimated_units, risk_score, updated_at')
    .order('updated_at', { ascending: false });

  const all = deals ?? [];
  const f = ['open', 'approved', 'project', 'rejected'].includes(searchParams?.f ?? '') ? searchParams!.f! : 'all';
  const list = all;
  const shown = all.filter((d) => f === 'all' || (f === 'open' ? ['draft', 'reviewing', 'on_hold'].includes(d.status) : f === 'approved' ? d.status === 'approved' : f === 'project' ? d.status === 'acquired' : d.status === 'rejected'));
  const reviewing = list.filter((d) => ['reviewing', 'draft', 'on_hold'].includes(d.status)).length;
  const approved = list.filter((d) => d.status === 'approved' || d.status === 'acquired').length;
  const profit = list.filter((d) => d.status !== 'rejected').reduce((s2, d) => s2 + Number(d.net_profit ?? 0), 0);
  const rois = list.filter((d) => d.roi != null && d.status !== 'rejected').map((d) => Number(d.roi));
  const avgRoi = rois.length ? rois.reduce((a, b) => a + b, 0) / rois.length : null;
  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Αγορές γης" title="Deal Analyzer" description="Ανάλυση οικοπέδων και έργων: εμβαδά, κόστη, απόδοση, ρίσκο και πρόταση AI πριν δεσμεύσετε κεφάλαια." action={<NewDealButton />} />
      {list.length > 0 && <HubLinks cols={4} active={f} cards={[
        { key: 'all', icon: 'Calculator', title: 'Όλες οι αναλύσεις', value: list.length, sub: `Καθαρό κέρδος ${eur(profit, { compact: true })}`, href: '/deal-analyzer' },
        { key: 'open', icon: 'Gauge', title: 'Σε εξέλιξη', value: reviewing, sub: avgRoi != null ? `Μέσο ROI ${pct(avgRoi)}` : 'Πρόχειρα και σε αναμονή', href: '/deal-analyzer?f=open' },
        { key: 'approved', icon: 'ShieldCheck', title: 'Εγκρίθηκαν', value: list.filter((d) => d.status === 'approved').length, sub: 'Έτοιμα για μετατροπή σε έργο', href: '/deal-analyzer?f=approved' },
        { key: 'project', icon: 'Building2', title: 'Έγιναν έργα', value: approved - list.filter((d) => d.status === 'approved').length, sub: 'Με σύνδεσμο προς το έργο', href: '/deal-analyzer?f=project' },
      ]} />}

      {!deals || deals.length === 0 ? (
        <EmptyState
          icon={Calculator}
          title="Καμία ανάλυση ακόμη"
          description="Αναλύστε ένα οικόπεδο ή έργο από άκρη σε άκρη πριν δεσμεύσετε κεφάλαια."
          action={<NewDealButton />}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <table className="o-table">
            <thead>
              <tr><th>Ανάλυση</th><th>Κατάσταση</th><th>Μονάδες</th><th>Καθαρό κέρδος</th><th>ROI</th><th>Περιθώριο</th><th>Ρίσκο</th><th className="text-right">Ενέργειες</th></tr>
            </thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-sm text-charcoal-600">Καμία ανάλυση σε αυτή την προβολή.</td></tr>}
              {shown.map((d) => {
                const band = riskBand(d.risk_score);
                return (
                  <tr key={d.id}>
                    <td className="o-strong" data-no-tr><Link href={`/deal-analyzer/${d.id}`} className="block max-w-[220px] truncate hover:text-forest">{d.name}</Link></td>
                    <td><span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${d.status === 'approved' || d.status === 'acquired' ? 'border-forest/30 bg-forest/[0.08] text-forest' : d.status === 'rejected' ? 'border-signal-danger/40 text-signal-danger' : 'border-stone-line text-charcoal'}`}>{({ draft: 'Πρόχειρο', reviewing: 'Σε αναμονή έγκρισης', approved: 'Εγκρίθηκε', rejected: 'Απορρίφθηκε', on_hold: 'Σε αναμονή', acquired: 'Έγινε έργο' } as Record<string, string>)[d.status] ?? d.status?.replace(/_/g, ' ')}</span></td>
                    <td className="tabular-nums">{d.estimated_units ?? '—'}</td>
                    <td className="tabular-nums">{d.net_profit != null ? eur(d.net_profit, { compact: true }) : '—'}</td>
                    <td className="tabular-nums">{d.roi != null ? pct(d.roi) : '—'}</td>
                    <td className="tabular-nums">{d.profit_margin != null ? pct(d.profit_margin) : '—'}</td>
                    <td><span className={band.cls}>{band.label}</span></td>
                    <td className="whitespace-nowrap text-right">{(d as any).project_id && <Link href={`/projects/${(d as any).project_id}`} className="mr-1 align-middle text-[13px] text-forest hover:underline">Έργο</Link>}<DealRowActions id={d.id} name={d.name} /><Link href={`/deal-analyzer/${d.id}`} className="ml-1 inline-block align-middle"><ChevronRight size={16} className="text-charcoal-600/40" strokeWidth={1.75} /></Link></td>
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
