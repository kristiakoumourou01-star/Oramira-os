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
    items: [
      {
        href: '/dashboard', label: 'Αρχική', icon: 'LayoutDashboard',
        children: [
          { href: '/dashboard', label: 'My Workspace' },
          { href: '/calendar', label: 'Ημερολόγιο' },
          { href: '/command-center', label: 'Command Center', module: 'leads' },
        ],
      },
      {
        href: '/crm/leads', label: 'Πωλήσεις', icon: 'TrendingUp', module: 'leads',
        children: [
          { href: '/crm/leads?tab=inbox', label: 'Lead Management' },
          { href: '/crm/leads?tab=pipeline', label: 'Pipeline' },
          { href: '/crm/leads?tab=followups', label: 'Follow-ups' },
          { href: '/crm/leads?tab=viewings', label: 'Προβολές' },
          { href: '/crm/leads?tab=retargeting', label: 'Retargeting' },
          { href: '/crm/leads?tab=closings', label: 'Κλεισίματα & προμήθειες' },
          { href: '/crm/leads?tab=kpis', label: 'Στατιστικά' },
        ],
      },
      {
        href: '/crm/customers', label: 'Πελάτες', icon: 'Contact', module: 'leads',
        children: [
          { href: '/crm/customers', label: 'Όλες οι επαφές' },
          { href: '/crm/buyers', label: 'Αγοραστές' },
          { href: '/crm/investors', label: 'Επενδυτές' },
          { href: '/property?tab=owners', label: 'Ιδιοκτήτες', module: 'property' },
        ],
      },
      {
        href: '/projects', label: 'Έργα & μονάδες', icon: 'Building2', module: 'projects',
        children: [
          { href: '/projects', label: 'Έργα' },
          { href: '/map', label: 'Χάρτης' },
          { href: '/deal-analyzer', label: 'Deal Analyzer', module: 'deals' },
        ],
      },
      {
        href: '/acquisitions', label: 'Αγορές γης', icon: 'Map', module: 'acquisitions',
        children: [
          { href: '/acquisitions?tab=pipeline', label: 'Pipeline' },
          { href: '/acquisitions?tab=scoring', label: 'Αξιολόγηση γης' },
          { href: '/acquisitions?tab=assembly', label: 'Συνένωση' },
          { href: '/acquisitions?tab=outreach', label: 'Επαφές ιδιοκτητών' },
        ],
      },
      {
        href: '/marketing', label: 'Marketing', icon: 'Megaphone', module: 'marketing',
        children: [
          { href: '/marketing', label: 'Καμπάνιες' },
          { href: '/automation', label: 'Αυτοματισμοί', module: 'automation' },
          { href: '/settings/templates', label: 'Templates', module: 'automation' },
        ],
      },
      {
        href: '/property', label: 'Property Management', icon: 'Home', module: 'property',
        children: [
          { href: '/property?tab=houses', label: 'Ακίνητα' },
          { href: '/property?tab=maintenance', label: 'Συντήρηση' },
          { href: '/property?tab=warranties', label: 'Εγγυήσεις' },
          { href: '/property?tab=documents', label: 'Έγγραφα' },
          { href: '/property?tab=history', label: 'Ιστορικό ιδιοκτησίας' },
        ],
      },
      {
        href: '/financials', label: 'Οικονομικά', icon: 'Wallet', module: 'financials',
        children: [
          { href: '/financials', label: 'Επισκόπηση' },
          { href: '/financials/invoices', label: 'Τιμολόγια' },
        ],
      },
      {
        href: '/hr', label: 'Ομάδα & HR', icon: 'UserCog', module: 'hr',
        children: [
          { href: '/hr?tab=team', label: 'Ομάδα' },
          { href: '/hr?tab=intelligence', label: 'HR Intelligence' },
          { href: '/hr?tab=verification', label: 'Επαλήθευση υπαλλήλου' },
          { href: '/hr?tab=salary', label: 'Μισθοδοσία' },
          { href: '/hr?tab=contracts', label: 'Συμβόλαια' },
          { href: '/hr?tab=payslips', label: 'Payslips' },
          { href: '/hr?tab=leave', label: 'Άδειες' },
          { href: '/hr?tab=benefits', label: 'Παροχές' },
        ],
      },
      { href: '/operations', label: 'Operations', icon: 'ClipboardList', module: 'operations' },
      {
        href: '/reports', label: 'Αναφορές', icon: 'FileBarChart', module: 'financials',
        children: [
          { href: '/reports?tab=board', label: 'Board pack' },
          { href: '/reports?tab=investor', label: 'Investor report' },
          { href: '/reports?tab=strategy', label: 'Strategy' },
          { href: '/reports?tab=knowledge', label: 'Knowledge graph' },
          { href: '/reports?tab=memory', label: 'Executive memory' },
        ],
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/settings', label: 'Settings', icon: 'Settings', module: 'users' },
    ],
  },
];

/** Icon names an admin can pick for a menu entry (rendered via components/layout/nav-icons). */
export const NAV_ICON_NAMES = [
  'LayoutDashboard', 'TrendingUp', 'Contact', 'Building2', 'Map', 'Megaphone', 'Home', 'Wallet',
  'UserCog', 'ClipboardList', 'FileBarChart', 'Settings', 'CalendarDays', 'Users', 'Briefcase',
  'HardHat', 'Hammer', 'KeyRound', 'Landmark', 'LineChart', 'PieChart', 'Target', 'Inbox',
  'MessageSquare', 'Mail', 'Phone', 'FileText', 'FolderOpen', 'Star', 'Zap', 'Globe', 'ShieldCheck',
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
