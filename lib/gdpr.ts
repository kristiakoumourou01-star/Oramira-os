import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { DEFAULT_GDPR, mergeGdpr, type GdprSettings } from '@/lib/org-settings-shared';
import { buildZip, toCsv } from '@/lib/zip';

/**
 * GDPR & δεδομένα — server half. Callers check access first; everything here
 * runs with the service client (public forms have no session, and the
 * erasure / export must see every table).
 */

const svc = () => createSupabaseServiceRoleClient() as any;
const isMissing = (msg?: string) => !!msg && /does not exist|schema cache|Could not find/i.test(msg);

/** GDPR settings for code without a session (public forms, cron). */
export async function getGdprSettingsPublic(): Promise<GdprSettings> {
  try {
    const { data } = await svc().from('org_settings').select('data').eq('id', 'org').maybeSingle();
    return mergeGdpr((data as any)?.data?.gdpr);
  } catch {
    return DEFAULT_GDPR;
  }
}

/** The wording a public form shows (EN or EL). */
export function consentWording(g: GdprSettings, lang: string | null | undefined) {
  const el = (lang ?? '').toLowerCase().startsWith('el');
  return {
    consent: el ? g.consentTextEl : g.consentText,
    marketing: el ? g.marketingTextEl : g.marketingText,
    required: g.requireConsent,
    marketingDefault: g.marketingOptIn,
  };
}

/**
 * Parse the consent fields a public form sends. `consent` / `marketing` may be
 * booleans or "true"/"on". Returns an error when Settings require consent.
 */
export async function readConsent(body: any): Promise<{ ok: true; consent: boolean; marketing: boolean; lang: string | null } | { ok: false; error: string }> {
  const yes = (v: any) => v === true || v === 'true' || v === 'on' || v === 1 || v === '1';
  const g = await getGdprSettingsPublic();
  const consent = yes(body?.consent);
  const lang = typeof body?.lang === 'string' ? body.lang : null;
  if (g.requireConsent && !consent) {
    return { ok: false, error: (lang ?? '').startsWith('el') ? 'Χρειάζεται η συγκατάθεσή σας για να συνεχίσετε.' : 'Please tick the consent box to continue.' };
  }
  return { ok: true, consent, marketing: yes(body?.marketing), lang };
}

/**
 * Store what the person agreed to: the exact text, when and where. Marketing
 * is only ever switched ON here (a later form without the tick is not a
 * withdrawal — that happens from the contact card or an unsubscribe).
 * Never throws: a missing migration just skips the record.
 */
export async function recordConsent(contactId: string, c: { consent: boolean; marketing: boolean; lang: string | null; source: string }) {
  if (!contactId || (!c.consent && !c.marketing)) return;
  try {
    const g = await getGdprSettingsPublic();
    const words = consentWording(g, c.lang);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {};
    if (c.consent) Object.assign(patch, { consent_at: now, consent_source: c.source.slice(0, 60), consent_text: words.consent });
    if (c.marketing) Object.assign(patch, { marketing_opt_in: true, marketing_opt_in_at: now });
    await svc().from('contacts').update(patch).eq('id', contactId);
  } catch { /* consent columns not there yet (migration 0057) */ }
}

/* ------------------------------------------------------------------ export -- */

/** Tables that hold data about one contact, and the column that links them. */
const CONTACT_TABLES: { table: string; key: string; label: string }[] = [
  { table: 'leads', key: 'contact_id', label: 'Leads' },
  { table: 'viewings', key: 'contact_id', label: 'Προβολές' },
  { table: 'contact_communications', key: 'contact_id', label: 'Επικοινωνίες' },
  { table: 'follow_up_tasks', key: 'contact_id', label: 'Εργασίες' },
  { table: 'buyers', key: 'contact_id', label: 'Αγοραστής' },
  { table: 'investors', key: 'contact_id', label: 'Επενδυτής' },
  { table: 'homeowners', key: 'contact_id', label: 'Ιδιοκτήτης' },
  { table: 'reservations', key: 'buyer_contact_id', label: 'Κρατήσεις' },
  { table: 'contracts', key: 'buyer_contact_id', label: 'Συμβόλαια' },
  { table: 'invoices', key: 'contact_id', label: 'Παραστατικά' },
  { table: 'website_submissions', key: 'contact_id', label: 'Φόρμες ιστοσελίδας' },
  { table: 'newsletter_subscribers', key: 'contact_id', label: 'Newsletter' },
  { table: 'contact_relations', key: 'contact_id', label: 'Οικογένεια & συνεργάτες' },
  { table: 'contact_kyc', key: 'contact_id', label: 'Έλεγχος ταυτότητας / AML' },
  { table: 'contact_merges', key: 'kept_id', label: 'Ενοποιημένες διπλές καταχωρήσεις' },
  { table: 'documents', key: 'entity_id', label: 'Έγγραφα' },
];

