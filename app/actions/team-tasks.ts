'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notifyUser } from '@/lib/notifications';
import { INTERNAL_ROLES } from '@/lib/permissions';

type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const refresh = () => { revalidatePath('/tasks'); revalidatePath('/dashboard'); };

export interface TaskInput { title: string; description?: string; dueAt?: string | null; priority?: string; list?: string; assignees: string[] | 'all' }

/** Νέα εργασία σε συγκεκριμένα άτομα ή σε όλη την ομάδα (ένα αντίγραφο ανά άτομο, κοινό group_id). */
export async function createTeamTask(input: TaskInput): Promise<R<{ count: number }>> {
  const me = await requireProfile();
  const title = (input.title ?? '').trim().slice(0, 200);
  if (!title) return { ok: false, error: 'Γράψτε τίτλο εργασίας.' };
  const db = (await createSupabaseServerClient()) as any;
  let ids: string[];
  if (input.assignees === 'all') {
    const { data } = await db.from('profiles').select('id').in('role', INTERNAL_ROLES as unknown as string[]);
    ids = ((data ?? []) as any[]).map((p) => p.id);
  } else ids = (input.assignees ?? []).filter((x) => UUID.test(x));
  ids = Array.from(new Set(ids));
  if (!ids.length) return { ok: false, error: 'Διαλέξτε σε ποιον ανατίθεται.' };
  const group = ids.length > 1 ? crypto.randomUUID() : null;
  const due = input.dueAt ? new Date(input.dueAt).toISOString() : null;
  const rows = ids.map((id) => ({
    title, description: (input.description ?? '').trim().slice(0, 4000) || null, assigned_to: id, due_at: due,
    priority: PRIORITIES.includes(input.priority ?? '') ? input.priority : 'normal', created_by: me.id, group_id: group,
    list: (input.list ?? '').trim().slice(0, 60) || null, is_done: false,
  }));
  const { error } = await db.from('tasks').insert(rows);
  if (error) return { ok: false, error: /column/i.test(error.message) ? 'Λείπει το migration 0082 στη βάση.' : error.message };
  const when = due ? ` · προθεσμία ${new Date(due).toLocaleString('el-GR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Nicosia' })}` : '';
  for (const id of ids) if (id !== me.id) await notifyUser({ userId: id, title: 'Νέα εργασία', body: `${title}${when}`, link: '/tasks', event: 'task_assigned' }).catch(() => {});
  refresh();
  return { ok: true, count: ids.length };
}

/** Αλλαγή εργασίας. Με wholeGroup, τίτλος / περιγραφή / προθεσμία / προτεραιότητα / λίστα αλλάζουν σε όλα τα άτομα της ίδιας εργασίας. */
export async function updateTeamTask(id: string, patch: { title?: string; description?: string; dueAt?: string | null; priority?: string; list?: string; assignedTo?: string }, wholeGroup = false): Promise<R> {
  await requireProfile();
  if (!UUID.test(id)) return { ok: false, error: 'Άκυρη εργασία.' };
  const db = (await createSupabaseServerClient()) as any;
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) { const t = patch.title.trim().slice(0, 200); if (!t) return { ok: false, error: 'Γράψτε τίτλο.' }; row.title = t; }
  if (patch.description !== undefined) row.description = patch.description.trim().slice(0, 4000) || null;
  if (patch.dueAt !== undefined) row.due_at = patch.dueAt ? new Date(patch.dueAt).toISOString() : null;
  if (patch.priority !== undefined && PRIORITIES.includes(patch.priority)) row.priority = patch.priority;
  if (patch.list !== undefined) row.list = patch.list.trim().slice(0, 60) || null;
  if (patch.assignedTo !== undefined && UUID.test(patch.assignedTo)) row.assigned_to = patch.assignedTo;
  if (wholeGroup) {
    const { data: t } = await db.from('tasks').select('group_id').eq('id', id).maybeSingle();
    if (t?.group_id) {
      const shared = { ...row };
      delete shared.assigned_to;
      const { error } = await db.from('tasks').update(shared).eq('group_id', t.group_id);
      if (error) return { ok: false, error: error.message };
      refresh();
      return { ok: true };
    }
  }
  const { error } = await db.from('tasks').update(row).eq('id', id);
  if (error) return { ok: false, error: error.message };
  if (row.assigned_to) await notifyUser({ userId: row.assigned_to as string, title: 'Σας ανατέθηκε εργασία', body: String(row.title ?? ''), link: '/tasks', event: 'task_assigned' }).catch(() => {});
  refresh();
  return { ok: true };
}

/** Ολοκλήρωση (με προαιρετικό αποτέλεσμα, π.χ. «Απάντησε — θέλει viewing»). Ειδοποιεί όποιον την ανέθεσε. */
export async function completeTeamTask(id: string, done: boolean, outcome?: string): Promise<R> {
  const me = await requireProfile();
  if (!UUID.test(id)) return { ok: false, error: 'Άκυρη εργασία.' };
  const db = (await createSupabaseServerClient()) as any;
  const { data: t, error } = await db.from('tasks').update({ is_done: done, completed_at: done ? new Date().toISOString() : null, outcome: done ? (outcome ?? '').trim().slice(0, 300) || null : null }).eq('id', id).select('title, created_by').single();
  if (error) return { ok: false, error: error.message };
  if (done && t?.created_by && t.created_by !== me.id) await notifyUser({ userId: t.created_by, title: 'Εργασία ολοκληρώθηκε', body: `${me.fullName ?? 'Κάποιος'}: ${t.title}${outcome ? ` — ${outcome}` : ''}`, link: '/tasks', event: 'task_done' }).catch(() => {});
  refresh();
  return { ok: true };
}

export async function deleteTeamTask(id: string, wholeGroup = false): Promise<R> {
  await requireProfile();
  if (!UUID.test(id)) return { ok: false, error: 'Άκυρη εργασία.' };
  const db = (await createSupabaseServerClient()) as any;
  if (wholeGroup) {
    const { data: t } = await db.from('tasks').select('group_id').eq('id', id).maybeSingle();
    if (t?.group_id) { await db.from('tasks').delete().eq('group_id', t.group_id); refresh(); return { ok: true }; }
  }
  const { error } = await db.from('tasks').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
