'use server';

import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildBoardReport } from '@/lib/board-report';
import { buildInvestorReport } from '@/lib/investor-report';
import { renderReportPdf } from '@/lib/report-pdf';

/** Renders the board pack to a PDF and returns it base64-encoded for download. */
export async function boardReportPdf(period: 'weekly' | 'monthly'): Promise<{ filename: string; base64: string }> {
  await requirePermission('financials');
  const supabase = await createSupabaseServerClient();
  const report = await buildBoardReport(supabase, period);
  const bytes = await renderReportPdf(report);
  return { filename: `oramira-${period}-board-${new Date().toISOString().slice(0, 10)}.pdf`, base64: Buffer.from(bytes).toString('base64') };
}

export async function boardReportPdfWeekly() { return boardReportPdf('weekly'); }
export async function boardReportPdfMonthly() { return boardReportPdf('monthly'); }

/** Renders the investor report to a PDF and returns it base64-encoded. */
export async function investorReportPdf(): Promise<{ filename: string; base64: string }> {
  await requirePermission('financials');
  const supabase = await createSupabaseServerClient();
  const report = await buildInvestorReport(supabase);
  const bytes = await renderReportPdf(report);
  return { filename: `oramira-investor-report-${new Date().toISOString().slice(0, 10)}.pdf`, base64: Buffer.from(bytes).toString('base64') };
}
