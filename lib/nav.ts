/**
 * The internal navigation — single source of truth, client-safe (no server
 * imports). The layout renders it; Settings → Μενού & διάταξη edits it. Admin
 * changes are stored as overrides on top of these defaults (see
 * lib/org-settings-shared MenuSettings / resolveMenu), so a section added here
 * later still appears for everyone.
 */
import type { Module } from '@/lib/permissions';

export interface NavChild { href: string; label: string; module?: Module }
export interface NavGroupDef { href: string; label: string; icon: string; module?: Module; children?: NavChild[] }
export interface NavDef { label?: string; items: NavGroupDef[] }

// Grouped navigation by product area: each workspace opens and
// lists its own sections underneath (sub-items deep-link the page's in-page
// tabs via ?tab=…). One Settings entry at the bottom holds every setting.
// A child may carry its own module when it lives in another workspace's gate.
export const DEFAULT_NAV: NavDef[] = [
  {
    label: 'Operations',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', module: 'dashboard' },
      { href: '/calendar', label: 'Ημερολόγιο', icon: 'CalendarDays', module: 'calendar' },
      { href: '/command-center', label: 'Command Center', icon: 'Gauge', module: 'operations' },
    ],
  },
  {
    label: 'Sales',
    items: [
      // Leads (νέα, χωρίς υπεύθυνο) · Pipeline (με κάρτες Λίστα · Πρόβλεψη · Activities · Agents) · Follow-ups · Insights — χωρίς υπομενού.
      { href: '/sales/new', label: 'Leads', icon: 'Inbox', module: 'leads' },
      { href: '/sales/deals', label: 'Pipeline', icon: 'TrendingUp', module: 'leads' },
      { href: '/sales/follow-ups', label: 'Follow-ups', icon: 'ListChecks', module: 'followups' },
      { href: '/sales/insights', label: 'Insights', icon: 'LineChart', module: 'leads' },
      { href: '/crm/customers', label: 'Πελάτες', icon: 'Contact', module: 'leads' },
    ],
  },
  {
    label: 'Projects',
    items: [
      // Με τη σειρά της διαδικασίας: οικόπεδο (αξιολόγηση) → ανάλυση → έργο & μονάδες → property management.
      { href: '/acquisitions', label: 'Οικόπεδα', icon: 'Map', module: 'acquisitions' },
      { href: '/deal-analyzer', label: 'Ανάλυση (Deal Analyzer)', icon: 'Calculator', module: 'deals' },
      { href: '/projects', label: 'Έργα & μονάδες', icon: 'Building2', module: 'projects' },
      { href: '/property', label: 'Property Management', icon: 'Home', module: 'property' },
      { href: '/map', label: 'Χάρτης', icon: 'MapPin', module: 'projects' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/financials', label: 'Οικονομικά', icon: 'Wallet', module: 'financials' },
      { href: '/financials/invoices', label: 'Τιμολόγια', icon: 'Receipt', module: 'invoices' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/marketing', label: 'Marketing', icon: 'Megaphone', module: 'marketing' },
      { href: '/automation', label: 'Αυτοματισμοί', icon: 'Zap', module: 'automation' },
      { href: '/reports', label: 'Αναφορές', icon: 'FileBarChart', module: 'reports' },
      { href: '/tasks', label: 'Tasks', icon: 'ListChecks', module: 'tasks' },
      { href: '/benefits', label: 'Benefits', icon: 'Gift', module: 'marketing' },
    ],
  },
  {
    label: 'Team',
    items: [
      { href: '/hr', label: 'Ομάδα & HR', icon: 'UserCog', module: 'hr' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/settings/users', label: 'Staff', icon: 'Users', module: 'users' },
      { href: '/settings/mobile-app', label: 'Mobile app', icon: 'Smartphone', module: 'mobileapp' },
      { href: '/settings', label: 'Settings', icon: 'Settings', module: 'users' },
      { href: '/account', label: 'My account', icon: 'UserCog' },
    ],
  },
];

/** Icon names an admin can pick for a menu entry (rendered via components/layout/nav-icons). */
export const NAV_ICON_NAMES = [
  'LayoutDashboard', 'TrendingUp', 'Contact', 'Building2', 'Map', 'Megaphone', 'Home', 'Wallet',
  'UserCog', 'ClipboardList', 'FileBarChart', 'Settings', 'CalendarDays', 'Users', 'Briefcase',
  'HardHat', 'Hammer', 'KeyRound', 'Landmark', 'LineChart', 'PieChart', 'Target', 'Inbox',
  'MessageSquare', 'Mail', 'Phone', 'FileText', 'FolderOpen', 'Star', 'Zap', 'Globe', 'ShieldCheck', 'Smartphone',
  'Gauge', 'ListChecks', 'MapPin', 'Calculator', 'Receipt', 'Gift', 'Handshake', 'ClipboardCheck',
] as const;

/** Every internal page the menu can open — the allow-list for the start screen. */
export function allNavTargets(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (const section of DEFAULT_NAV) {
    for (const item of section.items) {
      out.push({ value: item.href, label: item.label });
      for (const c of item.children ?? []) {
        if (!out.some((o) => o.value === c.href)) out.push({ value: c.href, label: `${item.label} → ${c.label}` });
      }
    }
  }
  return out;
}
