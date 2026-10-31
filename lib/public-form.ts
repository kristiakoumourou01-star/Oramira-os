import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { DEFAULT_FIELD_RULES, PUBLIC_FIELD_OPTIONS, mergeFieldRules, type FieldRules } from '@/lib/org-settings-shared';

/**
 * Settings → Tags, ομάδες & πεδία → «Υποχρεωτικά στις φόρμες της ιστοσελίδας».
 * Public routes have no session, so the rule is read with the service client.
 */
async function publicRules(): Promise<FieldRules> {
  try {
    const { data } = await (createSupabaseServiceRoleClient() as any).from('org_settings').select('data').eq('id', 'org').maybeSingle();
    return mergeFieldRules((data as any)?.data?.fields);
  } catch {
    return DEFAULT_FIELD_RULES;
  }
}

const LABEL_EN: Record<string, string> = { name: 'name', phone: 'phone', email: 'email', message: 'message' };

/** Null when the submission has every required field, else a message for the form. */
export async function missingPublicFields(body: any): Promise<string | null> {
  const rules = await publicRules();
  const has = (k: string) => typeof body?.[k] === 'string' && body[k].trim() !== '';
  const missing = rules.public.filter((k) => !has(k));
  if (!missing.length) return null;
  const el = typeof body?.lang === 'string' && body.lang.startsWith('el');
  return el
    ? `Συμπληρώστε: ${missing.map((k) => PUBLIC_FIELD_OPTIONS.find((o) => o.key === k)?.label ?? k).join(', ')}.`
    : `Please fill in your ${missing.map((k) => LABEL_EN[k] ?? k).join(', ')}.`;
}
