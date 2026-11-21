import { getOrgSettingsRaw } from '@/lib/org-settings';
import { pipelineOf, stageOf } from '@/lib/pipeline-shared';

/**
 * Ανάθεση lead + συγχρονισμός με το pipeline. Όταν ένα lead παίρνει υπεύθυνο:
 *  - βγαίνει από τα «Νέα leads» και από το παλιό Inbox (in_inbox = false),
 *  - το στάδιό του στο pipeline ταιριάζει με την κατάστασή του (αν το στάδιο
 *    λείπει ή δείχνει άλλη κατάσταση, παίρνει το πρώτο στάδιο της κατάστασης),
 *  - μένει ιστορικό ανάθεσης και οι ανοιχτές κινήσεις πάνε στον νέο υπεύθυνο.
 * Όλα τα «extra» είναι best-effort: η ίδια η ανάθεση δεν μπλοκάρει ποτέ.
 */
export async function syncAssignedLead(supabase: any, leadId: string, opts: { to: string; by: string; note: string }) {
  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (!lead) return;
  const patch: Record<string, unknown> = {};
  if (lead.in_inbox) patch.in_inbox = false;
  try {
    const { pipelines } = await getOrgSettingsRaw();
    const pipe = pipelineOf(pipelines, lead.pipeline ?? null);
    const st = stageOf(pipe, lead.status, lead.stage ?? null);
    if (st && st.key !== lead.stage) patch.stage = st.key;
    if (!lead.stage_entered_at || lead.in_inbox) patch.stage_entered_at = new Date().toISOString();
  } catch { /* οι ρυθμίσεις δεν είναι κρίσιμες */ }
  if (Object.keys(patch).length) {
    const r = await supabase.from('leads').update(patch).eq('id', leadId);
    if (r.error && 'stage' in patch) { delete patch.stage; await supabase.from('leads').update(patch).eq('id', leadId); }
  }
  try { await supabase.from('lead_assignments').insert({ lead_id: leadId, assigned_to: opts.to, assigned_by: opts.by, note: opts.note }); } catch { /* table may be absent */ }
  try { await supabase.from('follow_up_tasks').update({ assigned_to: opts.to }).eq('lead_id', leadId).eq('is_done', false); } catch { /* non-fatal */ }
}
