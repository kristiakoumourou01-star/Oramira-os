import { requireProfile, homeRouteForRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { effectiveCan, isInternalRole, type Module } from '@/lib/permissions';
import { getBranding, CONTENT_WIDTH_CLASS } from '@/lib/branding';
import { getOrgSettings } from '@/lib/org-settings';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner';
import { CommandPalette } from '@/components/search/CommandPalette';
import { logout } from '@/app/actions/auth';
import { LogOut } from 'lucide-react';
import { DEFAULT_NAV } from '@/lib/nav';
import { resolveMenu } from '@/lib/org-settings-shared';
import { navIcon } from '@/components/layout/nav-icons';
import { TopMenu } from '@/components/layout/TopMenu';
import { BrandMark } from '@/components/layout/BrandMark';
import { navLabel, t } from '@/lib/i18n';

/**
 * Shell for every internal (staff) route. Open to all internal roles
 * (admin/sales/management/finance/construction/viewer); the nav and each page
 * are gated per-module by the RBAC matrix (lib/permissions). External roles
 * are redirected to their portal.
 */
export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  if (!isInternalRole(profile.role)) redirect(homeRouteForRole(profile.role));
  const [{ contentWidth }, { layout: layoutPrefs, menu }] = await Promise.all([getBranding(), getOrgSettings()]);
  const compact = layoutPrefs.sidebarCompact;
  const can = (m?: Module) => !m || effectiveCan(profile.role, profile.moduleAccess, m, 'view', profile.permissions);

  // The menu as the admin arranged it (Settings → Μενού & διάταξη): order,
  // names, icons, hidden entries and per-role hiding. Permissions always apply
  // on top — the menu can hide things, never grant them.
  const resolved = resolveMenu(menu, DEFAULT_NAV)
    .filter((it) => !it.hidden && !it.hiddenRoles.includes(profile.role))
    .map((it) => ({
      ...it,
      children: it.children.filter((c) => !c.hidden && can(c.module ?? it.module)),
    }))
    .filter((it) => (it.children.length > 0 || can(it.module)) && (it.module ? can(it.module) || it.children.length > 0 : true));

  const toItem = (it: (typeof resolved)[number]) => ({
    href: it.href,
    label: navLabel(it.href, it.label),
    icon: navIcon(it.icon),
    children: it.children.length > 1 ? it.children.map((c) => ({ href: c.href, label: navLabel(c.href, c.label) })) : undefined,
  });
  const sections = [
    { items: resolved.filter((it) => it.section === 0).map(toItem) },
    { label: t('admin'), items: resolved.filter((it) => it.section !== 0).map(toItem) },
  ].filter((sct) => sct.items.length > 0);

  const signOut = (
    <form action={logout}>
      <button type="submit" title={t('signOut')} className={`flex w-full items-center rounded py-2 text-sm text-stone-100/65 hover:bg-white/5 hover:text-stone-100 ${compact && menu.position !== 'top' ? 'justify-center px-0' : 'gap-3 px-3'}`}>
        <LogOut size={16} strokeWidth={1.75} />
        {(!compact || menu.position === 'top') && t('signOut')}
      </button>
    </form>
  );

  const content = (
    <div className="min-w-0 flex-1">
      {profile.impersonator && <ImpersonationBanner name={profile.fullName} role={profile.role} />}
      <TopBar profile={profile} showSearch />
      <main className={`mx-auto px-6 py-5 ${CONTENT_WIDTH_CLASS[contentWidth]}`}>{children}</main>
    </div>
  );

  if (menu.position === 'top') {
    return (
      <div>
        <TopMenu
          sections={sections.map((sct) => ({
            label: sct.label,
            items: sct.items.map((it) => ({ href: it.href, label: it.label, icon: <it.icon size={15} strokeWidth={1.75} />, children: it.children })),
          }))}
          footer={signOut}
          brand={<BrandMark tone="light" compact />}
        />
        {content}
        <CommandPalette />
      </div>
    );
  }

  return (
    <div className={`flex ${menu.position === 'right' ? 'flex-row-reverse' : ''}`}>
      <Sidebar sections={sections} compact={compact} footer={signOut} />
      {content}
      <CommandPalette />
    </div>
  );
}
