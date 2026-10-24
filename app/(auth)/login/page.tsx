import { LoginForm } from '@/components/auth/LoginForm';
import { BrandMark } from '@/components/layout/BrandMark';

/**
 * Login screen — the brand's first impression for staff and, via the
 * invite flow, for buyers/investors too. Deliberately quiet: a single
 * panel on a warm stone field, no marketing copy, no imagery competing
 * with the wordmark.
 */
export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandMark tone="dark" />
          <p className="mt-2 text-sm text-charcoal-600/80">Sign in to continue</p>
        </div>
        <LoginForm next={searchParams.next} />
      </div>
    </div>
  );
}
