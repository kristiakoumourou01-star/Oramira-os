'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { login, type LoginState } from '@/app/actions/auth';
import { t } from '@/lib/i18n';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60">
      {pending ? t('signingIn') : t('signIn')}
    </button>
  );
}

/** Login form — surfaces auth errors and a pending state (server action). */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState<LoginState | undefined, FormData>(login, undefined);

  return (
    <form action={formAction} className="panel space-y-4 p-8">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label className="eyebrow mb-1.5 block">{t('email')}</label>
        <input name="email" type="email" required className="input" placeholder="you@oramira.com" />
      </div>
      <div>
        <label className="eyebrow mb-1.5 block">{t('password')}</label>
        <input name="password" type="password" required className="input" />
      </div>
      {state?.error && (
        <p className="rounded border border-signal-danger/30 bg-champagne-50 px-3 py-2 text-sm text-signal-danger">{state.error}</p>
      )}
      <SubmitButton />
      <a href="/reset-password" className="block text-center text-xs text-charcoal-600/70 hover:text-forest">
        {t('forgotPassword')}
      </a>
    </form>
  );
}
