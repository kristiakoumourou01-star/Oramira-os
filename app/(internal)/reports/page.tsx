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
import { CustomReport } from '@/components/reports/CustomReport';
import { loadCustomReport } from '@/lib/custom-report';
import { boardReportPdfWeekly, boardReportPdfMonthly, investorReportPdf } from '@/app/actions/reports';

export const dynamic = 'force-dynamic';

const TILES: ReportTile[] = [
  { key: 'pipeline', title: 'Πωλήσεις', desc: 'Ανοιχτά deals και αξία σε κάθε στάδιο', icon: 'Layers' },
  { key: 'leads_source', title: 'Leads', desc: 'Πηγές leads και μετατροπή (90 ημ.)', icon: 'Users' },
  { key: 'reservations', title: 'Κρατήσεις', desc: 'Κρατήσεις, προκαταβολές και λήξεις', icon: 'CalendarCheck' },
  { key: 'custom', title: 'Custom report', desc: 'Φτιάξτε το δικό σας φίλτρο πελατών', icon: 'SlidersHorizontal' },
  { key: 'inventory', title: 'Μονάδες', desc: 'Απόθεμα με τιμή, εμβαδόν και κατάσταση', icon: 'Home' },
  { key: 'invoices', title: 'Τιμολόγια', desc: 'ΦΠΑ, παραστατικά και σύνολα', icon: 'Receipt' },
  { key: 'commissions', title: 'Προμήθειες', desc: 'Προμήθειες πωλητών και συνεργατών', icon: 'BadgePercent' },
  { key: 'activities', title: 'Tasks', desc: 'Εργασίες και κλήσεις ανά χρήστη', icon: 'ListChecks' },
  { key: 'maintenance', title: 'Συντήρηση', desc: 'Αιτήματα ιδιοκτητών ανά έργο', icon: 'Wrench' },
  { key: 'leave', title: 'Άδειες', desc: 'Αιτήματα αδειών και εγκεκριμένες ημέρες', icon: 'Plane' },
  { key: 'board', title: 'Board pack', desc: 'Εικόνα για τη διοίκηση — PDF εβδομάδας / μήνα', icon: 'Briefcase' },
  { key: 'investor', title: 'Investor report', desc: 'Αναφορά για επενδυτές σε PDF', icon: 'LineChart' },
  { key: 'strategy', title: 'Strategy', desc: 'Στρατηγικό πλάνο και προτεραιότητες', icon: 'Target' },
  { key: 'knowledge', title: 'Knowledge graph', desc: 'Σχέσεις επαφών, έργων και deals', icon: 'Network' },
  { key: 'memory', title: 'Executive memory', desc: 'Αποφάσεις και σημειώσεις διοίκησης', icon: 'Brain' },
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
  } else if (active === 'custom') {
    const c = await loadCustomReport();
    body = <CustomReport rows={c.rows} fields={c.fields} templates={c.templates} canExport={canExport} />;
  } else if (active === 'memory') {
    body = <MemoryPanel initial={await searchMemory(supabase, { limit: 50 })} />;
  } else if (active) {
    const rep = await buildDataReport(supabase, active);
    body = rep ? <div className="space-y-4"><h2 className="font-display text-2xl text-charcoal">{title}</h2><DataReportView report={rep} title={title} canExport={canExport} pageSize={25} /></div> : null;
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Marketing" title="Αναφορές" description="Πωλήσεις, leads, κρατήσεις, μονάδες, τιμολόγια, προμήθειες και custom αναφορές — με export." />
      <ReportsHub tiles={TILES} active={active}>{body}</ReportsHub>
    </div>
  );
}
