'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgSettings } from '@/lib/org-settings';
import { logActivity } from '@/lib/activity';
import { cleanMeta, type ContactMeta } from '@/lib/contact-meta-shared';

export type MetaResult = { ok: true } | { ok: false; error: string };

/** Save a contact's tags, groups and custom fields (needs Sales edit access). */
export async function saveContactMeta(contactId: string, meta: ContactMeta): Promise<MetaResult> {
  await requirePermission('leads', 'edit');
  const { tags: defs } = await getOrgSettings();
  const { meta: clean, missing } = cleanMeta(meta, defs);
  if (missing.length) return { ok: false, error: `Συμπληρώστε τα υποχρεωτικά πεδία: ${missing.join(', ')}.` };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('contacts')
    .update({ tags: clean.tags, groups: clean.groups, custom_fields: clean.fields } as any)
    .eq('id', contactId);
  if (error) {
    if (/column .* does not exist|tags|custom_fields/i.test(error.message)) {
      return { ok: false, error: 'Χρειάζεται μια μικρή αλλαγή στη βάση (migration 0055) για να αποθηκεύονται tags και πεδία.' };
    }
    return { ok: false, error: error.message };
  }
  await logActivity({ entityType: 'contact', entityId: contactId, action: 'contact_meta_updated', metadata: { tags: clean.tags, groups: clean.groups } });
  revalidatePath('/crm/customers');
  return { ok: true };
}
