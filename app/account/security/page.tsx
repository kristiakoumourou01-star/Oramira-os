import { requireProfile, homeRouteForRole } from '@/lib/auth';
import { BrandMark } from '@/components/layout/BrandMark';
import { getOrgSettings } from '@/lib/org-settings';
import { getMfaStatus, listTotpFactors, listTrustedDevices } from '@/lib/mfa';
import { TwoFactorSetup } from '@/components/account/TwoFactorSetup';
import { isInternalRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/** My sign-in security: the authenticator app (2FA) and the devices that skip it. */
export default async function AccountSecurityPage({ searchParams }: { searchParams: { setup?: string } }) {
  const profile = await requireProfile({ allowMfaSetup: true, allowPasswordChange: true });
  const { security } = await getOrgSettings();
  const st = await getMfaStatus();
  const [factors, devices] = await Promise.all([listTotpFactors(), st.userId ? listTrustedDevices(st.userId) : Promise.resolve([])]);
  const mandatory = security.otp && isInternalRole(profile.role);

  return (
    <div className="flex min-h-screen items-start justify-center bg-stone px-4 py-12">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <BrandMark tone="dark" />
          <p className="mt-2 text-sm text-charcoal-600/80">Ασφάλεια σύνδεσης</p>
        </div>
        {searchParams.setup && factors.length === 0 && (
          <p className="rounded-md bg-champagne-50 px-4 py-3 text-sm text-champagne-600">
            Η εταιρεία ζητά κωδικό μίας χρήσης σε κάθε σύνδεση. Ρυθμίστε τον μία φορά (2 λεπτά) για να συνεχίσετε.
          </p>
        )}
        {profile.impersonator ? (
          <p className="panel p-6 text-sm text-charcoal-600">Βλέπετε την εφαρμογή ως άλλος χρήστης. Το 2FA το ρυθμίζει μόνο ο ίδιος.</p>
        ) : (
          <TwoFactorSetup
            factors={factors}
            devices={devices}
            mandatory={mandatory}
            rememberAllowed={security.trustedDevices}
            home={homeRouteForRole(profile.role)}
          />
        )}
      </div>
    </div>
  );
}
