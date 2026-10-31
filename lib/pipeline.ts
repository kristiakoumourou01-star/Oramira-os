import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getOrgSettings } from '@/lib/org-settings';
import { logActivity } from '@/lib/activity';
import { deliverNotification } from '@/lib/notifications';
import { commissionNet, type CommissionDraft } from '@/lib/pipeline-shared';

/**
 * Server half of the pipelines (βήμα 13): the commission invoice that follows
 * a «Won». Read with the service client — a sales agent closing the deal may
 * not have access to financials, but the invoice still has to be prepared.
 */

/** What a commission invoice for this lead would contain (null = nothing sold to bill). */
export async function commissionDraft(leadId: string): Promise<CommissionDraft | null> {
  const svc = createSupabaseServiceRoleClient() as any;
  const { pipelines: cfg, invoices } = await getOrgSettings();
  const { data: lead } = await svc.from('leads').select('id, contact_id, contacts(full_name, email)').eq('id', leadId).maybeSingle();
  if (!lead) return null;
  // The sale: latest contract of this buyer, else reservation, else a unit in their name.
  const { data: contract } = await svc.from('contracts').select('id, unit_id, total_price').eq('buyer_contact_id', lead.contact_id).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1).maybeSingle();
  let unitId: string | null = contract?.unit_id ?? null;
  if (!unitId) {
    const { data: r } = await svc.from('reservations').select('unit_id').eq('buyer_contact_id', lead.contact_id).in('status', ['active', 'converted']).order('reserved_at', { ascending: false }).limit(1).maybeSingle();
    unitId = r?.unit_id ?? null;
  }
  if (!unitId) {
    const { data: u } = await svc.from('units').select('id').eq('buyer_contact_id', lead.contact_id).limit(1).maybeSingle();
    unitId = u?.id ?? null;
  }
  if (!unitId) return null;
  const { data: unit } = await svc.from('units').select('id, unit_number, price, commission_pct, project_id, projects(name)').eq('id', unitId).maybeSingle();
  if (!unit) return null;
  const base = Number(contract?.total_price ?? unit.price ?? 0);
  if (!(base > 0)) return null;
  const pct = unit.commission_pct != null ? Number(unit.commission_pct) : cfg.commission.defaultPct;
  const fixed = cfg.commission.billTo === 'fixed' && cfg.commission.fixed.name;
  return {
    leadId, contactId: fixed ? null : lead.contact_id,
    customer: fixed
      ? { name: cfg.commission.fixed.name, email: cfg.commission.fixed.email, address: cfg.commission.fixed.address, vatNo: cfg.commission.fixed.vatNo }
      : { name: lead.contacts?.full_name ?? '', email: lead.contacts?.email ?? '', address: '', vatNo: '' },
    projectId: unit.project_id, unitId: unit.id,
    description: `Προμήθεια ${pct}% επί της πώλησης — ${unit.projects?.name ?? 'Έργο'} · Μονάδα ${unit.unit_number} (τιμή ${base.toLocaleString('el-GR')} €)`,
    base, pct, net: commissionNet(base, pct), vatRate: cfg.commission.vatRate ?? invoices.defaultVat,
  };
}

async function recipients(svc: any, owner: string | null): Promise<string[]> {
  const { data } = await svc.from('profiles').select('id').in('role', ['admin', 'finance']);
  return Array.from(new Set([owner, ...((data ?? []) as { id: string }[]).map((p) => p.id)].filter(Boolean))) as string[];
}

/**
 * A lead just became «won». Depending on Settings → Pipelines → Προμήθεια:
 * prepare = notify (owner + admins/finance) with a link to a pre-filled
 * invoice; auto = issue the invoice now (numbered, final) and link it.
 */
export async function onLeadWon(leadId: string, actorId: string | null): Promise<{ invoiceId?: string; prepared?: boolean; note?: string }> {
  const { pipelines: cfg, invoices: inv } = await getOrgSettings();
  if (cfg.commission.mode === 'off') return {};
  let svc: any;
  try { svc = createSupabaseServiceRoleClient(); } catch { return { note: 'no-service' }; }
  const { data: lead } = await svc.from('leads').select('id, assigned_to, commission_invoice_id, contacts(full_name)').eq('id', leadId).maybeSingle();
  if (!lead || lead.commission_invoice_id) return {};
  const draft = await commissionDraft(leadId);
  const who = await recipients(svc, lead.assigned_to);
  const name = lead.contacts?.full_name ?? 'πελάτη';
  if (!draft) {
    for (const r of who) await deliverNotification(svc, { userId: r, title: `Κλείσιμο: ${name}`, body: 'Δεν βρέθηκε μονάδα/συμβόλαιο με τιμή — το τιμολόγιο προμήθειας θέλει χειροκίνητη έκδοση.', link: `/crm/leads/${leadId}` });
    return { note: 'no-sale' };
  }
  if (cfg.commission.mode === 'auto') {
    const doc = {
      issue_date: '', due_date: new Date(Date.now() + inv.paymentTermsDays * 86400000).toISOString().slice(0, 10), contact_id: draft.contactId ?? '', customer_name: draft.customer.name || name,
      customer_email: draft.customer.email, customer_address: draft.customer.address, customer_vat_no: draft.customer.vatNo,
      project_id: draft.projectId ?? '', unit_id: draft.unitId ?? '', related_id: '', payment_method: '', notes: 'Αυτόματη έκδοση με το κλείσιμο του lead.',
      lines: [{ description: draft.description, qty: 1, unit_price: draft.net, vat_rate: draft.vatRate }],
    };
    const { data, error } = await svc.rpc('issue_document', { p_kind: 'invoice', p_doc: doc, p_actor: actorId });
    const row = Array.isArray(data) ? data[0] : data;
    if (!error && row?.id) {
      await svc.from('leads').update({ commission_invoice_id: row.id }).eq('id', leadId);
      await logActivity({ entityType: 'invoice', entityId: row.id, action: 'invoice_issued', metadata: { number: row.number, total: row.total, lead: leadId, auto: true } });
      for (const r of who) await deliverNotification(svc, { userId: r, title: `Τιμολόγιο προμήθειας ${row.number}`, body: `Εκδόθηκε αυτόματα για το κλείσιμο με ${name}.`, link: `/financials/invoices/${row.id}` });
      return { invoiceId: row.id };
    }
    // Fall back to «prepare» so nothing is lost.
  }
  for (const r of who) await deliverNotification(svc, { userId: r, title: `Τιμολόγιο προμήθειας για έκδοση: ${name}`, body: `${draft.description}. Ελέγξτε και εκδώστε.`, link: `/financials/invoices/new?lead=${leadId}` });
  return { prepared: true };
}
