'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { revalidatePath } from 'next/cache';

/**
 * Projects & Units module — project-level Server Actions. Staff-only; RLS
 * (migration 0007, `*_staff_all` policies) is the real boundary, these
 * `requireRole` checks are the defense-in-depth UX layer. Every structural
 * mutation logs to activity_log via the shared chokepoint so a project's
 * history renders the same way every other entity's does.
 */

type StaffGuard = ['admin', 'sales', 'management'];
const STAFF: StaffGuard = ['admin', 'sales', 'management'];

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function createProject(params: {
  name: string;
  location?: string;
  description?: string;
  status?: string;
}) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase.from('organizations').select('id').limit(1).maybeSingle();

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name: params.name,
      slug: `${slugify(params.name)}-${Math.random().toString(36).slice(2, 6)}`,
      location: params.location ?? null,
      status: params.status ?? 'planning',
      // organization_id is nullable; attach the default org when one exists.
      ...(org ? { organization_id: org.id } : {}),
    } as any)
    .select()
    .single();

  if (error) throw error;
  await logActivity({ entityType: 'project', entityId: project.id, action: 'created' });
  revalidatePath('/projects');
  return project;
}

export async function updateProject(params: {
  projectId: string;
  name: string;
  location?: string;
  description?: string;
}) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  await supabase
    .from('projects')
    .update({
      name: params.name,
      location: params.location ?? null,
      description: params.description ?? null,
    })
    .eq('id', params.projectId);
  await logActivity({ entityType: 'project', entityId: params.projectId, action: 'updated' });
  revalidatePath(`/projects/${params.projectId}`);
  revalidatePath('/projects');
}

export async function updateProjectStatus(projectId: string, status: string) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  await supabase.from('projects').update({ status }).eq('id', projectId);
  await logActivity({ entityType: 'project', entityId: projectId, action: 'status_changed', metadata: { to: status } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath('/projects');
}

export async function addBuilding(params: { projectId: string; name: string; floors?: number }) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('buildings')
    .insert({ project_id: params.projectId, name: params.name, floors: params.floors ?? null })
    .select()
    .single();
  if (error) throw error;
  await logActivity({ entityType: 'project', entityId: params.projectId, action: 'building_added', metadata: { name: params.name } });
  revalidatePath(`/projects/${params.projectId}`);
  return data;
}

export async function addPhase(params: {
  projectId: string;
  name: string;
  buildingId?: string;
  sequence?: number;
}) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('project_phases')
    .insert({
      project_id: params.projectId,
      building_id: params.buildingId ?? null,
      name: params.name,
      sequence: params.sequence ?? 1,
    })
    .select()
    .single();
  if (error) throw error;
  await logActivity({ entityType: 'project', entityId: params.projectId, action: 'phase_added', metadata: { name: params.name } });
  revalidatePath(`/projects/${params.projectId}`);
  return data;
}

export async function addMilestone(params: {
  projectId: string;
  milestoneType: 'permits' | 'excavation' | 'structure' | 'mep' | 'finishes' | 'delivery';
  phaseId?: string;
  plannedStart?: string;
  plannedEnd?: string;
  notes?: string;
}) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('project_milestones')
    .insert({
      project_id: params.projectId,
      phase_id: params.phaseId ?? null,
      milestone_type: params.milestoneType,
      planned_start: params.plannedStart ?? null,
      planned_end: params.plannedEnd ?? null,
      notes: params.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  await logActivity({ entityType: 'project', entityId: params.projectId, action: 'milestone_added', metadata: { type: params.milestoneType } });
  revalidatePath(`/projects/${params.projectId}`);
  return data;
}

export async function updateMilestoneStatus(
  milestoneId: string,
  projectId: string,
  status: 'not_started' | 'in_progress' | 'delayed' | 'complete'
) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  // Stamp actuals as the stage moves — the trigger on_milestone_status_changed
  // (migration 0006) handles the activity-log entry + pg_notify on its own.
  const patch: Record<string, unknown> = { status };
  if (status === 'in_progress') patch.actual_start = new Date().toISOString();
  if (status === 'complete') patch.actual_end = new Date().toISOString();
  await supabase.from('project_milestones').update(patch).eq('id', milestoneId);
  revalidatePath(`/projects/${projectId}`);
}

/** Read-only signal from the suggestion engine — staff still decide. */
export async function getSuggestedContractors(trade: string, projectId: string) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('suggest_contractors', { p_trade: trade, p_project_id: projectId });
  if (error) throw error;
  return data ?? [];
}

export async function assignContractor(params: { projectId: string; contractorId: string; trade?: string }) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('contractor_project_assignments')
    .upsert(
      { project_id: params.projectId, contractor_id: params.contractorId, trade: params.trade ?? null },
      { onConflict: 'contractor_id,project_id' }
    );
  if (error) throw error;
  await logActivity({ entityType: 'project', entityId: params.projectId, action: 'contractor_assigned', metadata: { contractorId: params.contractorId } });
  revalidatePath(`/projects/${params.projectId}`);
}

export async function removeContractorAssignment(assignmentId: string, projectId: string) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  await supabase.from('contractor_project_assignments').delete().eq('id', assignmentId);
  await logActivity({ entityType: 'project', entityId: projectId, action: 'contractor_unassigned' });
  revalidatePath(`/projects/${projectId}`);
}
