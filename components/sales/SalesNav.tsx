import { loadSalesCounts } from '@/lib/sales-hub';
import { formatCurrency } from '@/lib/format';
import { HubLinks } from '@/components/ui/HubTabs';

export type LeadHubKey = 'board' | 'list' | 'forecast' | 'activities' | 'insights' | 'agents';

/**
 * Διαχείριση leads: κάρτες κορυφής (όπως τα hubs του FitnessCRM) που αλλάζουν
 * προβολή — Pipeline · Λίστα · Πρόβλεψη · Activities · Insights · Agents.
 */
export async function SalesNav({ active }: { active: LeadHubKey }) {
  const c = await loadSalesCounts();
  return (
    <HubLinks cols={3} active={active} cards={[
      { key: 'board', icon: 'Columns', title: 'Pipeline', value: c.open, sub: `${formatCurrency(c.openValue)} ανοιχτά`, href: '/sales/deals' },
      { key: 'list', icon: 'ScrollText', title: 'Λίστα', value: c.unassigned, sub: 'χωρίς υπεύθυνο', href: '/sales/deals?view=list' },
      { key: 'forecast', icon: 'TrendingUp', title: 'Πρόβλεψη', value: c.withClose, sub: 'με αναμενόμενο κλείσιμο', href: '/sales/deals?view=forecast' },
      { key: 'activities', icon: 'CalendarDays', title: 'Activities', value: c.due, sub: `${c.overdue} εκπρόθεσμα`, href: '/sales/activities' },
      { key: 'insights', icon: 'LineChart', title: 'Insights', value: `${c.rate}%`, sub: 'Win rate 90 ημερών', href: '/sales/insights' },
      { key: 'agents', icon: 'Users', title: 'Agents', value: c.won, sub: 'πωλήσεις 90 ημερών', href: '/sales/agents' },
    ]} />
  );
}