/** Everything stored about one person — the "right of access" file. */
export async function exportContactData(contactId: string): Promise<Record<string, unknown> | null> {
  const s = svc();
  const { data: contact } = await s.from('contacts').select('*').eq('id', contactId).maybeSingle();
  if (!contact) return null;
  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    note: 'Όλα τα στοιχεία που διατηρεί η εταιρεία για αυτό το πρόσωπο (GDPR, άρθρο 15).',
    contact,
  };
  for (const t of CONTACT_TABLES) {
    const { data, error } = await s.from(t.table).select('*').eq(t.key, contactId);
    if (!error && data?.length) out[t.table] = data;
  }
  return out;
}

/** Tables in the full company export (one CSV each). Missing tables are skipped. */
const EXPORT_TABLES = [
  'contacts', 'leads', 'viewings', 'contact_communications', 'follow_up_tasks', 'buyers', 'investors',
  'homeowners', 'projects', 'units', 'reservations', 'contracts', 'payment_schedules', 'payments',
  'invoices', 'document_series', 'website_submissions', 'newsletter_subscribers', 'calendar_events',
  'tasks', 'maintenance_tickets', 'land_parcels', 'activity_log', 'gdpr_erasures', 'org_settings',
  'contact_relations', 'contact_kyc', 'unit_price_history', 'construction_updates',
  'lead_assignments', 'contact_merges',
];

/** All company data as CSV files in one ZIP. Large tables are read in pages. */
export async function exportAllZip(): Promise<{ zip: Uint8Array; tables: { name: string; rows: number }[] }> {
  const s = svc();
  const files: { name: string; data: string }[] = [];
  const tables: { name: string; rows: number }[] = [];
  for (const t of EXPORT_TABLES) {
    const rows: Record<string, unknown>[] = [];
    let ok = true;
    for (let from = 0; from < 200_000; from += 1000) {
      const { data, error } = await s.from(t).select('*').range(from, from + 999);
      if (error) { ok = false; break; }
      rows.push(...((data ?? []) as Record<string, unknown>[]));
      if (!data || data.length < 1000) break;
    }
    if (!ok) continue;
    files.push({ name: `${t}.csv`, data: toCsv(rows) });
    tables.push({ name: t, rows: rows.length });
  }
  const readme = [
    'Oramira — εξαγωγή δεδομένων',
    `Ημερομηνία: ${new Date().toISOString()}`,
    '',
    'Ένα αρχείο CSV ανά πίνακα (UTF-8). Ανοίγει στο Excel.',
    '',
    ...tables.map((t) => `${t.name}.csv — ${t.rows} γραμμές`),
  ].join('\r\n');
  files.unshift({ name: 'README.txt', data: readme });
  return { zip: buildZip(files), tables };
}

/* --------------------------------------------------------------- erasure -- */

/** Why this contact can't be erased yet (null = it can). */
export async function legalHold(contactId: string): Promise<{ hold: string | null; missing: boolean }> {
  const { gdpr } = await getOrgSettingsRaw();
  const { data, error } = await svc().rpc('gdpr_legal_hold', { p_contact: contactId, p_years: gdpr.retentionDealsYears });
  if (error) return { hold: null, missing: isMissing(error.message) };
  return { hold: (data as string | null) ?? null, missing: false };
}

