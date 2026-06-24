import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computePriority } from '@/lib/priority';

/**
 * Enriched lead model for the sales workflow. One place resolves a lead +
 * contact + owner + next follow-up + computed priority, so the leads list, the
 * "Needs action today" rail, and the lead detail page all agree.
 */
export interface LeadListItem {
  id: string;
  contact_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  source: string;
  budget_min: number | null;
  budget_max: number | null;
  ai_score: number | null;
  last_contacted_at: string | null;
  created_at: string;
  owner_id: string | null;
  owner_name: string | null;
  next_follow_up: string | null;
  priority: number;
  priority_reasons: string[];
  needs_action: boolean;
}

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

  const [{ data: leads }, { data: followUps }] = await Promise.all([
    supabase
      .from('leads')
      .select(
        `id, contact_id, status, source, budget_min, budget_max, ai_score, last_contacted_at, created_at, assigned_to,
         contacts(full_name, email, phone), owner:assigned_to(full_name)`
      )
      .order('created_at', { ascending: false }),
    supabase.from('follow_up_tasks').select('lead_id, due_at').eq('is_done', false),
  ]);

  // Earliest open follow-up per lead
  const nextByLead = new Map<string, string>();
  for (const f of followUps ?? []) {
    if (!f.lead_id) continue;
    const cur = nextByLead.get(f.lead_id);
    if (!cur || new Date(f.due_at).getTime() < new Date(cur).getTime()) nextByLead.set(f.lead_id, f.due_at);
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
      next_follow_up: nextFollowUp,
      priority: score,
      priority_reasons: reasons,
      needs_action: deriveNeedsAction(l.status, l.last_contacted_at, l.created_at, nextFollowUp),
    };
  });

  items.sort((a, b) => b.priority - a.priority);
  return items;
}
