import { NotificationBell } from '@/components/ui/NotificationBell';
import { CommandKButton } from '@/components/search/CommandKButton';
import type { CurrentProfile } from '@/lib/auth';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { t, type TKey } from '@/lib/i18n';

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
export function TopBar({ profile, showSearch = false }: { profile: CurrentProfile; showSearch?: boolean }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-white/80 px-7 shadow-[0_1px_0_rgba(31,77,58,0.08)] backdrop-blur-xl">
      {showSearch ? <CommandKButton /> : <div />}
      <div className="flex items-center gap-3">
        <LocaleSwitcher />
        <NotificationBell userId={profile.id} />
        <div className="flex items-center gap-2.5 border-l border-forest/10 pl-3.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-forest to-[#0E2C20] text-[13px] font-medium text-champagne shadow-[0_2px_8px_rgba(31,77,58,0.2)] ring-1 ring-champagne/20">
            {(profile.fullName ?? '?').charAt(0)}
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-medium text-charcoal">{profile.fullName ?? 'Unnamed'}</p>
            <p className="text-[11px] text-charcoal-600/60">{profile.customRoleId ? profile.roleName : (ROLE_LABEL[profile.role] ? t(`role_${profile.role}` as TKey) : profile.role)}</p>
          </div>
          {!profile.impersonator && (
            <>
            <a href="/account/password" title={t('changePassword')} className="ml-1 text-[11px] text-charcoal-600/60 hover:text-forest">
              {t('password')}
            </a>
            <a href="/account/security" title={t('securityHint')} className="text-[11px] text-charcoal-600/60 hover:text-forest">
              {t('security')}
            </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
