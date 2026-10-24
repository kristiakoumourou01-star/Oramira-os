import { requireProfile, homeRouteForRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { effectiveCan, isInternalRole, type Module } from '@/lib/permissions';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';
import { CommandPalette } from '@/components/search/CommandPalette';
import { logout } from '@/app/actions/auth';
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Workflow,
  TrendingUp,
  Settings,
  UserCog,
  Home,
  MessageSquare,
  ClipboardList,
  FileBarChart,
  Map,
  Palette,
  Contact,
  ScrollText,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

/**
 * Shell for every internal (staff) route. Open to all internal roles
 * (admin/sales/management/finance/construction/viewer); the nav and each page
 * are gated per-module by the RBAC matrix (lib/permissions). External roles
 * are redirected to their portal.
 */
interface NavChild { href: string; label: string; module?: Module }
interface NavGroupDef { href: string; label: string; icon: LucideIcon; module?: Module; children?: NavChild[] }
interface NavDef { label?: string; items: NavGroupDef[] }

// Flat, single-level navigation. Each workspace is one item that opens a page
// with its own in-page tabs — no sidebar submenus. Intelligence → Reports
// (Deal Analyzer is reachable from there and via ⌘K).
const NAV: NavDef[] = [
  {
    items: [
      { href: '/dashboard', label: 'My Workspace', icon: LayoutDashboard },
      { href: '/crm/leads', label: 'Sales', icon: Users, module: 'leads' },
      { href: '/crm/customers', label: 'Customers', icon: Contact, module: 'leads' },
      { href: '/acquisitions', label: 'Acquisitions', icon: Map, module: 'acquisitions' },
      { href: '/marketing', label: 'Marketing', icon: Megaphone, module: 'marketing' },
      { href: '/property', label: 'Property', icon: Home, module: 'property' },
      { href: '/financials', label: 'Finance', icon: TrendingUp, module: 'financials' },
      { href: '/hr', label: 'HR', icon: UserCog, module: 'hr' },
      { href: '/operations', label: 'Operations', icon: ClipboardList, module: 'operations' },
      { href: '/reports', label: 'Intelligence', icon: FileBarChart, module: 'financials' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/settings/users', label: 'Users', icon: Users, module: 'users' },
      { href: '/settings/branding', label: 'Branding', icon: Palette, module: 'users' },
      { href: '/settings/audit', label: 'Audit log', icon: ScrollText, module: 'users' },
      { href: '/settings/templates', label: 'Templates', icon: MessageSquare, module: 'automation' },
      { href: '/automation', label: 'Automations', icon: Workflow, module: 'automation' },
      { href: '/settings', label: 'Settings', icon: Settings, module: 'users' },
    ],
  },
];

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  if (!isInternalRole(profile.role)) redirect(homeRouteForRole(profile.role));
  const can = (m?: Module) => !m || effectiveCan(profile.role, profile.moduleAccess, m, 'view');

  const sections = NAV.map((section) => ({
    label: section.label,
    items: section.items
      .map((item) => (item.children ? { ...item, children: item.children.filter((c) => can(c.module ?? item.module)) } : item))
      .filter((item) => (item.children ? item.children.length > 0 : can(item.module))),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="flex">
      <Sidebar
        sections={sections}
        footer={
          <form action={logout}>
            <button type="submit" className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-stone-100/65 hover:bg-white/5 hover:text-stone-100">
              <LogOut size={16} strokeWidth={1.75} />
              Sign out
            </button>
          </form>
        }
      />
      <div className="flex-1">
        {profile.impersonator && <ImpersonationBanner name={profile.fullName} role={profile.role} />}
        <TopBar profile={profile} showSearch />
        <main className="mx-auto max-w-[1600px] px-6 py-5">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
