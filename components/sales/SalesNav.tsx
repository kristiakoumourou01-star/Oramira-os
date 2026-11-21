import { loadSalesCounts } from '@/lib/sales-hub';
import { formatCurrency } from '@/lib/format';
import { HubLinks } from '@/components/ui/HubTabs';

/**
 * Κάρτες κορυφής για όλες τις σελίδες Πωλήσεων (όπως στο FitnessCRM):
 * Leads Inbox · Deals · Activities · Insights, με τους βασικούς αριθμούς.
 */
export async function SalesNav({ active }: { active: 'leads' | 'deals' | 'activities' | 'insights' }) {
  const c = await loadSalesCounts();
  return (
    <HubLinks cols={4} active={active} cards={[
      { key: 'leads', icon: 'Inbox', title: 'Leads Inbox', value: c.inbox, sub: `${c.newToday} νέα σήμερα`, href: '/sales/leads' },
      { key: 'deals', icon: 'TrendingUp', title: 'Deals', value: c.open, sub: `${formatCurrency(c.openValue)} ανοιχτά`, href: '/sales/deals' },
      { key: 'activities', icon: 'ListChecks', title: 'Activities', value: c.due, sub: `${c.overdue} εκπρόθεσμα`, href: '/sales/activities' },
      { key: 'insights', icon: 'LineChart', title: 'Insights', value: `${c.rate}%`, sub: `Win rate 90 ημερών · ${c.won} won`, href: '/sales/insights' },
    ]} />
  );
}
