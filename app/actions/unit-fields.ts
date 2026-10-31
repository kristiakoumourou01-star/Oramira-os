'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgSettings } from '@/lib/org-settings';
import { logActivity } from '@/lib/activity';
import { cleanRequirements, cleanValues, fieldsFor, label, type FieldValue, type Requirements } from '@/lib/unit-forms-shared';

type Result = { ok: true } | { ok: false; error: string };
const MISSING = 'Χρειάζεται μια αλλαγή στη βάση (migration 0061).';

/** Save a unit's type and its own fields (Settings → Φόρμες μονάδων). */
export async function saveUnitFields(unitId: string, projectId: string, typeKey: string | null, values: Record<string, FieldValue>): Promise<Result> {
  await requirePermission('projects', 'edit');
  const { unitForms } = await getOrgSettings();
  const type = unitForms.types.find((t) => t.key === typeKey) ?? null;
  const fields = fieldsFor(unitForms, type?.key ?? null);
  const clean = cleanValues(values, fields);
  const missing = fields.filter((f) => f.required && (clean[f.key] === undefined)).map((f) => label(f, 'el'));
  if (missing.length) return { ok: false, error: `Συμπληρώστε: ${missing.join(', ')}.` };
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = { custom_fields: clean };
  if (type) patch.type = type.el;
  const { error } = await supabase.from('units').update(patch as any).eq('id', unitId);
  if (error) return { ok: false, error: /column|schema cache/i.test(error.message) ? MISSING : error.message };
  await logActivity({ entityType: 'unit', entityId: unitId, action: 'unit_fields_updated', metadata: { type: type?.key ?? null } });
  revalidatePath(`/projects/${projectId}/units/${unitId}`);
  return { ok: true };
}

/** What the buyer is looking for, in the matching fields. */
export async function saveLeadRequirements(leadId: string, req: Requirements): Promise<Result> {
  await requirePermission('leads', 'edit');
  const { unitForms } = await getOrgSettings();
  const clean = cleanRequirements(req, unitForms.fields);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('leads').update({ unit_requirements: clean } as any).eq('id', leadId);
  if (error) return { ok: false, error: /column|schema cache/i.test(error.message) ? MISSING : error.message };
  await logActivity({ entityType: 'lead', entityId: leadId, action: 'requirements_updated', metadata: { keys: Object.keys(clean) } });
  revalidatePath(`/crm/leads/${leadId}`);
  return { ok: true };
}

