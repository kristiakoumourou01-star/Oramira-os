'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Logo } from '@/components/layout/Logo';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/confirm`,
    });
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo tone="dark" />
          <p className="mt-2 text-sm text-charcoal-600/80">Reset your password</p>
        </div>
        <div className="panel p-8">
          {sent ? (
            <p className="text-sm text-charcoal">
              If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="eyebrow mb-1.5 block">Email</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary w-full">
                Send reset link
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
