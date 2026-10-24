import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

/**
 * Shared institutional-report model + a pdf-lib renderer (no native deps). One
 * `StructuredReport` shape drives both the on-screen dashboard view and the PDF
 * export, so board and investor packs never drift between screen and paper.
 */

export interface ReportMetric { label: string; value: string; hint?: string }
export interface ReportTable { headers: string[]; rows: string[][] }
export interface ReportSection { title: string; blurb?: string; metrics?: ReportMetric[]; bullets?: string[]; table?: ReportTable }
export interface StructuredReport { title: string; subtitle: string; generatedAt: string; sections: ReportSection[] }

const forest = rgb(0.12, 0.30, 0.23);
const ink = rgb(0.17, 0.16, 0.15);
const muted = rgb(0.45, 0.43, 0.39);
const line = rgb(0.89, 0.85, 0.79);
const M = 50;
const PAGE_W = 595;
const PAGE_H = 842;

export async function renderReportPdf(report: StructuredReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 60;
  const text = (s: string, x: number, size: number, f: PDFFont, color = ink) => page.drawText(s, { x, y, size, font: f, color });
  const ensure = (need: number) => { if (y - need < 60) { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - 60; } };
  const wrap = (s: string, f: PDFFont, size: number, maxW: number): string[] => {
    const words = s.split(' '); const lines: string[] = []; let cur = '';
    for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (f.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  };

  // Header
  text('Oramira', M, 22, bold, forest);
  text(report.title, M + 90, 12, bold, muted);
  y -= 22;
  text(report.subtitle, M, 11, font, muted);
  text(report.generatedAt, PAGE_W - M - font.widthOfTextAtSize(report.generatedAt, 9), 9, font, muted);
  y -= 12;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1, color: forest });
  y -= 26;

  for (const sec of report.sections) {
    ensure(40);
    text(sec.title.toUpperCase(), M, 11, bold, forest);
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 0.5, color: line });
    y -= 16;

    if (sec.blurb) { for (const ln of wrap(sec.blurb, font, 9.5, PAGE_W - 2 * M)) { ensure(14); text(ln, M, 9.5, font, muted); y -= 13; } y -= 4; }

    if (sec.metrics?.length) {
      const cols = 3; const colW = (PAGE_W - 2 * M) / cols;
      for (let i = 0; i < sec.metrics.length; i += cols) {
        ensure(34);
        const row = sec.metrics.slice(i, i + cols);
        row.forEach((m, j) => {
          const x = M + j * colW;
          page.drawText(m.label.toUpperCase(), { x, y, size: 7.5, font, color: muted });
          page.drawText(m.value, { x, y: y - 14, size: 13, font: bold, color: ink });
          if (m.hint) page.drawText(m.hint, { x, y: y - 25, size: 7.5, font, color: muted });
        });
        y -= 40;
      }
    }

    if (sec.bullets?.length) {
      for (const b of sec.bullets) {
        const lines = wrap(b, font, 9.5, PAGE_W - 2 * M - 12);
        ensure(lines.length * 13 + 2);
        page.drawCircle({ x: M + 3, y: y - 3, size: 1.5, color: forest });
        lines.forEach((ln, k) => { text(ln, M + 12, 9.5, font); y -= 13; if (k < lines.length - 1) {} });
        y -= 2;
      }
      y -= 4;
    }

    if (sec.table) {
      const cols = sec.table.headers.length; const colW = (PAGE_W - 2 * M) / cols;
      ensure(20);
      sec.table.headers.forEach((h, j) => page.drawText(h, { x: M + j * colW, y, size: 8, font: bold, color: muted }));
      y -= 14;
      for (const r of sec.table.rows) {
        ensure(14);
        r.forEach((c, j) => page.drawText(c, { x: M + j * colW, y, size: 8.5, font, color: ink }));
        y -= 13;
      }
      y -= 6;
    }
    y -= 10;
  }

  return pdf.save();
}
