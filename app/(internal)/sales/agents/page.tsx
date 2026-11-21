import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { getAgentStats, getSourceCosts } from '@/lib/sales-hub-data';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { SalesNav } from '@/components/sales/SalesNav';
import { AgentsStats } from '@/components/sales/AgentsStats';

export const dynamic = 'force-dynamic';
const PERIODS: [string, string, number][] = [['30', '30 μέρες', 30], ['90', '3 μήνες', 90], ['180', '6 μήνες', 180], ['365', '12 μήνες', 365]];
const SOURCES = ['website', 'meta', 'google', 'organic', 'referral', 'whatsapp', 'walk_in', 'other'];

/** Διαχείριση leads → Agents: στατιστικά ανά συνεργάτη από leads, σημειώσεις και κινήσεις. */
export default async function AgentsPage({ searchParams }: { searchParams: { period?: string } }) {
  const profile = await requirePermission('leads');
  const period = PERIODS.find((p) => p[0] === searchParams.period) ?? PERIODS[1];
  const canEditCosts = profile.role === 'admin' || profile.role === 'management';
  const [stats, costs] = await Promise.all([getAgentStats(period[2]), canEditCosts ? getSourceCosts() : Promise.resolve([])]);
  return (
    <div className="space-y-4">
      <WorkspaceHeader eyebrow="Sales" title="Διαχείριση leads" description="Όλα τα leads και deals: pipeline, λίστα, πρόβλεψη, activities και στατιστικά." />
      <SalesNav active="agents" />
      <div className="flex rounded-lg bg-stone-100 p-0.5 text-sm w-fit">
        {PERIODS.map(([k, l]) => <Link key={k} href={`/sales/agents?period=${k}`} scroll={false} className={`inline-flex h-7 items-center rounded-md px-2.5 text-[13px] transition-colors ${k === period[0] ? 'bg-forest font-medium text-white shadow-sm' : 'text-charcoal-600 hover:text-charcoal'}`}>{l}</Link>)}
      </div>
      <AgentsStats rows={stats.rows} unassigned={stats.unassigned} hasCosts={stats.hasCosts} costs={costs} sources={SOURCES} canEditCosts={canEditCosts} />
    </div>
  );
}
