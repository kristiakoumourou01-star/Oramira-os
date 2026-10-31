import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';

/**
 * Κωδικός μίας χρήσης (2FA) — server half.
 *
 * The codes themselves are Supabase Auth MFA (TOTP: Google Authenticator,
 * Microsoft Authenticator, 1Password …). A session that has passed the code is
 * "aal2"; one that has only the password is "aal1".
 *
 * Trusted devices: after a correct code the person may tick "remember this
 * device". The device keeps a random key in an httpOnly cookie; the database
 * keeps only its SHA-256 (table trusted_devices, migration 0058). While the
 * key is valid that device skips the code, until it expires or is revoked.
 */

export const TRUSTED_COOKIE = 'oramira_td';
export const TRUST_DAYS = 30;

const svc = () => createSupabaseServiceRoleClient() as any;
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

export interface MfaStatus {
  userId: string | null;
  /** aal2 = this session passed the code. */
  current: 'aal1' | 'aal2' | null;
  /** The user has a verified authenticator (so the code is needed). */
  hasFactor: boolean;
}

/** Read from the session token — no network call. */
export async function getMfaStatus(): Promise<MfaStatus> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user?.id ?? null;
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return {
      userId,
      current: (data?.currentLevel as 'aal1' | 'aal2' | null) ?? null,
      hasFactor: data?.nextLevel === 'aal2',
    };
  } catch {
    return { userId: null, current: null, hasFactor: false };
  }
}

/** Verified authenticators of the signed-in user. */
export async function listTotpFactors(): Promise<{ id: string; name: string | null; createdAt: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return (data?.totp ?? []).filter((f) => f.status === 'verified').map((f) => ({ id: f.id, name: f.friendly_name ?? null, createdAt: f.created_at }));
}

/* ------------------------------------------------------------ devices -- */

/** Is this browser a trusted device of `userId`? Bumps last use. Never throws. */
export async function isTrustedDevice(userId: string): Promise<boolean> {
  try {
    const token = (await cookies()).get(TRUSTED_COOKIE)?.value;
    if (!token || token.length < 20) return false;
    const { data } = await svc()
      .from('trusted_devices')
      .select('id, expires_at, revoked_at')
      .eq('user_id', userId)
      .eq('token_hash', sha(token))
      .maybeSingle();
    if (!data || data.revoked_at || Date.parse(data.expires_at) < Date.now()) return false;
    await svc().from('trusted_devices').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
    return true;
  } catch {
    return false;
  }
}

/** Short "Chrome · macOS" style label from the user agent. */
function deviceLabel(ua: string): string {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}

/** Remember this browser for `userId` for TRUST_DAYS. */
export async function trustThisDevice(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null;
  const expires = new Date(Date.now() + TRUST_DAYS * 86_400_000);
  const { error } = await svc().from('trusted_devices').insert({
    user_id: userId, token_hash: sha(token), label: deviceLabel(h.get('user-agent') ?? ''), ip, expires_at: expires.toISOString(),
  });
  if (error) return; // table missing (migration 0058) — just don't remember
  (await cookies()).set(TRUSTED_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires,
  });
}

export interface TrustedDevice { id: string; label: string | null; ip: string | null; createdAt: string; lastUsedAt: string; expiresAt: string; current: boolean }

export async function listTrustedDevices(userId: string): Promise<TrustedDevice[]> {
  const token = (await cookies()).get(TRUSTED_COOKIE)?.value;
  const mine = token ? sha(token) : null;
  const { data, error } = await svc()
    .from('trusted_devices')
    .select('id, token_hash, label, ip, created_at, last_used_at, expires_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('last_used_at', { ascending: false });
  if (error) return [];
  return (data as any[]).map((d) => ({
    id: d.id, label: d.label, ip: d.ip, createdAt: d.created_at, lastUsedAt: d.last_used_at, expiresAt: d.expires_at, current: d.token_hash === mine,
  }));
}

export async function revokeDevices(userId: string, deviceId?: string): Promise<void> {
  let q = svc().from('trusted_devices').update({ revoked_at: new Date().toISOString() }).eq('user_id', userId).is('revoked_at', null);
  if (deviceId) q = q.eq('id', deviceId);
  await q;
}

/** For API routes (no page redirect): has this session passed 2FA where needed? */
export async function mfaSatisfied(trustedAllowed: boolean): Promise<boolean> {
  const st = await getMfaStatus();
  if (!st.hasFactor || st.current === 'aal2') return true;
  return !!st.userId && trustedAllowed && (await isTrustedDevice(st.userId));
}
