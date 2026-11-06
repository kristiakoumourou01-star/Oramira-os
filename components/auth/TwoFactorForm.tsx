'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { verifyLoginCode } from '@/app/actions/mfa';
import { t } from '@/lib/i18n';

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60">{pending ? t('checking') : t('continue')}</button>;
}

/** Sign-in step 2 — the 6-digit code, and optionally "remember this device". */
export function TwoFactorForm({ next, allowRemember }: { next: string; allowRemember: boolean }) {
  const [state, action] = useFormState<{ error?: string } | undefined, FormData>(verifyLoginCode, undefined);
  return (
    <form action={action} className="panel space-y-4 p-8">
      <input type="hidden" name="next" value={next} />
      <p className="text-sm text-charcoal-600">{t('codeHelp')}</p>
      <input
        name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus
        className="input text-center font-mono text-2xl tracking-[0.4em]" placeholder="000000"
      />
      {allowRemember && (
        <label className="flex items-center gap-2 text-sm text-charcoal-600">
          <input type="checkbox" name="remember" /> {t('rememberDevice')}
        </label>
      )}
      {state?.error && <p className="rounded border border-signal-danger/30 bg-champagne-50 px-3 py-2 text-sm text-signal-danger">{state.error}</p>}
      <Submit />
      <a href="/auth/signout?reason=manual" className="block text-center text-xs text-charcoal-600/70 hover:text-forest">{t('noPhone')}</a>
    </form>
  );
}
