import { getCurrentProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computePriority } from '@/lib/priority';
import { selectResilient } from '@/lib/db-resilient';
import type { LeadListItem } from '@/lib/leads-shared';

/**
 * Enriched lead model for the sales workflow. One place resolves a lead +
 * contact + owner + next follow-up + computed priority, so the leads list, the
 * "Needs action today" rail, and the lead detail page all agree.
 * The LeadListItem type lives in the client-safe shared module.
 */
export type { LeadListItem } from '@/lib/leads-shared';

const DAY = 24 * 60 * 60 * 1000;
const TERMINAL = ['won', 'lost'];

function deriveNeedsAction(status: string, lastContactedAt: string | null, createdAt: string, nextFollowUp: string | null): boolean {
  if (TERMINAL.includes(status)) return false;
  const now = Date.now();
  // Follow-up due today or overdue
  if (nextFollowUp && new Date(nextFollowUp).getTime() <= now) return true;
  // Gone quiet — 5+ days since last contact (or since creation if never)
  const ref = lastContactedAt ? new Date(lastContactedAt).getTime() : new Date(createdAt).getTime();
  return now - ref > 5 * DAY;
}

/** Fetches all leads, enriched + sorted by priority (desc). */
export async function getEnrichedLeads(): Promise<LeadListItem[]> {
  const supabase = await createSupabaseServerClient();

  // Resilient select: prefer the full column set, but degrade gracefully if the
  // assignment/next-action columns (migrations 0020/0027) aren't on the DB yet —
  // otherwise ONE missing column empties the entire pipeline + dashboard. Same
  // philosophy as the AI layer: try the ideal, fall back to what works.
  const BASE = `id, contact_id, status, source, budget_min, budget_max, ai_score, last_contacted_at, created_at,
         assigned_to, contacts(full_name, email, phone), owner:assigned_to(full_name)`;
  const FULL = `${BASE}, assigned_at, next_action_date, next_action_type, pipeline, stage_entered_at, is_returning`;

  // "View as" fidelity: a real Sales Agent only ever gets their own leads (RLS,
  // migration 0022). While an admin views as one, the query runs on the admin's
  // session, so apply the same rule here — the admin sees exactly what they see.
  const viewer = await getCurrentProfile();
  const ownOnly = viewer?.impersonator && viewer.role === 'sales' ? viewer.id : null;
  const scoped = (q: any) => (ownOnly ? q.eq('assigned_to', ownOnly) : q);

  const [leads, { data: followUps }] = await Promise.all([
    selectResilient(
      scoped(supabase.from('leads').select(`${FULL}, stage, lost_reason, title, value, currency, expected_close_date, labels, won_at, lost_at, archived_at, in_inbox`)).order('created_at', { ascending: false }),
      () => selectResilient(
        scoped(supabase.from('leads').select(`${FULL}, stage, lost_reason`)).order('created_at', { ascending: false }),
        () => selectResilient(
        scoped(supabase.from('leads').select(FULL)).order('created_at', { ascending: false }),
        () => scoped(supabase.from('leads').select(BASE)).order('created_at', { ascending: false }),
        'getEnrichedLeads',
      ).then((data) => ({ data, error: null })),
      'getEnrichedLeads+stage',
      ).then((data) => ({ data, error: null })),
      'getEnrichedLeads+deal',
    ),
    (supabase as any).from('follow_up_tasks').select('lead_id, due_at, type').eq('is_done', false),
  ]);

  // Earliest open follow-up per lead
  const nextByLead = new Map<string, string>();
  const typeByLead = new Map<string, string>();
  for (const f of (followUps ?? []) as { lead_id: string | null; due_at: string; type?: string }[]) {
    if (!f.lead_id) continue;
    const cur = nextByLead.get(f.lead_id);
    if (!cur || new Date(f.due_at).getTime() < new Date(cur).getTime()) { nextByLead.set(f.lead_id, f.due_at); typeByLead.set(f.lead_id, f.type ?? 'task'); }
  }

  const items: LeadListItem[] = (leads ?? []).map((l) => {
    const nextFollowUp = nextByLead.get(l.id) ?? null;
    const { score, reasons } = computePriority({
      status: l.status,
      budget_min: l.budget_min,
      budget_max: l.budget_max,
      ai_score: l.ai_score,
      last_contacted_at: l.last_contacted_at,
      created_at: l.created_at,
    });
    return {
      id: l.id,
      contact_id: l.contact_id,
      full_name: (l as any).contacts?.full_name ?? null,
      email: (l as any).contacts?.email ?? null,
      phone: (l as any).contacts?.phone ?? null,
      status: l.status,
      source: l.source,
      budget_min: l.budget_min,
      budget_max: l.budget_max,
      ai_score: l.ai_score,
      last_contacted_at: l.last_contacted_at,
      created_at: l.created_at,
      owner_id: l.assigned_to,
      owner_name: (l as any).owner?.full_name ?? null,
      assigned_at: (l as any).assigned_at ?? null,
      next_action_date: (l as any).next_action_date ?? null,
      next_action_type: (l as any).next_action_type ?? null,
      next_follow_up: nextFollowUp,
      priority: score,
      priority_reasons: reasons,
      pipeline: (l as any).pipeline ?? null,
      stage_entered_at: (l as any).stage_entered_at ?? null,
      stage: (l as any).stage ?? null,
      lost_reason: (l as any).lost_reason ?? null,
      is_returning: !!(l as any).is_returning,
      title: (l as any).title ?? null,
      value: (l as any).value != null ? Number((l as any).value) : null,
      currency: (l as any).currency ?? 'EUR',
      expected_close_date: (l as any).expected_close_date ?? null,
      labels: (l as any).labels ?? [],
      won_at: (l as any).won_at ?? null,
      lost_at: (l as any).lost_at ?? null,
      archived_at: (l as any).archived_at ?? null,
      in_inbox: !!(l as any).in_inbox,
      next_activity_type: typeByLead.get(l.id) ?? null,
      needs_action: deriveNeedsAction(l.status, l.last_contacted_at, l.created_at, (l as any).next_action_date ?? nextFollowUp),
    };
  });

  items.sort((a, b) => b.priority - a.priority);
  return items;
}
