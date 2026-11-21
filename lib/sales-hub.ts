import { getEnrichedLeads } from '@/lib/leads';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dealValue } from '@/lib/leads-shared';

/** Οι αριθμοί για τις κάρτες κορυφής των Πωλήσεων. */
export async function loadSalesCounts() {
  const supabase = (await createSupabaseServerClient()) as any;
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const [leads, due, overdue] = await Promise.all([
    getEnrichedLeads(),
    supabase.from('follow_up_tasks').select('id', { count: 'exact', head: true }).eq('is_done', false).lte('due_at', end.toISOString()),
    supabase.from('follow_up_tasks').select('id', { count: 'exact', head: true }).eq('is_done', false).lt('due_at', new Date().toISOString()),
  ]);
  const inbox = leads.filter((l) => l.in_inbox && !l.archived_at);
  const open = leads.filter((l) => !l.in_inbox && !l.archived_at && !l.won_at && !l.lost_at && !['won', 'lost', 'closed_won', 'closed_lost'].includes(l.status));
  const since = Date.now() - 90 * 864e5;
  const won = leads.filter((l) => l.won_at && new Date(l.won_at).getTime() >= since).length;
  const lost = leads.filter((l) => l.lost_at && new Date(l.lost_at).getTime() >= since).length;
  return {
    inbox: inbox.length,
    newToday: inbox.filter((l) => Date.now() - new Date(l.created_at).getTime() < 864e5).length,
    open: open.length,
    openValue: open.reduce((s, l) => s + dealValue(l), 0),
    due: (due.count ?? 0) as number,
    overdue: (overdue.count ?? 0) as number,
    won,
    rate: won + lost ? Math.round((won / (won + lost)) * 100) : 0,
  };
}
