import { requireProfile } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';
import { getOrgSettings } from '@/lib/org-settings';
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
  HelpCircle,
} from 'lucide-react';
import { redirect } from 'next/navigation';
import { navLabel, t } from '@/lib/i18n';

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
          { href: '/help', label: 'Help', icon: HelpCircle },
        ],
      },
    ],
    homeowner: [
      {
        items: [
          { href: '/homeowner', label: 'Overview', icon: Home },
          { href: '/homeowner/project', label: 'My Property', icon: Building2 },
          { href: '/homeowner/maintenance', label: 'Maintenance', icon: Wrench },
          { href: '/homeowner/warranty', label: 'Warranty', icon: ShieldCheck },
          { href: '/homeowner/contractor', label: 'Contractor', icon: HardHat },
          { href: '/homeowner/documents', label: 'Home Documents', icon: FileText },
          { href: '/homeowner/history', label: 'Property History', icon: History },
          { href: '/homeowner/notifications', label: 'Notifications', icon: Bell },
          { href: '/help', label: 'Help', icon: HelpCircle },
        ],
      },
    ],
    investor: [
      {
        items: [
          { href: '/investor', label: 'Overview', icon: Home },
          { href: '/help', label: 'Help', icon: HelpCircle },
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
          { href: '/help', label: 'Help', icon: HelpCircle },
        ],
      },
    ],
  };

  const raw = sectionsByRole[profile.role];
  if (!raw) redirect('/login');
  const sections = raw.map((sct: any) => ({ ...sct, items: sct.items.map((it: any) => ({ ...it, label: navLabel(it.href, it.label) })) }));
  const compact = (await getOrgSettings()).layout.sidebarCompact;

  return (
    <div className="flex">
      <Sidebar
        sections={sections}
        compact={compact}
        footer={
          <form action={logout}>
            <button type="submit" title={t('signOut')} className={`flex w-full items-center rounded py-2 text-sm text-stone-100/65 hover:bg-white/5 hover:text-stone-100 ${compact ? 'justify-center px-0' : 'gap-3 px-3'}`}>
              <LogOut size={16} strokeWidth={1.75} />
              {!compact && t('signOut')}
            </button>
          </form>
        }
      />
      <div className="flex-1">
        {profile.impersonator && <ImpersonationBanner name={profile.fullName} role={profile.role} />}
        <TopBar profile={profile} />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
