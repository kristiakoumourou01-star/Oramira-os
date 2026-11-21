'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { deliverNotification } from '@/lib/notifications';

type Res = { ok: true } | { ok: false; error: string };
const PRIORITIES = ['low', 'normal', 'high'];
const STATUSES = ['open', 'in_progress', 'resolved'];

/** Νέο ticket υποστήριξης — πηγαίνει στους διαχειριστές (ειδοποίηση στο καμπανάκι). */
export async function createTicket(p: { subject: string; body: string; priority: string }): Promise<Res> {
  const me = await requireProfile();
  const subject = p.subject.trim().slice(0, 200);
  if (!subject) return { ok: false, error: 'Γράψτε θέμα.' };
  const svc = createSupabaseServiceRoleClient() as any;
  const { data, error } = await svc.from('staff_tickets').insert({
    created_by: me.id, subject, body: p.body.trim().slice(0, 5000) || null,
    priority: PRIORITIES.includes(p.priority) ? p.priority : 'normal',
  }).select('id').single();
  if (error) return { ok: false, error: error.message };
  const { data: admins } = await svc.from('profiles').select('id').eq('role', 'admin');
  for (const a of (admins ?? []) as { id: string }[]) {
    if (a.id === me.id) continue;
    await deliverNotification(svc, { userId: a.id, title: `Νέο ticket: ${subject}`, body: me.fullName ?? null, link: `/account?tab=tickets&t=${data.id}` });
  }
  revalidatePath('/account');
  return { ok: true };
}

/** Απάντηση σε ticket (ο δημιουργός ή ο διαχειριστής). */
export async function replyTicket(ticketId: string, body: string): Promise<Res> {
  const me = await requireProfile();
  const text = body.trim().slice(0, 5000);
  if (!text) return { ok: false, error: 'Γράψτε μήνυμα.' };
  const svc = createSupabaseServiceRoleClient() as any;
  const { data: t } = await svc.from('staff_tickets').select('id, created_by, subject, first_response_at, status').eq('id', ticketId).maybeSingle();
  const isAdmin = me.role === 'admin';
  if (!t || (t.created_by !== me.id && !isAdmin)) return { ok: false, error: 'Δεν βρέθηκε.' };
  await svc.from('staff_ticket_replies').insert({ ticket_id: ticketId, author_id: me.id, body: text });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (isAdmin && t.created_by !== me.id) {
    if (!t.first_response_at) patch.first_response_at = new Date().toISOString();
    if (t.status === 'open') patch.status = 'in_progress';
    await deliverNotification(svc, { userId: t.created_by, title: `Απάντηση στο ticket: ${t.subject}`, body: text.slice(0, 140), link: `/account?tab=tickets&t=${ticketId}` });
  }
  await svc.from('staff_tickets').update(patch).eq('id', ticketId);
  revalidatePath('/account');
  return { ok: true };
}

/** Αλλαγή κατάστασης — μόνο ο διαχειριστής (ο δημιουργός μπορεί να το κλείσει ως «Λύθηκε»). */
export async function setTicketStatus(ticketId: string, status: string): Promise<Res> {
  const me = await requireProfile();
  if (!STATUSES.includes(status)) return { ok: false, error: 'Άκυρη κατάσταση.' };
  const svc = createSupabaseServiceRoleClient() as any;
  const { data: t } = await svc.from('staff_tickets').select('created_by').eq('id', ticketId).maybeSingle();
  if (!t || (me.role !== 'admin' && !(t.created_by === me.id && status === 'resolved'))) return { ok: false, error: 'Δεν επιτρέπεται.' };
  await svc.from('staff_tickets').update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', ticketId);
  revalidatePath('/account');
  return { ok: true };
}

/** Προτιμήσεις ειδοποιήσεων του χρήστη (marketing ανά κανάλι). */
export async function saveMyNotificationPrefs(p: { inApp: boolean; email: boolean; push: boolean }): Promise<Res> {
  const me = await requireProfile();
  const svc = createSupabaseServiceRoleClient() as any;
  const { error } = await svc.from('profiles').update({ notification_prefs: { marketingInApp: !!p.inApp, marketingEmail: !!p.email, marketingPush: !!p.push } }).eq('id', me.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/account');
  return { ok: true };
}
