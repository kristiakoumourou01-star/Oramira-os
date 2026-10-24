import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatDate, formatDecimal } from '@/lib/format';

/**
 * Renders a payslip to a real PDF (pdf-lib, no native deps) — Cyprus layout:
 * Earnings / Deductions / Employer contributions, plus the Net Salary box.
 * Returned bytes are uploaded to storage by the approve-payroll action.
 */
export interface PayslipPdfData {
  employeeName: string;
  position: string;
  department: string;
  period: string;
  paymentDate: string | null;
  currency: string;
  b: any; // PayrollBreakdown
}

export async function renderPayslipPdf(data: PayslipPdfData): Promise<Uint8Array> {
  const { b } = data;
  const sym = data.currency === 'EUR' ? '€' : '';
  const money = (n: number) => `${sym}${formatDecimal(Number(n ?? 0))}`;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const forest = rgb(0.12, 0.23, 0.19);
  const ink = rgb(0.17, 0.16, 0.15);
  const muted = rgb(0.45, 0.43, 0.39);

  const M = 50;
  let y = 800;
  const text = (s: string, x: number, yy: number, f = font, size = 10, color = ink) => page.drawText(s, { x, y: yy, size, font: f, color });

  text('Oramira', M, y, bold, 20, forest);
  text('PAYSLIP', 480, y + 4, bold, 11, muted);
  y -= 28;
  text(data.employeeName, M, y, bold, 12);
  text(data.period, 480, y, font, 11, muted);
  y -= 15;
  text([data.position, data.department].filter(Boolean).join('  ·  '), M, y, font, 10, muted);
  text(`Payment: ${data.paymentDate ? formatDate(data.paymentDate) : '—'}`, 430, y, font, 9, muted);
  y -= 10;
  page.drawLine({ start: { x: M, y }, end: { x: 545, y }, thickness: 1, color: forest });
  y -= 24;

  // Section helper
  const section = (title: string, rows: [string, number][], startY: number, x: number) => {
    let yy = startY;
    text(title.toUpperCase(), x, yy, bold, 9, muted);
    yy -= 16;
    for (const [label, val] of rows) {
      text(label, x, yy, font, 9);
      text(money(val), x + 175, yy, font, 9);
      yy -= 14;
    }
    return yy;
  };

  const colLeft = M;
  const startY = y;
  const earningsRows: [string, number][] = [['Basic salary', b.baseGross ?? 0]];
  if ((b.bonus ?? 0) > 0) earningsRows.push(['Bonus', b.bonus]);
  if ((b.commission ?? 0) > 0) earningsRows.push(['Commission', b.commission]);
  earningsRows.push(['Total earnings', b.grossPay ?? 0]);

  const dedTotal = (b.totalDeductions ?? 0) + (b.advances ?? 0);
  const deductionRows: [string, number][] = [
    ['Social Insurance', b.socialInsuranceEmployee ?? 0],
    ['GESY', b.gesyEmployee ?? 0],
    ['Income Tax (PAYE)', b.paye ?? 0],
  ];
  if ((b.otherDeductions ?? 0) > 0) deductionRows.push(['Other deductions', b.otherDeductions]);
  if ((b.advances ?? 0) > 0) deductionRows.push(['Advances', b.advances]);
  deductionRows.push(['Total deductions', dedTotal]);

  const contribRows: [string, number][] = [
    ['Social Insurance', b.socialInsuranceEmployer ?? 0],
    ['GESY', b.gesyEmployer ?? 0],
    ['Redundancy Fund', b.redundancy ?? 0],
    ['Social Cohesion', b.socialCohesion ?? 0],
    ['Industrial Training', b.training ?? 0],
    ['Total contributions', b.employerContributions ?? 0],
    ['Company cost', b.employerCost ?? 0],
  ];

  let yA = section('Earnings', earningsRows, startY, colLeft);
  let yB = section('Deductions', deductionRows, startY, 320);
  const after = Math.min(yA, yB) - 20;
  section('Employer contributions', contribRows, after, colLeft);

  // Net salary box
  const net = (b.grossPay ?? 0) - dedTotal;
  const boxY = 120;
  page.drawRectangle({ x: 320, y: boxY, width: 225, height: 44, borderColor: forest, borderWidth: 1.5, color: rgb(0.97, 0.95, 0.92) });
  text('NET SALARY', 335, boxY + 27, bold, 9, muted);
  text(money(net), 335, boxY + 10, bold, 16, forest);

  text('Indicative computation based on standard Cyprus rates (Social Insurance, GESY, PAYE).', M, 60, font, 7, muted);
  text('Verify against current legislation before disbursement.', M, 50, font, 7, muted);

  return pdf.save();
}
