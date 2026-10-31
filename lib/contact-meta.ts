import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EMPTY_META, readMeta, type ContactMeta } from '@/lib/contact-meta-shared';

/** A contact's tags/groups/fields. Best-effort: before migration 0055 → empty. */
export async function getContactMeta(contactId: string): Promise<ContactMeta> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('contacts').select('tags, groups, custom_fields' as any).eq('id', contactId).maybeSingle();
    if (error || !data) return EMPTY_META;
    return readMeta(data);
  } catch {
    return EMPTY_META;
  }
}
