import { requireProfile, homeRouteForRole } from '@/lib/auth';
import { BrandMark } from '@/components/layout/BrandMark';
import { ChangePasswordForm } from '@/components/account/ChangePasswordForm';
import { getOrgSettings } from '@/lib/org-settings';

/**
 * Change password. Every signed-in user can reach it (staff and portal users).
 * Users whose admin created the account with a temporary password are sent
 * here on first sign-in and can't use the rest of the app until they change it.
 */
export default async function ChangePasswordPage() {
  const profile = await requireProfile({ allowPasswordChange: true });
  const home = homeRouteForRole(profile.role);
  const { security } = await getOrgSettings();
  const rule = `Τουλάχιστον ${Math.max(8, security.pwLength)} χαρακτήρες${security.pwSymbols ? ', με αριθμό και σύμβολο' : ''}.`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandMark tone="dark" />
          <p className="mt-2 text-sm text-charcoal-600/80">
            {profile.passwordExpired
              ? 'Ο κωδικός σας έληξε. Ορίστε νέο για να συνεχίσετε'
              : profile.mustChangePassword
              ? 'Ορίστε τον δικό σας κωδικό για να συνεχίσετε'
              : 'Αλλαγή κωδικού'}
          </p>
        </div>
        {profile.impersonator ? (
          <p className="panel p-6 text-sm text-charcoal-600">
            Βλέπετε την εφαρμογή ως άλλος χρήστης. Τον κωδικό του τον αλλάζει μόνο ο ίδιος, ή εσείς από το Settings → Users.
          </p>
        ) : (
          <ChangePasswordForm home={home} forced={profile.mustChangePassword || profile.passwordExpired} rule={rule} />
        )}
      </div>
    </div>
  );
}
