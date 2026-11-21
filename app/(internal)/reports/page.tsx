import { requirePermission, hasRight } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildBoardReport } from '@/lib/board-report';
import { buildInvestorReport } from '@/lib/investor-report';
import { buildStrategicPlan } from '@/lib/strategic-planning';
import { getKnowledgeOverview } from '@/lib/knowledge-graph';
import { searchMemory } from '@/lib/executive-memory';
import { loadCustomReport } from '@/lib/custom-report';
import { buildReReport, reportPickers, staffList } from '@/lib/re-reports';
import { REPORT_TILES, REPORT_ALIAS, resolveRange, prevRange, type ReportFilters } from '@/lib/reports-shared';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { ReportView } from '@/components/reports/ReportView';
import { DownloadReportButton } from '@/components/reports/DownloadReportButton';
import { StrategyView } from '@/components/reports/StrategyView';
import { KnowledgePanel } from '@/components/reports/KnowledgePanel';
import { MemoryPanel } from '@/components/reports/MemoryPanel';
import { ReportsHub } from '@/components/reports/ReportsHub';
import { CustomReport } from '@/components/reports/CustomReport';
import { ReportContent } from '@/components/reports/ReportParts';
import { boardReportPdfWeekly, boardReportPdfMonthly, investorReportPdf } from '@/app/actions/reports';

export const dynamic = 'force-dynamic';

// Παλιές αναφορές που δεν φαίνονται στο πλέγμα, αλλά οι σύνδεσμοί τους δουλεύουν.
const HIDDEN: Record<string, [string, string]> = {
  strategy: ['Strategy', 'Στρατηγικό πλάνο και προτεραιότητες'],
  knowledge: ['Knowledge graph', 'Σχέσεις επαφών, έργων και deals'],
  memory: ['Executive memory', 'Αποφάσεις και σημειώσεις διοίκησης'],
};

type ReportsSearch = { r?: string; tab?: string; preset?: string; from?: string; to?: string; compare?: string; project?: string; agent?: string; channel?: string };

/**
 * Reports όπως στο FitnessCRM: οι κάρτες αναφορών μένουν πάνω και η επιλεγμένη
 * αναφορά ανοίγει από κάτω, στην ίδια σελίδα (/reports?r=<κλειδί> ή /reports/<κλειδί>).
 */
export default async function ReportsPage({ searchParams }: { searchParams: ReportsSearch }) {
  const profile = await requirePermission('financials');
  const canExport = hasRight(profile, 'export_data');
  const raw = searchParams?.r ?? searchParams?.tab ?? '';
  const key = REPORT_ALIAS[raw] ?? raw;
  const tile = REPORT_TILES.find((t) => t.key === key);
  const hidden = HIDDEN[key];
  const active = tile || hidden ? key : null;

  let body: React.ReactNode = null;
  if (active) {
    const title = tile?.title ?? hidden![0];
    const desc = tile?.desc ?? hidden![1];
    const supabase = await createSupabaseServerClient();
    let inner: React.ReactNode = null;
    if (key === 'board') {
      inner = (
        <div className="space-y-4">
          {canExport && <div className="flex flex-wrap justify-end gap-2"><DownloadReportButton label="Weekly summary PDF" action={boardReportPdfWeekly} /><DownloadReportButton label="Monthly pack PDF" action={boardReportPdfMonthly} /></div>}
          <ReportView report={await buildBoardReport(supabase, 'monthly')} />
        </div>
      );
    } else if (key === 'investor') {
      inner = (
        <div className="space-y-4">
          {canExport && <div className="flex justify-end"><DownloadReportButton label="Investor report PDF" action={investorReportPdf} /></div>}
          <ReportView report={await buildInvestorReport(supabase)} />
        </div>
      );
    } else if (key === 'strategy') {
      inner = <StrategyView plan={await buildStrategicPlan(supabase)} />;
    } else if (key === 'knowledge') {
      const [knowledge, { data: contacts }] = await Promise.all([getKnowledgeOverview(supabase), supabase.from('contacts').select('id, full_name').order('full_name').limit(500)]);
      inner = <KnowledgePanel overview={knowledge} contacts={(contacts ?? []).map((c: any) => ({ id: c.id, name: c.full_name ?? 'Contact' }))} />;
    } else if (key === 'memory') {
      inner = <MemoryPanel initial={await searchMemory(supabase, { limit: 50 })} />;
    } else if (key === 'custom') {
      const [c, staff] = await Promise.all([loadCustomReport(), staffList()]);
      inner = <CustomReport rows={c.rows} fields={c.fields} templates={c.templates} canExport={canExport} staff={staff} me={profile.id} />;
    } else {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Nicosia' }).format(new Date());
      const { preset, range } = resolveRange(searchParams.preset, searchParams.from, searchParams.to, today);
      const f: ReportFilters = { range, prev: prevRange(range), preset, compare: searchParams.compare !== '0', project: searchParams.project ?? '', agent: searchParams.agent ?? '', channel: searchParams.channel ?? '' };
      const [rep, pick] = await Promise.all([buildReReport(key, f), reportPickers()]);
      inner = rep && <ReportContent r={rep} f={f} title={title} canExport={canExport} projects={pick.projects} agents={pick.agents} />;
    }
    body = (
      <section className="space-y-5 border-t border-stone-line pt-6">
        <div>
          <h2 className="font-display text-[24px] leading-tight text-charcoal">{title}</h2>
          <p className="mt-1 text-sm text-charcoal-600">{desc}</p>
        </div>
        {inner}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader title="Αναφορές" description="Πωλήσεις, leads, πωλητές, μονάδες, εισπράξεις, διαχείριση ακινήτων, καμπάνιες και λίστες κλήσεων — με σύγκριση με πέρσι και export." />
      <ReportsHub tiles={REPORT_TILES} active={active}>{body}</ReportsHub>
    </div>
  );
}
