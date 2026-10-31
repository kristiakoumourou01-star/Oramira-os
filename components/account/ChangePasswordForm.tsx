'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { changeOwnPassword, type ChangePasswordState } from '@/app/actions/account';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60">
      {pending ? 'Αποθήκευση…' : 'Αποθήκευση κωδικού'}
    </button>
  );
}

export function ChangePasswordForm({ home, forced, rule = 'Τουλάχιστον 8 χαρακτήρες.' }: { home: string; forced: boolean; rule?: string }) {
  const [state, formAction] = useFormState<ChangePasswordState | undefined, FormData>(changeOwnPassword, undefined);

  if (state?.ok) {
    return (
      <div className="panel space-y-4 p-8 text-center">
        <p className="text-sm text-charcoal">Ο κωδικός σας άλλαξε.</p>
        <a href={home} className="btn-primary inline-flex w-full justify-center">Συνέχεια</a>
      </div>
    );
  }

  return (
    <form action={formAction} className="panel space-y-4 p-8">
      <div>
        <label className="eyebrow mb-1.5 block">Νέος κωδικός</label>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
        <p className="mt-1 text-xs text-charcoal-600/60">{rule}</p>
      </div>
      <div>
        <label className="eyebrow mb-1.5 block">Επανάληψη κωδικού</label>
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      {state?.error && (
        <p className="rounded border border-signal-danger/30 bg-champagne-50 px-3 py-2 text-sm text-signal-danger">{state.error}</p>
      )}
      <SubmitButton />
      {!forced && (
        <a href={home} className="block text-center text-xs text-charcoal-600/70 hover:text-forest">Άκυρο</a>
      )}
    </form>
  );
}
