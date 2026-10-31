import { SettingsShell } from '@/components/admin/SettingsShell';

/** Every /settings page shares the one grouped Settings menu. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>;
}
