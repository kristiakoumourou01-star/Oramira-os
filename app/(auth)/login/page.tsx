import { LoginForm } from '@/components/auth/LoginForm';
import { BrandMark } from '@/components/layout/BrandMark';
import { t } from '@/lib/i18n';
import '@/lib/locale-server';

/**
 * Login screen — the brand's first impression for staff and, via the
 * invite flow, for buyers/investors too. Deliberately quiet: a single
 * panel on a warm stone field, no marketing copy, no imagery competing
 * with the wordmark.
 */
export default function LoginPage({ searchParams }: { searchParams: { next?: string; disabled?: string; expired?: string; ip?: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandMark tone="dark" />
          <p className="mt-2 text-sm text-charcoal-600/80">{t('signInToContinue')}</p>
        </div>
        {searchParams.expired && (
          <p className="mb-4 rounded-md bg-champagne-50 px-4 py-2 text-sm text-champagne-600">
            {t('expired')}
          </p>
        )}
        {searchParams.ip && (
          <p className="mb-4 rounded-md bg-signal-danger/10 px-4 py-2 text-sm text-signal-danger">
            {t('ipBlocked')}
          </p>
        )}
        {searchParams.disabled && (
          <p className="mb-4 rounded-md bg-signal-danger/10 px-4 py-2 text-sm text-signal-danger">
            {t('disabled')}
          </p>
        )}
        <LoginForm next={searchParams.next} />
      </div>
    </div>
  );
}
