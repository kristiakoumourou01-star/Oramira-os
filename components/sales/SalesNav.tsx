import { getEnrichedLeads } from '@/lib/leads';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/format';
import { dealValue } from '@/lib/leads-shared';
import { HubLinks } from '@/components/ui/HubTabs';

/**
 * Κάρτες κορυφής για όλες τις σελίδες Πωλήσεων (όπως στο FitnessCRM):
 * Leads Inbox · Deals · Activities · Insights, με τους βασικούς αριθμούς.
 */
export async function SalesNav({ active }: { active: 'leads' | 'deals' | 'activities' | 'insights' }) {
  const supabase = (await createSupabaseServerClient()) as any;
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const now = new Date().toISOString();
  const [leads, due, overdue] = await Promise.all([
    getEnrichedLeads(),
    supabase.from('follow_up_tasks').select('id', { count: 'exact', head: true }).eq('is_done', false).lte('due_at', end.toISOString()),
    supabase.from('follow_up_tasks').select('id', { count: 'exact', head: true }).eq('is_done', false).lt('due_at', now),
  ]);
  const inbox = leads.filter((l) => l.in_inbox && !l.archived_at);
  const newToday = inbox.filter((l) => Date.now() - new Date(l.created_at).getTime() < 864e5).length;
  const open = leads.filter((l) => !l.in_inbox && !l.archived_at && !l.won_at && !l.lost_at && !['won', 'lost', 'closed_won', 'closed_lost'].includes(l.status));
  const openValue = open.reduce((s, l) => s + dealValue(l), 0);
  const since = Date.now() - 90 * 864e5;
  const won = leads.filter((l) => l.won_at && new Date(l.won_at).getTime() >= since).length;
  const lost = leads.filter((l) => l.lost_at && new Date(l.lost_at).getTime() >= since).length;
  const rate = won + lost ? Math.round((won / (won + lost)) * 100) : 0;
  return (
    <HubLinks cols={4} active={active} cards={[
      { key: 'leads', icon: 'Inbox', title: 'Leads Inbox', value: inbox.length, sub: `${newToday} νέα σήμερα`, href: '/sales/leads' },
      { key: 'deals', icon: 'TrendingUp', title: 'Deals', value: open.length, sub: `${formatCurrency(openValue)} ανοιχτά`, href: '/sales/deals' },
      { key: 'activities', icon: 'ListChecks', title: 'Activities', value: due.count ?? 0, sub: `${overdue.count ?? 0} εκπρόθεσμα`, href: '/sales/activities' },
      { key: 'insights', icon: 'LineChart', title: 'Insights', value: `${rate}%`, sub: `Win rate 90 ημερών · ${won} won`, href: '/sales/insights' },
    ]} />
  );
}
