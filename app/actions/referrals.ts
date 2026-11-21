'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type R = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = ['credit', 'percent', 'fixed', 'commission', 'gift'];
const STATUSES = ['pending', 'qualified', 'rewarded', 'rejected'];
const num = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)));
const missing = (m: string) => (/does not exist|schema cache/i.test(m) ? 'Λείπει το migration 0084 στη βάση.' : m);

/** Νέος ή αλλαγή κωδικού σύστασης (αμοιβή και για τους δύο). */
export async function saveReferralCode(id: string | null, input: { referrerId: string | null; code: string; refType: string; refValue: number | null; eeType: string; eeValue: number | null; note?: string }): Promise<R> {
  const me = await requirePermission('marketing', 'edit');
  const code = (input.code ?? '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
  if (!code) return { ok: false, error: 'Γράψτε κωδικό (γράμματα και αριθμοί).' };
  if (!input.referrerId || !UUID.test(input.referrerId)) return { ok: false, error: 'Διαλέξτε ποιος συστήνει.' };
  const row = {
    code, referrer_contact_id: input.referrerId,
    referrer_reward_type: TYPES.includes(input.refType) ? input.refType : 'credit', referrer_reward_value: num(input.refValue),
    referee_reward_type: TYPES.includes(input.eeType) ? input.eeType : 'percent', referee_reward_value: num(input.eeValue),
    note: (input.note ?? '').trim().slice(0, 300) || null,
  };
  const db = (await createSupabaseServerClient()) as any;
  const { error } = id && UUID.test(id) ? await db.from('referral_codes').update(row).eq('id', id) : await db.from('referral_codes').insert({ ...row, created_by: me.id });
  if (error) return { ok: false, error: /duplicate|unique/i.test(error.message) ? 'Ο κωδικός υπάρχει ήδη.' : missing(error.message) };
  revalidatePath('/marketing');
  return { ok: true };
}

export async function setReferralActive(id: string, active: boolean): Promise<R> {
  await requirePermission('marketing', 'edit');
  if (!UUID.test(id)) return { ok: false, error: 'Άκυρος κωδικός.' };
  const db = (await createSupabaseServerClient()) as any;
  const { error } = await db.from('referral_codes').update({ active }).eq('id', id);
  if (error) return { ok: false, error: missing(error.message) };
  revalidatePath('/marketing');
  return { ok: true };
}

/** Καταχώριση εξαργύρωσης: ο νέος πελάτης ήρθε με αυτόν τον κωδικό. */
export async function addRedemption(codeId: string, refereeId: string): Promise<R> {
  const me = await requirePermission('marketing', 'edit');
  if (!UUID.test(codeId) || !UUID.test(refereeId)) return { ok: false, error: 'Διαλέξτε κωδικό και πελάτη.' };
  const db = (await createSupabaseServerClient()) as any;
  const { error } = await db.from('referral_redemptions').insert({ code_id: codeId, referee_contact_id: refereeId, created_by: me.id });
  if (error) return { ok: false, error: missing(error.message) };
  revalidatePath('/marketing');
  return { ok: true };
}

export async function setRedemptionStatus(id: string, status: string): Promise<R> {
  await requirePermission('marketing', 'edit');
  if (!UUID.test(id) || !STATUSES.includes(status)) return { ok: false, error: 'Άκυρη αλλαγή.' };
  const db = (await createSupabaseServerClient()) as any;
  const { error } = await db.from('referral_redemptions').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, error: missing(error.message) };
  revalidatePath('/marketing');
  return { ok: true };
}
