import { login } from '@/app/actions/auth';
import { Logo } from '@/components/layout/Logo';

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
          <Logo tone="dark" />
          <p className="mt-2 text-sm text-charcoal-600/80">Sign in to continue</p>
        </div>
        <form action={login} className="panel space-y-4 p-8">
          {searchParams.next && (
            <input type="hidden" name="next" value={searchParams.next} />
          )}
          <div>
            <label className="eyebrow mb-1.5 block">Email</label>
            <input name="email" type="email" required className="input" placeholder="you@oramira.com" />
          </div>
          <div>
            <label className="eyebrow mb-1.5 block">Password</label>
            <input name="password" type="password" required className="input" />
          </div>
          <button type="submit" className="btn-primary w-full">
            Sign in
          </button>
          <a href="/reset-password" className="block text-center text-xs text-charcoal-600/70 hover:text-forest">
            Forgot your password?
          </a>
        </form>
      </div>
    </div>
  );
}