export async function anonymize(contactId: string, actorId: string | null, mode: 'request' | 'retention', reason: string, years: number) {
  const { error } = await svc().rpc('anonymize_contact', { p_contact: contactId, p_actor: actorId, p_mode: mode, p_reason: reason, p_years: years });
  if (error) throw new Error(isMissing(error.message) ? 'Χρειάζεται πρώτα η αλλαγή στη βάση για το GDPR (migration 0057 — αρχείο supabase/ΕΚΚΡΕΜΕΙ_ΣΤΗ_ΒΑΣΗ.sql).' : error.message);
  // The contact's own files (ID copies, proofs of address…) go too — the legal
  // hold above already stopped this if they still had to be kept.
  const s = svc();
  const { data: docs } = await s.from('documents').select('id, bucket, storage_path').eq('entity_type', 'contact').eq('entity_id', contactId);
  for (const d of (docs ?? []) as { id: string; bucket: string; storage_path: string }[]) {
    await s.storage.from(d.bucket).remove([d.storage_path]);
    await s.from('documents').delete().eq('id', d.id);
  }
}

/* -------------------------------------------------------------- retention -- */

export interface RetentionPreview { count: number; oldest: string | null; missing: boolean; sample: { id: string; name: string; last: string }[] }

export async function retentionPreview(months: number): Promise<RetentionPreview> {
  const s = svc();
  const { data, error } = await s.rpc('gdpr_retention_candidates', { p_months: months, p_limit: 500 });
  if (error) return { count: 0, oldest: null, missing: isMissing(error.message), sample: [] };
  const rows = (data ?? []) as { contact_id: string; last_activity: string }[];
  const ids = rows.slice(0, 8).map((r) => r.contact_id);
  const { data: names } = ids.length ? await s.from('contacts').select('id,full_name,email').in('id', ids) : { data: [] };
  const nm = new Map(((names ?? []) as any[]).map((n) => [n.id, n.full_name || n.email]));
  return {
    count: rows.length,
    oldest: rows[0]?.last_activity ?? null,
    missing: false,
    sample: rows.slice(0, 8).map((r) => ({ id: r.contact_id, name: nm.get(r.contact_id) ?? '—', last: r.last_activity })),
  };
}

/** Anonymize every expired lead (up to 500 per run). */
export async function runRetention(actorId: string | null, g?: GdprSettings): Promise<{ processed: number; failed: number }> {
  const gdpr = g ?? (await getGdprSettingsPublic());
  const { data, error } = await svc().rpc('gdpr_retention_candidates', { p_months: gdpr.retentionLeadsMonths, p_limit: 500 });
  if (error) throw new Error(isMissing(error.message) ? 'Migration 0057 not applied' : error.message);
  let processed = 0;
  let failed = 0;
  for (const r of (data ?? []) as { contact_id: string }[]) {
    try {
      await anonymize(r.contact_id, actorId, 'retention', `Χωρίς κίνηση πάνω από ${gdpr.retentionLeadsMonths} μήνες`, gdpr.retentionDealsYears);
      processed++;
    } catch { failed++; }
  }
  return { processed, failed };
}

/** True while migration 0057 hasn't been run. */
export async function gdprMissing(): Promise<boolean> {
  const { error } = await svc().from('gdpr_erasures').select('id').limit(1);
  return !!error && isMissing(error.message);
}

/** Recent erasures (no personal data — just when, how and by whom). */
export async function recentErasures(limit = 20): Promise<{ id: string; mode: string; reason: string | null; erased_at: string; by: string | null }[]> {
  const s = svc();
  const { data, error } = await s.from('gdpr_erasures').select('id,mode,reason,erased_at,erased_by').order('erased_at', { ascending: false }).limit(limit);
  if (error || !data) return [];
  const ids = Array.from(new Set((data as any[]).map((d) => d.erased_by).filter(Boolean)));
  const { data: ppl } = ids.length ? await s.from('profiles').select('id,full_name').in('id', ids) : { data: [] };
  const nm = new Map(((ppl ?? []) as any[]).map((p) => [p.id, p.full_name]));
  return (data as any[]).map((d) => ({ id: d.id, mode: d.mode, reason: d.reason, erased_at: d.erased_at, by: d.erased_by ? nm.get(d.erased_by) ?? null : null }));
}
