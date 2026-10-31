import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * First-touch to-do engine. Every lead that comes in — manually or from any
 * inbound channel — should land as ONE clear, assigned, urgent task an employee
 * can just work from their to-do list. The `on_lead_created` DB trigger already
 * inserts a generic 24h follow-up; this upgrades that row in place (clear note,
 * speed-to-lead due time, and an owner so it isn't orphaned on nobody's list)
 * rather than duplicating it. If the trigger never ran, it creates the task.
 *
 * Reusable by createLead (internal CRM) and the intake chokepoint (website,
 * Meta, ManyChat, WhatsApp, manual import) so first-touch behaviour is identical
 * however a lead arrives. Best-effort: it must never block lead creation.
 */

const SOURCE_LABEL: Record<string, string> = {
  website: 'website', meta: 'Meta', google: 'Google', organic: 'organic',
  referral: 'referral', whatsapp: 'WhatsApp', instagram: 'Instagram',
  facebook: 'Facebook', walk_in: 'walk-in', other: '',
};

// Speed-to-lead doctrine: a new lead should be contacted within the hour.
const FIRST_TOUCH_WINDOW_MS = 60 * 60 * 1000;

export async function ensureFirstFollowUp(
  supabase: SupabaseClient<any>,
  opts: { leadId: string; contactId: string; assignedTo?: string | null; source?: string | null },
): Promise<void> {
  try {
    // Resolve who owns the to-do: the assigned rep, else the org's default lead
    // owner (column may be absent under schema drift — stay resilient), else
    // leave it for triage.
    let owner = opts.assignedTo ?? null;
    if (!owner) {
      // Η ανάθεση από πηγή / round robin γίνεται στη βάση κατά το insert (0069).
      const { data: l } = await supabase.from('leads').select('assigned_to').eq('id', opts.leadId).maybeSingle();
      owner = (l as any)?.assigned_to ?? null;
    }
    if (!owner) {
      const { data, error } = await supabase.from('organizations').select('default_lead_owner_id').limit(1).maybeSingle();
      owner = !error && data?.default_lead_owner_id ? data.default_lead_owner_id : null;
    }

    const label = SOURCE_LABEL[opts.source ?? ''] ?? '';
    const note = `Make first contact with new ${label ? `${label} ` : ''}lead — call or message within the hour`;
    const dueAt = new Date(Date.now() + FIRST_TOUCH_WINDOW_MS).toISOString();

    // Upgrade the trigger's task in place if present; otherwise create one.
    const { data: existing } = await supabase
      .from('follow_up_tasks')
      .select('id, assigned_to')
      .eq('lead_id', opts.leadId)
      .eq('is_done', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const patch: Record<string, unknown> = { note, due_at: dueAt };
      if (!existing.assigned_to && owner) patch.assigned_to = owner;
      await supabase.from('follow_up_tasks').update(patch).eq('id', existing.id);
    } else {
      await supabase.from('follow_up_tasks').insert({
        lead_id: opts.leadId,
        contact_id: opts.contactId,
        assigned_to: owner,
        due_at: dueAt,
        note,
      });
    }
  } catch {
    /* non-fatal — a missing follow-up must never fail lead creation */
  }
}
