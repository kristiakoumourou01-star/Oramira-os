import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Οι κρίκοι της ροής «Οικόπεδο → Ανάλυση → Έργο» για ένα οικόπεδο ή μια ανάλυση. Ανθεκτικό σε στήλες που λείπουν. */
export type FlowRef = { id: string; name: string } | null;
export interface Flow { parcel: FlowRef; deal: FlowRef; project: FlowRef }

async function one(q: PromiseLike<{ data: any; error: any }>) { try { const r = await q; return r.error ? null : r.data; } catch { return null; } }

export async function loadFlow(from: { parcelId?: string; dealId?: string }): Promise<Flow> {
  const s = (await createSupabaseServerClient()) as any;
  let parcelId = from.parcelId ?? null;
  let deal: any = null;
  if (from.dealId) deal = await one(s.from('deals').select('id, name, project_id, inputs').eq('id', from.dealId).maybeSingle());
  if (!parcelId && deal?.inputs?.sourceParcelId) parcelId = deal.inputs.sourceParcelId;
  const parcel = parcelId ? await one(s.from('land_parcels').select('id, reference').eq('id', parcelId).maybeSingle()) : null;
  const links = parcelId ? await one(s.from('land_parcels').select('project_id, deal_id').eq('id', parcelId).maybeSingle()) : null;
  if (!deal && parcelId) {
    deal = links?.deal_id ? await one(s.from('deals').select('id, name, project_id').eq('id', links.deal_id).maybeSingle()) : null;
    deal ??= await one(s.from('deals').select('id, name, project_id').eq('inputs->>sourceParcelId', parcelId).order('created_at', { ascending: false }).limit(1).maybeSingle());
  }
  const projectId = deal?.project_id ?? links?.project_id ?? null;
  const project = projectId ? await one(s.from('projects').select('id, name').eq('id', projectId).maybeSingle()) : null;
  return {
    parcel: parcel ? { id: parcel.id, name: parcel.reference } : null,
    deal: deal ? { id: deal.id, name: deal.name } : null,
    project: project ? { id: project.id, name: project.name } : null,
  };
}

/** Για τη λίστα αγορών γης: ποιο οικόπεδο έχει γίνει ήδη έργο. */
export async function parcelProjects(): Promise<Record<string, string>> {
  const s = (await createSupabaseServerClient()) as any;
  const out: Record<string, string> = {};
  const rows = await one(s.from('land_parcels').select('id, project_id').not('project_id', 'is', null));
  for (const r of (rows ?? []) as any[]) out[r.id] = r.project_id;
  const deals = await one(s.from('deals').select('project_id, inputs').not('project_id', 'is', null));
  for (const d of (deals ?? []) as any[]) { const pid = d.inputs?.sourceParcelId; if (pid && !out[pid]) out[pid] = d.project_id; }
  return out;
}
