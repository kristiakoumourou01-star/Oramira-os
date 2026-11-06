/**
 * Παραστατικά (τιμολόγια, αποδείξεις, πιστωτικά) — client-safe half: types,
 * labels and the same arithmetic the database uses, for the live preview in
 * the form. The database (issue_document in migration 0056) is the source of
 * truth: it recomputes every total and hands out the number.
 */

import { formatDecimal } from '@/lib/format';

export type DocKind = 'invoice' | 'receipt' | 'credit_note';
export type DocStatus = 'issued' | 'partially_paid' | 'paid' | 'partially_credited' | 'credited';

export interface DocLine { description: string; qty: number; unit_price: number; vat_rate: number; net?: number; vat?: number }
export interface VatBucket { rate: number; net: number; vat: number }

export interface InvoiceDoc {
  id: string;
  kind: DocKind;
  number: string;
  seq: number;
  issue_date: string;
  due_date: string | null;
  contact_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_address: string | null;
  customer_vat_no: string | null;
  project_id: string | null;
  unit_id: string | null;
  related_id: string | null;
  lines: DocLine[];
  vat_breakdown: VatBucket[];
  net_total: number;
  vat_total: number;
  total: number;
  payment_method: string | null;
  notes: string | null;
  status: DocStatus;
  created_by: string | null;
  created_at: string;
}

export interface DocSeries { key: DocKind; label: string; prefix: string; next_number: number }

export const KIND_LABEL: Record<DocKind, string> = {
  invoice: 'Τιμολόγιο',
  receipt: 'Απόδειξη είσπραξης',
  credit_note: 'Πιστωτικό σημείωμα',
};
export const KIND_PLURAL: Record<DocKind, string> = {
  invoice: 'Τιμολόγια',
  receipt: 'Αποδείξεις',
  credit_note: 'Πιστωτικά',
};

export const STATUS_LABEL: Record<DocStatus, string> = {
  issued: 'Ανοιχτό',
  partially_paid: 'Μερικώς εξοφλημένο',
  paid: 'Εξοφλημένο',
  partially_credited: 'Μερικώς πιστωμένο',
  credited: 'Πιστωμένο',
};

export const PAYMENT_METHODS = ['Τραπεζική μεταφορά', 'Κάρτα', 'Μετρητά', 'Επιταγή', 'Direct debit'];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Same rounding as the database: per line, net then VAT, both to the cent. */
export function computeTotals(lines: Pick<DocLine, 'qty' | 'unit_price' | 'vat_rate'>[]) {
  const buckets = new Map<number, VatBucket>();
  let net = 0;
  let vat = 0;
  for (const l of lines) {
    const n = r2((Number(l.qty) || 0) * (Number(l.unit_price) || 0));
    const v = r2((n * (Number(l.vat_rate) || 0)) / 100);
    net += n;
    vat += v;
    const b = buckets.get(Number(l.vat_rate) || 0) ?? { rate: Number(l.vat_rate) || 0, net: 0, vat: 0 };
    b.net = r2(b.net + n);
    b.vat = r2(b.vat + v);
    buckets.set(b.rate, b);
  }
  return {
    net: r2(net),
    vat: r2(vat),
    total: r2(net + vat),
    breakdown: Array.from(buckets.values()).sort((a, b) => b.rate - a.rate),
  };
}

/** What the next number of a series will look like (prefix {YYYY} + 4 digits). */
export function previewNumber(s: Pick<DocSeries, 'prefix' | 'next_number'>, date = new Date()): string {
  return s.prefix.replace(/\{YYYY\}/g, String(date.getFullYear())) + String(s.next_number).padStart(4, '0');
}

/** "€1.234,50" / "€1,234.50" (the user's number format) — documents always show cents. */
export function money(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return (v < 0 ? '−€' : '€') + formatDecimal(Math.abs(v), 2);
}
