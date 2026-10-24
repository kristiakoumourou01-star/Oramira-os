import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { periodOverPeriod, countRows, type Trend } from '@/lib/trend';

/**
 * Sales KPI engine — computes the executive sales metrics from the live CRM
 * tables in one pass. Pure aggregation in JS (RLS-safe via the caller's client),
 * so management reporting stays consistent with the operational data.
 */

export interface AgentPerformance {
  agentId: string;
  name: string;
  leads: number;
  responded: number;
  won: number;
  commissionPending: number;
}
export interface SourcePerformance {
  source: string;
  leads: number;
  won: number;
  conversionPct: number;
}
export interface SalesKpis {
  totalLeads: number;
  speedToLeadAvgMinutes: number | null;
  speedToLeadMedianMinutes: number | null;
  responseRatePct: number;
  bookingRatePct: number;        // leads with a viewing booked
  viewingToReservationPct: number;
  reservationToSalePct: number;
  reservationsCount: number;
  wonCount: number;
  commissionsPending: number;
  commissionsPaid: number;
  agents: AgentPerformance[];
  sources: SourcePerformance[];
  leadsTrend: Trend;             // new leads, this 30d vs prior 30d
}

import { selectResilient } from '@/lib/db-resilient';

type Client = SupabaseClient<Database>;

export async function computeSalesKpis(supabase: Client): Promise<SalesKpis> {
  const [leads, viewingsRes, reservationsRes, { data: commissions }, { data: profiles }] = await Promise.all([
    // Resilient: first_response_at (0027) may be absent — degrade to base columns
    // so KPIs reflect real volume/conversion instead of a false zero.
    selectResilient(
      supabase.from('leads').select('id, status, source, assigned_to, created_at, first_response_at'),
      () => supabase.from('leads').select('id, status, source, assigned_to, created_at'),
      'computeSalesKpis',
    ),
    supabase.from('viewings').select('id, lead_id, status'),
    supabase.from('reservations').select('id'),
    supabase.from('commissions').select('profile_id, amount, status'),
    supabase.from('profiles').select('id, full_name'),
  ]);
  // viewings can be schema-cache-blocked; treat as empty rather than failing.
  const viewings = viewingsRes.error ? [] : (viewingsRes.data ?? []);
  const reservations = reservationsRes.error ? [] : (reservationsRes.data ?? []);

  const L = (leads ?? []) as any[];
  const totalLeads = L.length;
  const won = L.filter((l) => l.status === 'won');
  const wonCount = won.length;
  const reservationsCount = (reservations ?? []).length;

  // Speed-to-lead: minutes from creation to first human response.
  const responseTimes = L
    .filter((l) => l.first_response_at)
    .map((l) => (new Date(l.first_response_at!).getTime() - new Date(l.created_at).getTime()) / 60000)
    .filter((m) => m >= 0)
    .sort((a, b) => a - b);
  const speedToLeadAvgMinutes = responseTimes.length ? Math.round(responseTimes.reduce((s, m) => s + m, 0) / responseTimes.length) : null;
  const speedToLeadMedianMinutes = responseTimes.length ? Math.round(responseTimes[Math.floor(responseTimes.length / 2)]) : null;

  const respondedCount = L.filter((l) => l.first_response_at).length;
  const responseRatePct = totalLeads ? Math.round((respondedCount / totalLeads) * 100) : 0;

  // Booking rate: distinct leads that have at least one viewing.
  const leadsWithViewing = new Set((viewings ?? []).filter((v) => v.lead_id).map((v) => v.lead_id));
  const bookingRatePct = totalLeads ? Math.round((leadsWithViewing.size / totalLeads) * 100) : 0;

  const attendedViewings = (viewings ?? []).filter((v) => v.status === 'attended').length;
  const viewingToReservationPct = attendedViewings ? Math.min(100, Math.round((reservationsCount / attendedViewings) * 100)) : 0;
  const reservationToSalePct = reservationsCount ? Math.min(100, Math.round((wonCount / reservationsCount) * 100)) : 0;

  // Commissions
  const C = commissions ?? [];
  const commissionsPending = C.filter((c) => c.status !== 'paid').reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const commissionsPaid = C.filter((c) => c.status === 'paid').reduce((s, c) => s + Number(c.amount ?? 0), 0);

  // Per-agent performance
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? 'Agent']));
  const agentMap = new Map<string, AgentPerformance>();
  const ensureAgent = (id: string) => {
    if (!agentMap.has(id)) agentMap.set(id, { agentId: id, name: nameById.get(id) ?? 'Agent', leads: 0, responded: 0, won: 0, commissionPending: 0 });
    return agentMap.get(id)!;
  };
  for (const l of L) {
    if (!l.assigned_to) continue;
    const a = ensureAgent(l.assigned_to);
    a.leads += 1;
    if (l.first_response_at) a.responded += 1;
    if (l.status === 'won') a.won += 1;
  }
  for (const c of C) {
    if (c.status !== 'paid' && c.profile_id) ensureAgent(c.profile_id).commissionPending += Number(c.amount ?? 0);
  }
  const agents = [...agentMap.values()].sort((a, b) => b.won - a.won || b.leads - a.leads);

  // Lead-source performance
  const sourceMap = new Map<string, { leads: number; won: number }>();
  for (const l of L) {
    const s = l.source ?? 'unknown';
    const e = sourceMap.get(s) ?? { leads: 0, won: 0 };
    e.leads += 1;
    if (l.status === 'won') e.won += 1;
    sourceMap.set(s, e);
  }
  const sources: SourcePerformance[] = [...sourceMap.entries()]
    .map(([source, v]) => ({ source, leads: v.leads, won: v.won, conversionPct: v.leads ? Math.round((v.won / v.leads) * 100) : 0 }))
    .sort((a, b) => b.leads - a.leads);

  // New-lead momentum: this 30 days vs the prior 30 (more leads = better).
  const leadsTrend = periodOverPeriod(L, (l: any) => (l.created_at ? new Date(l.created_at).getTime() : null), countRows, { windowDays: 30, higherIsBetter: true });

  return {
    totalLeads, speedToLeadAvgMinutes, speedToLeadMedianMinutes, responseRatePct, bookingRatePct,
    viewingToReservationPct, reservationToSalePct, reservationsCount, wonCount,
    commissionsPending, commissionsPaid, agents, sources, leadsTrend,
  };
}

export function formatMinutes(m: number | null): string {
  if (m == null) return '—';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
}
