'use client';

import { useState } from 'react';
import { acceptInvite } from '@/app/actions/auth';
import { Logo } from '@/components/layout/Logo';

/**
 * Invite acceptance — the only door into the system for buyers, investors,
 * homeowners, and contractors. No "create account" link exists anywhere
 * else; this page only renders successfully if the token is valid and
 * pending (checked server-side in acceptInvite()).
 */
export default function InvitePage({ params }: { params: { token: string } }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setPending(true);
    const result = await acceptInvite(params.token, password);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo tone="dark" />
          <p className="mt-2 text-sm text-charcoal-600/80">You've been invited — set up your access</p>
        </div>
        <form onSubmit={handleSubmit} className="panel space-y-4 p-8">
          <div>
            <label className="eyebrow mb-1.5 block">Create a password</label>
            <input
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="eyebrow mb-1.5 block">Confirm password</label>
            <input
              type="password"
              required
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-signal-danger">{error}</p>}
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? 'Setting up…' : 'Activate my access'}
          </button>
        </form>
      </div>
    </div>
  );
}
