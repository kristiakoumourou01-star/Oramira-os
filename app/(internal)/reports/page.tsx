import { requirePermission, hasRight } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildBoardReport } from '@/lib/board-report';
import { buildInvestorReport } from '@/lib/investor-report';
import { buildStrategicPlan } from '@/lib/strategic-planning';
import { getKnowledgeOverview } from '@/lib/knowledge-graph';
import { searchMemory } from '@/lib/executive-memory';
import { buildDataReport } from '@/lib/data-reports';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { ReportView } from '@/components/reports/ReportView';
import { DownloadReportButton } from '@/components/reports/DownloadReportButton';
import { StrategyView } from '@/components/reports/StrategyView';
import { KnowledgePanel } from '@/components/reports/KnowledgePanel';
import { MemoryPanel } from '@/components/reports/MemoryPanel';
import { ReportsHub, type ReportTile } from '@/components/reports/ReportsHub';
import { DataReportView } from '@/components/reports/DataReportView';
import { boardReportPdfWeekly, boardReportPdfMonthly, investorReportPdf } from '@/app/actions/reports';

export const dynamic = 'force-dynamic';

const TILES: ReportTile[] = [
  { key: 'board', title: 'Board pack', desc: 'Μηνιαία εικόνα για τη διοίκηση — PDF εβδομάδας / μήνα.', icon: 'Briefcase', group: 'Διοίκηση', tone: 'forest' },
  { key: 'investor', title: 'Investor report', desc: 'Αναφορά για επενδυτές, έτοιμη για PDF.', icon: 'LineChart', group: 'Διοίκηση', tone: 'sand' },
  { key: 'strategy', title: 'Strategy', desc: 'Στρατηγικό πλάνο, στόχοι και προτεραιότητες.', icon: 'Target', group: 'Διοίκηση', tone: 'violet' },
  { key: 'leads_source', title: 'Leads ανά πηγή', desc: 'Από πού έρχονται τα leads και πόσα κλείνουν (90 ημ.).', icon: 'Users', group: 'Πωλήσεις', tone: 'sky' },
  { key: 'pipeline', title: 'Pipeline ανά στάδιο', desc: 'Ανοιχτά deals και αξία σε κάθε στάδιο.', icon: 'Layers', group: 'Πωλήσεις', tone: 'forest' },
  { key: 'reservations', title: 'Κρατήσεις', desc: 'Όλες οι κρατήσεις με προκαταβολές και λήξεις.', icon: 'CalendarCheck', group: 'Πωλήσεις', tone: 'amber' },
  { key: 'activities', title: 'Activities ανά χρήστη', desc: 'Ανοιχτές, καθυστερημένες και ολοκληρωμένες εργασίες.', icon: 'ListChecks', group: 'Πωλήσεις', tone: 'teal' },
  { key: 'inventory', title: 'Απόθεμα μονάδων', desc: 'Όλες οι μονάδες με τιμή, εμβαδόν και κατάσταση.', icon: 'Home', group: 'Έργα', tone: 'green' },
  { key: 'maintenance', title: 'Συντήρηση', desc: 'Αιτήματα ιδιοκτητών ανά έργο και κατάσταση.', icon: 'Wrench', group: 'Έργα', tone: 'rose' },
  { key: 'invoices', title: 'Τιμολόγια', desc: 'Παραστατικά με καθαρό, ΦΠΑ και σύνολα.', icon: 'Receipt', group: 'Οικονομικά', tone: 'sand' },
  { key: 'commissions', title: 'Προμήθειες', desc: 'Προμήθειες πωλητών, πληρωμένες και εκκρεμείς.', icon: 'BadgePercent', group: 'Οικονομικά', tone: 'violet' },
  { key: 'leave', title: 'Άδειες', desc: 'Αιτήματα αδειών και εγκεκριμένες ημέρες.', icon: 'Plane', group: 'Ομάδα', tone: 'sky' },
  { key: 'knowledge', title: 'Knowledge graph', desc: 'Σχέσεις επαφών, έργων και deals.', icon: 'Network', group: 'Γνώση', tone: 'teal' },
  { key: 'memory', title: 'Executive memory', desc: 'Αποφάσεις και σημειώσεις της διοίκησης.', icon: 'Brain', group: 'Γνώση', tone: 'forest' },
];

/** Reports: κουτάκια πάνω (όπως στο FitnessCRM), η επιλεγμένη αναφορά από κάτω με export. */
export default async function ReportsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const profile = await requirePermission('financials');
  const canExport = hasRight(profile, 'export_data');
  const supabase = await createSupabaseServerClient();
  const active = TILES.some((t) => t.key === searchParams?.tab) ? searchParams.tab! : null;
  const title = TILES.find((t) => t.key === active)?.title ?? '';

  let body: React.ReactNode = null;
  if (active === 'board') {
    const board = await buildBoardReport(supabase, 'monthly');
    body = (
      <div className="space-y-4">
        {canExport && <div className="flex flex-wrap justify-end gap-2"><DownloadReportButton label="Weekly summary PDF" action={boardReportPdfWeekly} /><DownloadReportButton label="Monthly pack PDF" action={boardReportPdfMonthly} /></div>}
        <ReportView report={board} />
      </div>
    );
  } else if (active === 'investor') {
    const investor = await buildInvestorReport(supabase);
    body = (
      <div className="space-y-4">
        {canExport && <div className="flex justify-end"><DownloadReportButton label="Investor report PDF" action={investorReportPdf} /></div>}
        <ReportView report={investor} />
      </div>
    );
  } else if (active === 'strategy') {
    body = <StrategyView plan={await buildStrategicPlan(supabase)} />;
  } else if (active === 'knowledge') {
    const [knowledge, { data: contacts }] = await Promise.all([getKnowledgeOverview(supabase), supabase.from('contacts').select('id, full_name').order('full_name').limit(500)]);
    body = <KnowledgePanel overview={knowledge} contacts={(contacts ?? []).map((c: any) => ({ id: c.id, name: c.full_name ?? 'Contact' }))} />;
  } else if (active === 'memory') {
    body = <MemoryPanel initial={await searchMemory(supabase, { limit: 50 })} />;
  } else if (active) {
    const rep = await buildDataReport(supabase, active);
    body = rep ? <DataReportView report={rep} title={title} canExport={canExport} /> : null;
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Reports" title="Reports & Intelligence" description="Διαλέξτε αναφορά από τα κουτάκια — εμφανίζεται από κάτω, με export σε CSV / Excel και εκτύπωση / PDF." />
      <ReportsHub tiles={TILES} active={active}>{body}</ReportsHub>
    </div>
  );
}
