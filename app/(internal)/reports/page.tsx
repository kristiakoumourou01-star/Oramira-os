import { requirePermission, hasRight } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildBoardReport } from '@/lib/board-report';
import { buildInvestorReport } from '@/lib/investor-report';
import { buildStrategicPlan } from '@/lib/strategic-planning';
import { getKnowledgeOverview } from '@/lib/knowledge-graph';
import { searchMemory } from '@/lib/executive-memory';
import { Tabs, type TabDef } from '@/components/ui/Tabs';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { ReportView } from '@/components/reports/ReportView';
import { DownloadReportButton } from '@/components/reports/DownloadReportButton';
import { StrategyView } from '@/components/reports/StrategyView';
import { KnowledgePanel } from '@/components/reports/KnowledgePanel';
import { MemoryPanel } from '@/components/reports/MemoryPanel';
import { boardReportPdfWeekly, boardReportPdfMonthly, investorReportPdf } from '@/app/actions/reports';

/** Institutional reporting — board packs, investor reports, strategy, the
 *  knowledge graph, and executive memory. Gated to financials-level access. */
export default async function ReportsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const profile = await requirePermission('financials');
  // Downloads follow the role's "Κάνει export" right (Settings → Ρόλοι).
  const canExport = hasRight(profile, 'export_data');
  const supabase = await createSupabaseServerClient();

  const [board, investor, plan, knowledge, { data: contacts }, memory] = await Promise.all([
    buildBoardReport(supabase, 'monthly'),
    buildInvestorReport(supabase),
    buildStrategicPlan(supabase),
    getKnowledgeOverview(supabase),
    supabase.from('contacts').select('id, full_name').order('full_name').limit(500),
    searchMemory(supabase, { limit: 50 }),
  ]);
  const contactOptions = (contacts ?? []).map((c) => ({ id: c.id, name: c.full_name ?? 'Contact' }));

  const tabs: TabDef[] = [
    {
      id: 'board', label: 'Board pack', content: (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            {canExport && <DownloadReportButton label="Weekly summary PDF" action={boardReportPdfWeekly} />}
            {canExport && <DownloadReportButton label="Monthly pack PDF" action={boardReportPdfMonthly} />}
          </div>
          <ReportView report={board} />
        </div>
      ),
    },
    {
      id: 'investor', label: 'Investor report', content: (
        <div className="space-y-4">
          {canExport && <div className="flex justify-end"><DownloadReportButton label="Investor report PDF" action={investorReportPdf} /></div>}
          <ReportView report={investor} />
        </div>
      ),
    },
    { id: 'strategy', label: 'Strategy', content: <StrategyView plan={plan} /> },
    { id: 'knowledge', label: 'Knowledge graph', content: <KnowledgePanel overview={knowledge} contacts={contactOptions} /> },
    { id: 'memory', label: 'Executive memory', content: <MemoryPanel initial={memory} /> },
  ];

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Management" title="Reports & Intelligence" description="Board and investor reporting, strategic planning, the company knowledge graph, and institutional memory." />
      <Tabs tabs={tabs} initial={searchParams?.tab} />
    </div>
  );
}
