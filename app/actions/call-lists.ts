'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notifyUser } from '@/lib/notifications';
import { resolveCallSource } from '@/lib/tasks-board';
import type { CallItem, CallSource } from '@/lib/tasks-board-shared';

type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MISSING = (m: string) => (/does not exist|schema cache/i.test(m) ? 'Λείπει το migration 0105 στη βάση.' : m);
const refresh = () => { revalidatePath('/tasks'); revalidatePath('/reports'); };

/** Πόσες επαφές θα μπουν στη λίστα (πριν τη δημιουργία). */
export async function previewCallList(src: CallSource): Promise<R<{ count: number; withPhone: number; label: string }>> {
  await requireProfile();
  const { contacts, label } = await resolveCallSource(src);
  return { ok: true, count: contacts.length, withPhone: contacts.filter((c) => c.phone).length, label };
}

export interface CallListInput { title: string; description?: string; dueAt?: string | null; assignees: string[]; source: CallSource; onlyWithPhone?: boolean }

/** Νέα λίστα κλήσεων από αναφορά / ομάδα / έτοιμο φίλτρο. Με πολλά άτομα, οι επαφές μοιράζονται ισόποσα. */
export async function createCallList(input: CallListInput): Promise<R<{ lists: number; contacts: number }>> {
  const me = await requireProfile();
  const title = (input.title ?? '').trim().slice(0, 200);
  if (!title) return { ok: false, error: 'Γράψτε τίτλο για τη λίστα.' };
  const people = Array.from(new Set((input.assignees ?? []).filter((x) => UUID.test(x))));
  if (!people.length) return { ok: false, error: 'Διαλέξτε σε ποιον ανατίθεται.' };
  const { contacts: all, label } = await resolveCallSource(input.source);
  const contacts = input.onlyWithPhone ? all.filter((c) => c.phone) : all;
  if (!contacts.length) return { ok: false, error: 'Δεν βρέθηκαν επαφές σε αυτή την πηγή.' };
  const db = (await createSupabaseServerClient()) as any;
  const due = input.dueAt ? new Date(input.dueAt).toISOString() : null;
  const desc = (input.description ?? '').trim().slice(0, 2000) || null;
  let made = 0;
  for (let p = 0; p < people.length; p++) {
    const mine = contacts.filter((_, i) => i % people.length === p);
    if (!mine.length) continue;
    const { data: list, error } = await db.from('call_lists').insert({ title, description: desc, source: label || null, assigned_to: people[p], created_by: me.id, due_at: due }).select('id').single();
    if (error) return { ok: false, error: MISSING(error.message) };
    const rows = mine.map((c, i) => ({ list_id: list.id, contact_id: c.id, name: c.name, phone: c.phone, email: c.email, position: i }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error: e2 } = await db.from('call_list_items').insert(rows.slice(i, i + 500));
      if (e2) return { ok: false, error: MISSING(e2.message) };
    }
    made++;
    if (people[p] !== me.id) await notifyUser({ userId: people[p], title: 'Νέα λίστα κλήσεων', body: `${title} · ${mine.length}`, link: '/tasks', event: 'task_assigned' }).catch(() => {});
  }
  refresh();
  return { ok: true, lists: made, contacts: contacts.length };
}

export async function getCallListItems(listId: string): Promise<R<{ items: CallItem[] }>> {
  await requireProfile();
  if (!UUID.test(listId)) return { ok: false, error: 'Άκυρη λίστα.' };
  const db = (await createSupabaseServerClient()) as any;
  const { data, error } = await db.from('call_list_items').select('id, contact_id, name, phone, email, done, outcome, done_at').eq('list_id', listId).order('position');
  if (error) return { ok: false, error: MISSING(error.message) };
  return { ok: true, items: ((data ?? []) as any[]).map((i) => ({ id: i.id, contactId: i.contact_id, name: i.name ?? '—', phone: i.phone, email: i.email, done: !!i.done, outcome: i.outcome, doneAt: i.done_at })) };
}

/** Σημείωση κλήσης: έγινε / δεν έγινε, με αποτέλεσμα. Η λίστα κλείνει όταν κληθούν όλοι. */
export async function markCallItem(itemId: string, done: boolean, outcome?: string | null): Promise<R> {
  const me = await requireProfile();
  if (!UUID.test(itemId)) return { ok: false, error: 'Άκυρη επαφή.' };
  const db = (await createSupabaseServerClient()) as any;
  const { data: it, error } = await db.from('call_list_items').update({ done, outcome: done ? (outcome ?? '').trim().slice(0, 300) || null : null, done_at: done ? new Date().toISOString() : null, done_by: done ? me.id : null }).eq('id', itemId).select('list_id').single();
  if (error) return { ok: false, error: MISSING(error.message) };
  const { count } = await db.from('call_list_items').select('id', { count: 'exact', head: true }).eq('list_id', it.list_id).eq('done', false);
  const { data: list } = await db.from('call_lists').update({ status: (count ?? 0) === 0 ? 'done' : 'open' }).eq('id', it.list_id).select('title, created_by, status').single();
  if (list?.status === 'done' && list.created_by && list.created_by !== me.id) await notifyUser({ userId: list.created_by, title: 'Λίστα κλήσεων ολοκληρώθηκε', body: `${me.fullName ?? ''}: ${list.title}`, link: '/tasks', event: 'task_done' }).catch(() => {});
  refresh();
  return { ok: true };
}

export async function updateCallList(id: string, patch: { title?: string; dueAt?: string | null; assignedTo?: string }): Promise<R> {
  await requireProfile();
  if (!UUID.test(id)) return { ok: false, error: 'Άκυρη λίστα.' };
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) { const t = patch.title.trim().slice(0, 200); if (!t) return { ok: false, error: 'Γράψτε τίτλο.' }; row.title = t; }
  if (patch.dueAt !== undefined) row.due_at = patch.dueAt ? new Date(patch.dueAt).toISOString() : null;
  if (patch.assignedTo && UUID.test(patch.assignedTo)) row.assigned_to = patch.assignedTo;
  const db = (await createSupabaseServerClient()) as any;
  const { error } = await db.from('call_lists').update(row).eq('id', id);
  if (error) return { ok: false, error: MISSING(error.message) };
  if (row.assigned_to) await notifyUser({ userId: row.assigned_to as string, title: 'Σας ανατέθηκε λίστα κλήσεων', body: String(row.title ?? ''), link: '/tasks', event: 'task_assigned' }).catch(() => {});
  refresh();
  return { ok: true };
}

export async function deleteCallList(id: string): Promise<R> {
  await requireProfile();
  if (!UUID.test(id)) return { ok: false, error: 'Άκυρη λίστα.' };
  const db = (await createSupabaseServerClient()) as any;
  const { error } = await db.from('call_lists').delete().eq('id', id);
  if (error) return { ok: false, error: MISSING(error.message) };
  refresh();
  return { ok: true };
}
