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
      { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
      { href: '/calendar', label: 'Ημερολόγιο', icon: 'CalendarDays' },
      { href: '/command-center', label: 'Command Center', icon: 'Gauge', module: 'operations' },
    ],
  },
  {
    label: 'Sales',
    items: [
      // Διαχείριση leads: Pipeline (με κάρτες Λίστα · Πρόβλεψη · Activities · Insights · Agents), Νέα leads, Follow-ups.
      { href: '/sales/deals', label: 'Διαχείριση leads', icon: 'TrendingUp', module: 'leads', children: [
        { href: '/sales/deals', label: 'Pipeline' },
        { href: '/sales/new', label: 'Νέα leads' },
        { href: '/sales/follow-ups', label: 'Follow-ups' },
      ] },
      { href: '/crm/customers', label: 'Πελάτες', icon: 'Contact', module: 'leads' },
    ],
  },
  {
    label: 'Projects',
    items: [
      { href: '/projects', label: 'Έργα & μονάδες', icon: 'Building2', module: 'projects' },
      { href: '/map', label: 'Χάρτης', icon: 'MapPin', module: 'projects' },
      { href: '/deal-analyzer', label: 'Deal Analyzer', icon: 'Calculator', module: 'deals' },
      { href: '/acquisitions', label: 'Αγορές γης', icon: 'Map', module: 'acquisitions' },
      { href: '/property', label: 'Property Management', icon: 'Home', module: 'property' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/financials', label: 'Οικονομικά', icon: 'Wallet', module: 'financials' },
      { href: '/financials/invoices', label: 'Τιμολόγια', icon: 'Receipt', module: 'financials' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/marketing', label: 'Marketing', icon: 'Megaphone', module: 'marketing' },
      { href: '/automation', label: 'Αυτοματισμοί', icon: 'Zap', module: 'automation' },
      { href: '/reports', label: 'Αναφορές', icon: 'FileBarChart', module: 'financials' },
      { href: '/tasks', label: 'Tasks', icon: 'ListChecks' },
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
      { href: '/settings/mobile-app', label: 'Mobile app', icon: 'Smartphone', module: 'users' },
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
