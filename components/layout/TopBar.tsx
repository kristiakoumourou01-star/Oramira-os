import { NotificationBell } from '@/components/ui/NotificationBell';
import { CommandKButton } from '@/components/search/CommandKButton';
import type { CurrentProfile } from '@/lib/auth';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { ThemeMenu } from '@/components/layout/ThemeMenu';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { Suspense } from 'react';
import { t, type TKey } from '@/lib/i18n';
import { isInternalRole } from '@/lib/permissions';
import type { ReactNode } from 'react';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  sales: 'Sales Agent',
  management: 'Manager',
  finance: 'Finance',
  construction: 'Construction',
  viewer: 'Viewer',
  buyer: 'Buyer',
  homeowner: 'Homeowner',
  investor: 'Investor',
  contractor: 'Contractor',
};

/**
 * Top bar: global search (staff only — search across leads/units/contacts)
 * and the notification bell, present for every role. Quiet by design —
 * no busy toolbar, just the two things every screen actually needs.
 */
export function TopBar({ profile, showSearch = false, start }: { profile: CurrentProfile; showSearch?: boolean; start?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 bg-white/80 px-3 sm:px-7 shadow-[0_1px_0_rgba(31,77,58,0.08)] backdrop-blur-xl">
      <div className="flex min-w-0 items-center">{start}<Suspense fallback={null}><Breadcrumbs /></Suspense></div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {showSearch ? <div className="hidden w-44 sm:block md:w-56 xl:w-80"><CommandKButton /></div> : null}
        <LocaleSwitcher />
        <ThemeMenu />
        <NotificationBell userId={profile.id} />
        <AccountMenu name={profile.fullName ?? 'Unnamed'} internal={isInternalRole(profile.role)}
          role={profile.customRoleId ? (profile.roleName ?? '') : (ROLE_LABEL[profile.role] ? t(`role_${profile.role}` as TKey) : profile.role)} />
      </div>
    </header>
  );
}
