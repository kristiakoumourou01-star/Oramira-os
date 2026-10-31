import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import type { DocKind, DocSeries, InvoiceDoc } from '@/lib/invoices-shared';

export * from '@/lib/invoices-shared';

/**
 * Παραστατικά — server reads. Callers MUST check access first
 * (requirePermission('financials')): reads go through the service client so
 * per-user grants (Settings → Χρήστες) work, not only the built-in roles that
 * the table's RLS policy knows about.
 *
 * Every read degrades to empty when migration 0056 hasn't been run yet, so the
 * pages show a "run the migration" hint instead of crashing.
 */

const svc = () => createSupabaseServiceRoleClient() as any;

const isMissing = (msg?: string) => !!msg && /does not exist|schema cache|Could not find/i.test(msg);

export interface DocFilter { kind?: DocKind | ''; status?: string; q?: string; from?: string; to?: string }

export async function listDocuments(f: DocFilter = {}): Promise<{ rows: InvoiceDoc[]; missing: boolean }> {
  let q = svc().from('invoices').select('*').order('issue_date', { ascending: false }).order('seq', { ascending: false }).limit(500);
  if (f.kind) q = q.eq('kind', f.kind);
  if (f.status) q = q.eq('status', f.status);
  if (f.from) q = q.gte('issue_date', f.from);
  if (f.to) q = q.lte('issue_date', f.to);
  if (f.q) {
    const t = f.q.replace(/[%,()]/g, ' ').trim();
    if (t) q = q.or(`number.ilike.%${t}%,customer_name.ilike.%${t}%,customer_email.ilike.%${t}%`);
  }
  const { data, error } = await q;
  if (error) return { rows: [], missing: isMissing(error.message) };
  return { rows: (data ?? []) as InvoiceDoc[], missing: false };
}

export async function getDocument(id: string): Promise<InvoiceDoc | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await svc().from('invoices').select('*').eq('id', id).maybeSingle();
  return (data as InvoiceDoc) ?? null;
}

/** Receipts and credit notes issued against an invoice. */
export async function relatedDocuments(id: string): Promise<InvoiceDoc[]> {
  const { data } = await svc().from('invoices').select('*').eq('related_id', id).order('created_at');
  return (data ?? []) as InvoiceDoc[];
}

/** Still to collect on an invoice: total − credits − receipts. */
export function balanceOf(inv: InvoiceDoc, related: InvoiceDoc[]): { credited: number; paid: number; open: number } {
  const sum = (k: DocKind) => related.filter((d) => d.kind === k).reduce((s, d) => s + Number(d.total), 0);
  const credited = sum('credit_note');
  const paid = sum('receipt');
  return { credited, paid, open: Math.max(0, Math.round((Number(inv.total) - credited - paid) * 100) / 100) };
}

export async function listSeries(): Promise<{ series: DocSeries[]; missing: boolean }> {
  const { data, error } = await svc().from('document_series').select('key,label,prefix,next_number');
  if (error) return { series: [], missing: isMissing(error.message) };
  const order: DocKind[] = ['invoice', 'receipt', 'credit_note'];
  const rows = (data ?? []) as DocSeries[];
  return { series: order.map((k) => rows.find((r) => r.key === k)).filter(Boolean) as DocSeries[], missing: false };
}

/** Contacts, projects and units for the "new document" pickers. */
export async function documentPickers() {
  const s = svc();
  const [c, p, u] = await Promise.all([
    s.from('contacts').select('id,full_name,email').order('full_name').limit(2000),
    s.from('projects').select('id,name').order('name'),
    s.from('units').select('id,unit_number,project_id').order('unit_number').limit(3000),
  ]);
  return {
    contacts: ((c.data ?? []) as { id: string; full_name: string | null; email: string }[]),
    projects: ((p.data ?? []) as { id: string; name: string }[]),
    units: ((u.data ?? []) as { id: string; unit_number: string; project_id: string }[]),
  };
}

/** Names of the people who issued documents (for "Εκδόθηκε από"). */
export async function profileNames(ids: (string | null)[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (!uniq.length) return {};
  const { data } = await svc().from('profiles').select('id,full_name').in('id', uniq);
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { id: string; full_name: string | null }[]) out[r.id] = r.full_name ?? '—';
  return out;
}
