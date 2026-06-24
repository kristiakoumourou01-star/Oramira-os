import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Management financial snapshot — decision metrics, not accounting. Runs under
 * the staff session (RLS staff_all on every table read here). Aggregations are
 * done in TypeScript from narrow column selects: fast enough for a management
 * dashboard and keeps the heavy logic readable in one place.
 */

export interface ProjectPerformance {
  projectId: string;
  name: string;
  totalUnits: number;
  soldUnits: number;
  availableUnits: number;
  revenue: number;            // signed-contract value
  collected: number;          // cash received
  contractorLiabilities: number;
  contribution: number;       // revenue − contractor liabilities (rough)
}

export interface FinanceSnapshot {
  activeLeads: number;
  activeReservations: number;
  soldUnits: number;
  availableUnits: number;
  cashCollected: number;
  outstandingBalance: number;
  contractorLiabilities: number;
  warrantyClaims: number;
  maintenanceOpen: number;
  maintenanceClosed: number;
  avgSalesCycleDays: number | null;
  reservationsLast90: number;
  totalRevenue: number;
  projects: ProjectPerformance[];
}

const SOLD = ['sold', 'handed_over'];
const CLOSED_TICKET = ['resolved', 'closed'];
const OPEN_INVOICE = ['submitted', 'approved'];

export async function getFinanceSnapshot(): Promise<FinanceSnapshot> {
  const supabase = await createSupabaseServerClient();

  const [
    { data: projects },
    { data: units },
    { data: contracts },
    { data: payments },
    { data: reservations },
    { data: invoices },
    { data: tickets },
    { data: leads },
  ] = await Promise.all([
    supabase.from('projects').select('id, name'),
    supabase.from('units').select('id, project_id, status'),
    supabase.from('contracts').select('id, unit_id, total_price, status'),
    supabase.from('payments').select('contract_id, amount_paid'),
    supabase.from('reservations').select('buyer_contact_id, reserved_at, status'),
    supabase.from('contractor_invoices').select('project_id, amount, status'),
    supabase.from('maintenance_tickets').select('status, warranty_id'),
    supabase.from('leads').select('contact_id, status, created_at'),
  ]);

  const unitToProject = new Map<string, string>();
  for (const u of units ?? []) unitToProject.set(u.id, u.project_id);

  const cashCollected = (payments ?? []).reduce((s, p) => s + Number(p.amount_paid), 0);
  const paymentsByContract = new Map<string, number>();
  for (const p of payments ?? []) paymentsByContract.set(p.contract_id, (paymentsByContract.get(p.contract_id) ?? 0) + Number(p.amount_paid));

  const signedContracts = (contracts ?? []).filter((c) => c.status === 'signed');
  const totalRevenue = signedContracts.reduce((s, c) => s + Number(c.total_price ?? 0), 0);
  const outstandingBalance = Math.max(0, totalRevenue - cashCollected);

  const contractorLiabilities = (invoices ?? [])
    .filter((i) => OPEN_INVOICE.includes(i.status))
    .reduce((s, i) => s + Number(i.amount), 0);

  // Per-project rollup
  const perProject = new Map<string, ProjectPerformance>();
  for (const p of projects ?? []) {
    perProject.set(p.id, {
      projectId: p.id, name: p.name, totalUnits: 0, soldUnits: 0, availableUnits: 0,
      revenue: 0, collected: 0, contractorLiabilities: 0, contribution: 0,
    });
  }
  for (const u of units ?? []) {
    const row = perProject.get(u.project_id);
    if (!row) continue;
    row.totalUnits += 1;
    if (SOLD.includes(u.status)) row.soldUnits += 1;
    if (u.status === 'available') row.availableUnits += 1;
  }
  for (const c of signedContracts) {
    const projectId = unitToProject.get(c.unit_id);
    const row = projectId ? perProject.get(projectId) : undefined;
    if (!row) continue;
    row.revenue += Number(c.total_price ?? 0);
    row.collected += paymentsByContract.get(c.id) ?? 0;
  }
  for (const i of invoices ?? []) {
    if (!i.project_id || !OPEN_INVOICE.includes(i.status)) continue;
    const row = perProject.get(i.project_id);
    if (row) row.contractorLiabilities += Number(i.amount);
  }
  for (const row of perProject.values()) row.contribution = row.revenue - row.contractorLiabilities;

  // Average sales cycle: earliest lead → reservation, per contact.
  const earliestLead = new Map<string, number>();
  for (const l of leads ?? []) {
    if (!l.contact_id) continue;
    const t = new Date(l.created_at).getTime();
    const cur = earliestLead.get(l.contact_id);
    if (cur == null || t < cur) earliestLead.set(l.contact_id, t);
  }
  const cycles: number[] = [];
  const now = Date.now();
  const ninetyAgo = now - 90 * 24 * 60 * 60 * 1000;
  let reservationsLast90 = 0;
  for (const r of reservations ?? []) {
    const reservedAt = new Date(r.reserved_at).getTime();
    if (reservedAt >= ninetyAgo) reservationsLast90 += 1;
    const leadAt = earliestLead.get(r.buyer_contact_id);
    if (leadAt != null && reservedAt >= leadAt) cycles.push((reservedAt - leadAt) / (24 * 60 * 60 * 1000));
  }
  const avgSalesCycleDays = cycles.length > 0 ? Math.round(cycles.reduce((s, d) => s + d, 0) / cycles.length) : null;

  return {
    activeLeads: (leads ?? []).filter((l) => l.status !== 'won' && l.status !== 'lost').length,
    activeReservations: (reservations ?? []).filter((r) => r.status === 'active').length,
    soldUnits: (units ?? []).filter((u) => SOLD.includes(u.status)).length,
    availableUnits: (units ?? []).filter((u) => u.status === 'available').length,
    cashCollected,
    outstandingBalance,
    contractorLiabilities,
    warrantyClaims: (tickets ?? []).filter((t) => t.warranty_id != null).length,
    maintenanceOpen: (tickets ?? []).filter((t) => !CLOSED_TICKET.includes(t.status)).length,
    maintenanceClosed: (tickets ?? []).filter((t) => CLOSED_TICKET.includes(t.status)).length,
    avgSalesCycleDays,
    reservationsLast90,
    totalRevenue,
    projects: Array.from(perProject.values()).sort((a, b) => b.revenue - a.revenue),
  };
}
