'use server';

import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getContactGraph, type ContactGraph } from '@/lib/knowledge-graph';

/** 360° relationship map for a contact — powers the knowledge explorer lookup. */
export async function lookupContactGraph(contactId: string): Promise<ContactGraph | null> {
  await requirePermission('financials');
  const supabase = await createSupabaseServerClient();
  return getContactGraph(supabase, contactId);
}
