import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission, hasRight } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildBoardReport } from '@/lib/board-report';
import { buildInvestorReport } from '@/lib/investor-report';
import { buildStrategicPlan } from '@/lib/strategic-planning';
import { getKnowledgeOverview } from '@/lib/knowledge-graph';
import { searchMemory } from '@/lib/executive-memory';
import { loadCustomReport } from '@/lib/custom-report';
import { buildReReport, reportPickers, staffList } from '@/lib/re-reports';
import { REPORT_TILES, REPORT_ALIAS, type ReportFilters } from '@/lib/reports-shared';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { ReportView } from '@/components/reports/ReportView';
import { DownloadReportButton } from '@/components/reports/DownloadReportButton';
import { StrategyView } from '@/components/reports/StrategyView';
import { KnowledgePanel } from '@/components/reports/KnowledgePanel';
import { MemoryPanel } from '@/components/reports/MemoryPanel';
import { ReportsHub } from '@/components/reports/ReportsHub';
import { CustomReport } from '@/components/reports/CustomReport';
import { SummaryTiles, ReportChart, ReportFilterBar, ReportBody } from '@/components/reports/ReportParts';
import { boardReportPdfWeekly, boardReportPdfMonthly, investorReportPdf } from '@/app/actions/reports';

export const dynamic = 'force-dynamic';

// Παλιές αναφορές που δεν φαίνονται πια στο πλέγμα, αλλά οι σύνδεσμοί τους δουλεύουν.
const HIDDEN: Record<string, [string, string]> = {
  strategy: ['Strategy', 'Στρατηγικό πλάνο και προτεραιότητες'],
  knowledge: ['Knowledge graph', 'Σχέσεις επαφών, έργων και deals'],
  memory: ['Executive memory', 'Αποφάσεις και σημειώσεις διοίκησης'],
};

type SP = { tab?: string; view?: string; period?: string; from?: string; to?: string; project?: string; agent?: string; channel?: string };

/** Reports όπως στο FitnessCRM: πλέγμα αναφορών· κάθε αναφορά ανοίγει σε δική της καθαρή σελίδα με φίλτρα, γράφημα και πίνακα. */
export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  const profile = await requirePermission('financials');
  const canExport = hasRight(profile, 'export_data');
  const raw = searchParams?.tab ?? '';
  const key = REPORT_ALIAS[raw] ?? raw;
  const tile = REPORT_TILES.find((t) => t.key === key);
  const hidden = HIDDEN[key];

  if (!tile && !hidden) {
    return (
      <div className="space-y-5">
        <WorkspaceHeader title="Αναφορές" description="Πωλήσεις, leads, πωλητές, μονάδες, εισπράξεις, διαχείριση ακινήτων, καμπάνιες και λίστες κλήσεων — με φίλτρα και export." />
        <ReportsHub tiles={REPORT_TILES} />
      </div>
    );
  }

  const title = tile?.title ?? hidden![0];
  const desc = tile?.desc ?? hidden![1];
  const supabase = await createSupabaseServerClient();
  let body: React.ReactNode = null;

  if (key === 'board') {
    const board = await buildBoardReport(supabase, 'monthly');
    body = (
      <div className="space-y-4">
        {canExport && <div className="flex flex-wrap justify-end gap-2"><DownloadReportButton label="Weekly summary PDF" action={boardReportPdfWeekly} /><DownloadReportButton label="Monthly pack PDF" action={boardReportPdfMonthly} /></div>}
        <ReportView report={board} />
      </div>
    );
  } else if (key === 'investor') {
    const investor = await buildInvestorReport(supabase);
    body = (
      <div className="space-y-4">
        {canExport && <div className="flex justify-end"><DownloadReportButton label="Investor report PDF" action={investorReportPdf} /></div>}
        <ReportView report={investor} />
      </div>
    );
  } else if (key === 'strategy') {
    body = <StrategyView plan={await buildStrategicPlan(supabase)} />;
  } else if (key === 'knowledge') {
    const [knowledge, { data: contacts }] = await Promise.all([getKnowledgeOverview(supabase), supabase.from('contacts').select('id, full_name').order('full_name').limit(500)]);
    body = <KnowledgePanel overview={knowledge} contacts={(contacts ?? []).map((c: any) => ({ id: c.id, name: c.full_name ?? 'Contact' }))} />;
  } else if (key === 'memory') {
    body = <MemoryPanel initial={await searchMemory(supabase, { limit: 50 })} />;
  } else if (key === 'custom') {
    const [c, staff] = await Promise.all([loadCustomReport(), staffList()]);
    body = <CustomReport rows={c.rows} fields={c.fields} templates={c.templates} canExport={canExport} staff={staff} me={profile.id} />;
  } else {
    const filters: ReportFilters = {
      period: searchParams.period ?? (key === 'collections' ? 'all' : '365'),
      from: searchParams.from ?? null, to: searchParams.to ?? null,
      project: searchParams.project ?? '', agent: searchParams.agent ?? '', channel: searchParams.channel ?? '',
    };
    const [rep, pick] = await Promise.all([buildReReport(key, filters), reportPickers()]);
    const canEdit = effectiveCan(profile.role, profile.moduleAccess, 'financials', 'edit', profile.permissions);
    body = rep && (
      <div className="space-y-5">
        <ReportFilterBar keys={rep.filters} value={filters} projects={pick.projects} agents={pick.agents} />
        <SummaryTiles items={rep.summary} />
        {rep.chart && <ReportChart chart={rep.chart} />}
        <ReportBody reportKey={key} report={rep} title={title} canExport={canExport} canEdit={canEdit} initialView={searchParams.view} />
        {rep.note && <p className="text-[12px] text-charcoal-600">{rep.note}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/reports" className="mb-2 inline-flex items-center gap-1.5 text-[13px] text-charcoal-600 hover:text-forest"><ArrowLeft size={14} /> Αναφορές</Link>
        <WorkspaceHeader title={title} description={desc} />
      </div>
      {body}
    </div>
  );
}
