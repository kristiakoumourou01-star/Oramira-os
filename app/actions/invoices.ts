'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission, requireRole } from '@/lib/auth';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getOrgSettings } from '@/lib/org-settings';
import { logActivity } from '@/lib/activity';
import { KIND_LABEL, type DocKind } from '@/lib/invoices-shared';

export type DocResult = { ok: true; id: string; number: string } | { ok: false; error: string };
export type SeriesResult = { ok: true } | { ok: false; error: string };

export interface IssueInput {
  issue_date?: string;
  due_date?: string;
  contact_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_address?: string;
  customer_vat_no?: string;
  project_id?: string;
  unit_id?: string;
  related_id?: string;
  payment_method?: string;
  notes?: string;
  /** Commission invoice for a won lead: linked back to the lead. */
  lead_id?: string;
  /** Empty for a credit note = credit the whole invoice. */
  lines: { description: string; qty: number; unit_price: number; vat_rate: number }[];
}

const KINDS: DocKind[] = ['invoice', 'receipt', 'credit_note'];
const MISSING = 'Χρειάζεται πρώτα η αλλαγή στη βάση για τα τιμολόγια (migration 0056 — αρχείο supabase/ΕΚΚΡΕΜΕΙ_ΣΤΗ_ΒΑΣΗ.sql).';

/** Clean a database error into one sentence for the person. */
function friendly(msg: string): string {
  if (/does not exist|schema cache|Could not find the function/i.test(msg)) return MISSING;
  return msg.replace(/^.*?ERROR:\s*/, '').split('\n')[0];
}

/**
 * Issue a document. The database computes totals, checks balances and gives
 * the next number in the same transaction, so a failed attempt never uses up
 * a number. Needs "Οικονομικά → Δημιουργεί & αλλάζει".
 */
export async function issueDocument(kind: DocKind, input: IssueInput): Promise<DocResult> {
  const profile = await requirePermission('financials', 'edit');
  if (!KINDS.includes(kind)) return { ok: false, error: 'Άγνωστο είδος παραστατικού.' };

  const { invoices: cfg } = await getOrgSettings();
  const allowed = new Set(cfg.vatRates.map((r) => r.rate));
  allowed.add(0); // receipts are recorded without VAT
  const svc = createSupabaseServiceRoleClient() as any;
  if (kind === 'credit_note' && input.related_id) {
    // A credit reverses the original: its rates stay valid even if Settings changed since.
    const { data: orig } = await svc.from('invoices').select('lines').eq('id', input.related_id).maybeSingle();
    for (const l of ((orig as any)?.lines ?? []) as { vat_rate: number }[]) allowed.add(Number(l.vat_rate));
  }
  const lines = (Array.isArray(input.lines) ? input.lines : [])
    .filter((l) => String(l.description ?? '').trim() || Number(l.unit_price))
    .map((l) => ({
      description: String(l.description ?? '').trim(),
      qty: Number(l.qty),
      unit_price: Number(l.unit_price),
      vat_rate: Number(l.vat_rate),
    }));
  for (const l of lines) {
    if (!allowed.has(l.vat_rate)) return { ok: false, error: `Ο συντελεστής ΦΠΑ ${l.vat_rate}% δεν υπάρχει στις Ρυθμίσεις → Τιμολόγια & ΦΠΑ.` };
    if (!Number.isFinite(l.qty) || !Number.isFinite(l.unit_price)) return { ok: false, error: 'Ελέγξτε ποσότητες και τιμές.' };
  }
  if (!lines.length && kind !== 'credit_note') return { ok: false, error: 'Προσθέστε τουλάχιστον μία γραμμή.' };

  const s = (v?: string) => (typeof v === 'string' ? v.trim() : '');
  const doc = {
    issue_date: s(input.issue_date), due_date: s(input.due_date),
    contact_id: s(input.contact_id), customer_name: s(input.customer_name).slice(0, 200),
    customer_email: s(input.customer_email).slice(0, 200), customer_address: s(input.customer_address).slice(0, 400),
    customer_vat_no: s(input.customer_vat_no).slice(0, 40),
    project_id: s(input.project_id), unit_id: s(input.unit_id), related_id: s(input.related_id),
    payment_method: s(input.payment_method).slice(0, 60), notes: s(input.notes).slice(0, 2000),
    lines,
  };

  const { data, error } = await svc.rpc('issue_document', { p_kind: kind, p_doc: doc, p_actor: profile.id });
  if (error) return { ok: false, error: friendly(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return { ok: false, error: 'Η έκδοση δεν ολοκληρώθηκε.' };

  await logActivity({
    entityType: 'invoice', entityId: row.id, action: `${kind}_issued`,
    metadata: { number: row.number, total: row.total, customer: row.customer_name, related_id: row.related_id ?? null },
  });
  if (row.related_id) {
    await logActivity({ entityType: 'invoice', entityId: row.related_id, action: `${kind}_issued`, metadata: { number: row.number, total: row.total } });
  }
  if (kind === 'invoice' && input.lead_id && /^[0-9a-f-]{36}$/i.test(input.lead_id)) {
    await svc.from('leads').update({ commission_invoice_id: row.id }).eq('id', input.lead_id).is('commission_invoice_id', null);
    revalidatePath(`/crm/leads/${input.lead_id}`);
  }
  revalidatePath('/financials/invoices');
  if (row.related_id) revalidatePath(`/financials/invoices/${row.related_id}`);
  return { ok: true, id: row.id, number: row.number };
}

/**
 * Settings → Τιμολόγια & ΦΠΑ: rename a series, change its prefix or where it
 * continues from. Admin only. The database refuses to move the counter back
 * once documents exist (no duplicates, no gaps).
 */
export async function updateSeries(key: DocKind, label: string, prefix: string, next: number): Promise<SeriesResult> {
  await requireRole(['admin']);
  if (!KINDS.includes(key)) return { ok: false, error: 'Άγνωστη σειρά.' };
  const p = String(prefix ?? '');
  if (/[^A-Za-z0-9Α-Ωα-ω{}\-/._ ]/.test(p)) return { ok: false, error: 'Το πρόθεμα δέχεται γράμματα, αριθμούς, - / . _ και {YYYY}.' };
  const n = Math.round(Number(next));
  const svc = createSupabaseServiceRoleClient() as any;
  const { error } = await svc.rpc('update_document_series', { p_key: key, p_label: String(label ?? ''), p_prefix: p, p_next: n });
  if (error) return { ok: false, error: friendly(error.message) };
  await logActivity({ entityType: 'org_settings', entityId: 'org', action: 'settings_updated', metadata: { slice: 'document_series', series: KIND_LABEL[key], prefix: p, next: n } });
  revalidatePath('/settings');
  return { ok: true };
}
