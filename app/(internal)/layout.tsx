import { requireRole } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { logout } from '@/app/actions/auth';
import {
  LayoutDashboard,
  Users,
  Calculator,
  Building2,
  Workflow,
  TrendingUp,
  LogOut,
} from 'lucide-react';

/**
 * Shell for every internal (staff) route: admin, sales, management.
 * Buyers/homeowners/investors/contractors are redirected out of this
 * group by middleware before they ever reach this layout — see
 * middleware.ts — but the role check here is the defense-in-depth layer.
 */
export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['admin', 'sales', 'management']);

  const sections = [
    {
      items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      label: 'Sales',
      items: [
        { href: '/crm/leads', label: 'Leads', icon: Users },
        { href: '/deal-analyzer', label: 'Deal Analyzer', icon: Calculator },
      ],
    },
    {
      label: 'Operations',
      items: [
        { href: '/projects', label: 'Projects', icon: Building2 },
        { href: '/automation', label: 'Automation', icon: Workflow },
      ],
    },
    {
      label: 'Management',
      items: [{ href: '/financials', label: 'Financials', icon: TrendingUp }],
    },
  ];

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
        <TopBar profile={profile} showSearch />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
