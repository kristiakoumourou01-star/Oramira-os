import { requireProfile } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { logout } from '@/app/actions/auth';
import {
  Home,
  FileText,
  Wrench,
  ShieldCheck,
  Wallet,
  TrendingUp,
  Receipt,
  MessageSquare,
  Building2,
  HardHat,
  KeyRound,
  Bell,
  History,
  CalendarClock,
  LogOut,
} from 'lucide-react';
import { redirect } from 'next/navigation';

/**
 * One shared shell for all four external roles — buyer, homeowner,
 * investor, contractor. Only the nav section differs; this is what keeps
 * the brand identity ("luxury developer OS") consistent across every
 * client-facing surface instead of four visually disconnected portals.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  const sectionsByRole: Record<string, any[]> = {
    buyer: [
      {
        items: [
          { href: '/buyer', label: 'Overview', icon: Home },
          { href: '/buyer/my-unit', label: 'My Unit', icon: Building2 },
          { href: '/buyer/payments', label: 'Payment Center', icon: Wallet },
          { href: '/buyer/construction', label: 'Construction', icon: HardHat },
          { href: '/buyer/documents', label: 'Documents', icon: FileText },
          { href: '/buyer/messages', label: 'Messages', icon: MessageSquare },
          { href: '/buyer/handover', label: 'Handover', icon: KeyRound },
        ],
      },
    ],
    homeowner: [
      {
        items: [
          { href: '/homeowner', label: 'Overview', icon: Home },
          { href: '/homeowner/maintenance', label: 'Maintenance', icon: Wrench },
          { href: '/homeowner/warranty', label: 'Warranty', icon: ShieldCheck },
          { href: '/homeowner/contractor', label: 'Contractor', icon: HardHat },
          { href: '/homeowner/documents', label: 'Home Documents', icon: FileText },
          { href: '/homeowner/history', label: 'Property History', icon: History },
          { href: '/homeowner/notifications', label: 'Notifications', icon: Bell },
        ],
      },
    ],
    investor: [
      {
        items: [
          { href: '/investor', label: 'Overview', icon: Home },
        ],
      },
    ],
    contractor: [
      {
        items: [
          { href: '/contractor', label: 'Assigned Jobs', icon: Wrench },
          { href: '/contractor/schedule', label: 'Schedule', icon: CalendarClock },
          { href: '/contractor/invoices', label: 'Invoices', icon: Receipt },
          { href: '/contractor/performance', label: 'Performance', icon: TrendingUp },
        ],
      },
    ],
  };

  const sections = sectionsByRole[profile.role];
  if (!sections) redirect('/login');

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
        <TopBar profile={profile} />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
