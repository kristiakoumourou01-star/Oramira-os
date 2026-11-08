'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission, requireRole } from '@/lib/auth';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { logActivity } from '@/lib/activity';
import { anonymize, runRetention, retentionPreview, type RetentionPreview } from '@/lib/gdpr';

export type GdprResult = { ok: true; message?: string } | { ok: false; error: string };

/**
 * Right to erasure: anonymize one contact. Needs "Πωλήσεις → Διαγράφει". The
 * database refuses while there is a legal reason to keep the data.
 */
export async function eraseContact(contactId: string, reason: string): Promise<GdprResult> {
  const profile = await requirePermission('leads', 'delete');
  if (!String(reason ?? '').trim()) return { ok: false, error: 'Γράψτε γιατί διαγράφεται (π.χ. «Αίτημα πελάτη με email 12/3»).' };
  const { gdpr } = await getOrgSettingsRaw();
  try {
    await anonymize(contactId, profile.id, 'request', reason, gdpr.retentionDealsYears);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Η διαγραφή απέτυχε.' };
  }
  await logActivity({ entityType: 'contact', entityId: contactId, action: 'gdpr_erased', metadata: { mode: 'request' } });
  revalidatePath(`/crm/${contactId}`);
  revalidatePath('/crm/customers');
  return { ok: true };
}

/** Turn marketing consent on or off for a contact (e.g. they asked by phone). */
export async function setMarketingConsent(contactId: string, on: boolean): Promise<GdprResult> {
  await requirePermission('leads', 'edit');
  const svc = createSupabaseServiceRoleClient() as any;
  const { error } = await svc.from('contacts').update({ marketing_opt_in: on, marketing_opt_in_at: on ? new Date().toISOString() : null }).eq('id', contactId);
  if (error) return { ok: false, error: /column/i.test(error.message) ? 'Χρειάζεται πρώτα η αλλαγή στη βάση (migration 0057).' : error.message };
  if (!on) await svc.from('newsletter_subscribers').update({ unsubscribed_at: new Date().toISOString() }).eq('contact_id', contactId).is('unsubscribed_at', null);
  await logActivity({ entityType: 'contact', entityId: contactId, action: on ? 'marketing_opt_in' : 'marketing_opt_out', metadata: { by: 'staff' } });
  revalidatePath(`/crm/${contactId}`);
  return { ok: true };
}

/** Settings → GDPR: how many leads the current rule would anonymize. */
export async function previewRetention(months: number): Promise<RetentionPreview> {
  await requireRole(['admin']);
  return retentionPreview(Math.min(120, Math.max(6, Math.round(Number(months) || 24))));
}

/** Settings → GDPR: anonymize expired leads now (uses the saved settings). */
export async function runRetentionNow(): Promise<GdprResult> {
  const profile = await requireRole(['admin']);
  const { gdpr } = await getOrgSettingsRaw();
  try {
    const r = await runRetention(profile.id, gdpr);
    await logActivity({ entityType: 'org_settings', entityId: 'org', action: 'gdpr_retention_run', metadata: { processed: r.processed, failed: r.failed } });
    revalidatePath('/settings');
    return { ok: true, message: r.processed ? `Διαγράφηκαν ${r.processed} επαφές.${r.failed ? ` ${r.failed} δεν διαγράφηκαν.` : ''}` : 'Δεν υπήρχε τίποτα για διαγραφή.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Απέτυχε.' };
  }
}
