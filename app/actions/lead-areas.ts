'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';
import { cleanAreas } from '@/lib/areas';

/** The areas a buyer wants — used to match them with units by location. */
export async function setLeadAreas(leadId: string, areas: string[]): Promise<{ ok: true; areas: string[] } | { ok: false; error: string }> {
  await requirePermission('leads', 'edit');
  const clean = cleanAreas(areas);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('leads').update({ preferred_areas: clean } as any).eq('id', leadId);
  if (error) return { ok: false, error: /column|schema cache/i.test(error.message) ? 'Χρειάζεται μια αλλαγή στη βάση (migration 0060).' : error.message };
  await logActivity({ entityType: 'lead', entityId: leadId, action: 'areas_updated', metadata: { areas: clean } });
  revalidatePath(`/crm/leads/${leadId}`);
  return { ok: true, areas: clean };
}
