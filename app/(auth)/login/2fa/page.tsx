import { redirect } from 'next/navigation';
import { BrandMark } from '@/components/layout/BrandMark';
import { TwoFactorForm } from '@/components/auth/TwoFactorForm';
import { getMfaStatus } from '@/lib/mfa';
import { getOrgSettings } from '@/lib/org-settings';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/** Sign-in step 2: the code from the authenticator app. */
export default async function TwoFactorPage({ searchParams }: { searchParams: { next?: string } }) {
  const st = await getMfaStatus();
  if (!st.userId) redirect('/login');
  const next = typeof searchParams.next === 'string' && searchParams.next.startsWith('/') && !searchParams.next.startsWith('//') ? searchParams.next : '/dashboard';
  if (!st.hasFactor || st.current === 'aal2') redirect(next);
  const { security } = await getOrgSettings();

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandMark tone="dark" />
          <p className="mt-2 text-sm text-charcoal-600/80">{t('oneTimeCode')}</p>
        </div>
        <TwoFactorForm next={next} allowRemember={security.trustedDevices} />
      </div>
    </div>
  );
}
