import { createSupabaseServerClient } from '@/lib/supabase/server';
import { INTERNAL_ROLES } from '@/lib/permissions';
import { loadCustomReport } from '@/lib/custom-report';
import { evaluate, type ReportDef } from '@/lib/custom-report-shared';
import { boardStatus, PRESETS, type BoardRow, type CallSource } from '@/lib/tasks-board-shared';

/**
 * Tasks: εργασίες ομάδας + λίστες κλήσεων σε έναν πίνακα (TASK | DEADLINE |
 * PROGRESS | STATUS). Server-only.
 */
export async function loadTaskBoard(me: string, isLead: boolean): Promise<{ rows: BoardRow[]; staff: { id: string; name: string }[]; reports: { id: string; name: string }[]; groups: string[]; callListsReady: boolean }> {
  const db = (await createSupabaseServerClient()) as any;
  const safe = async (p: Promise<any>) => { try { const r = await p; return { data: (r?.data ?? []) as any[], error: r?.error ?? null }; } catch (e: any) { return { data: [] as any[], error: e }; } };
  const [tasks, staffR, lists, items, tpl, grp] = await Promise.all([
    safe(db.from('tasks').select('id, title, description, assigned_to, due_at, is_done, priority, created_by, group_id, list, outcome, created_at, related_entity_type, related_entity_id').order('due_at', { ascending: true, nullsFirst: false }).limit(3000)),
    safe(db.from('profiles').select('id, full_name, role').in('role', INTERNAL_ROLES as unknown as string[]).order('full_name')),
    safe(db.from('call_lists').select('id, title, description, source, assigned_to, created_by, due_at, status, created_at').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1000)),
    safe(db.from('call_list_items').select('list_id, done').limit(50000)),
    safe(db.from('report_templates').select('id, name').eq('kind', 'customers').order('name')),
    safe(db.from('contact_groups').select('name').order('name')),
  ]);
  const staff = staffR.data.map((s) => ({ id: s.id as string, name: (s.full_name ?? '—') as string }));
  const name = (id: string | null) => (id ? staff.find((s) => s.id === id)?.name ?? '—' : null);
  const now = Date.now();
  const rows: BoardRow[] = [];

  // Εργασίες: όσες έχουν group_id γίνονται μία γραμμή με πρόοδο «x από N άτομα».
  const byGroup = new Map<string, any[]>();
  for (const t of tasks.data) { const k = t.group_id ?? `t:${t.id}`; const a = byGroup.get(k) ?? []; a.push(t); byGroup.set(k, a); }
  for (const [k, ts] of byGroup) {
    const t = ts[0];
    const done = ts.filter((x) => x.is_done).length;
    rows.push({
      key: `task:${k}`, kind: 'task', id: t.id, groupId: t.group_id ?? null, title: t.title, description: t.description, list: t.list, source: null,
      priority: t.priority ?? 'normal', deadline: t.due_at, done, total: ts.length, status: boardStatus(done, ts.length, t.due_at, now),
      assigneeIds: ts.map((x) => x.assigned_to).filter(Boolean), assignees: ts.map((x) => name(x.assigned_to) ?? '—'),
      createdBy: t.created_by, creator: name(t.created_by), createdAt: t.created_at,
      href: t.related_entity_type === 'lead' && t.related_entity_id ? `/crm/leads/${t.related_entity_id}` : null,
      members: ts.map((x) => ({ taskId: x.id, userId: x.assigned_to, name: name(x.assigned_to) ?? '—', done: !!x.is_done, outcome: x.outcome ?? null })),
    });
  }

  // Λίστες κλήσεων.
  const count = new Map<string, { n: number; done: number }>();
  for (const i of items.data) { const c = count.get(i.list_id) ?? { n: 0, done: 0 }; c.n++; if (i.done) c.done++; count.set(i.list_id, c); }
  for (const l of lists.data) {
    const c = count.get(l.id) ?? { n: 0, done: 0 };
    rows.push({
      key: `call:${l.id}`, kind: 'call', id: l.id, groupId: null, title: l.title, description: l.description, list: null, source: l.source,
      priority: 'normal', deadline: l.due_at, done: c.done, total: c.n, status: boardStatus(c.done, c.n, l.due_at, now),
      assigneeIds: l.assigned_to ? [l.assigned_to] : [], assignees: l.assigned_to ? [name(l.assigned_to) ?? '—'] : [],
      createdBy: l.created_by, creator: name(l.created_by), createdAt: l.created_at, href: null, members: [],
    });
  }

  const visible = isLead ? rows : rows.filter((r) => r.createdBy === me || r.assigneeIds.includes(me));
  return {
    rows: visible,
    staff,
    reports: tpl.data.map((t) => ({ id: t.id, name: t.name })),
    groups: grp.data.map((g) => g.name as string),
    callListsReady: !lists.error,
  };
}

export interface CallContact { id: string; name: string; phone: string | null; email: string | null }

/** Από πού χτίζεται μια λίστα κλήσεων → επαφές (χωρίς αρχειοθετημένες / «μην επικοινωνείτε»). */
export async function resolveCallSource(src: CallSource): Promise<{ contacts: CallContact[]; label: string }> {
  const db = (await createSupabaseServerClient()) as any;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let ids: string[] = [];
  let label = '';
  if (src.kind === 'ids') {
    ids = src.ids.filter((x) => UUID.test(x));
    label = (src.label ?? '').slice(0, 120) || 'Επιλεγμένοι πελάτες';
  } else if (src.kind === 'report') {
    const c = await loadCustomReport();
    const t = c.templates.find((x) => x.id === src.id);
    if (!t) return { contacts: [], label: '' };
    const def = { match: t.definition?.match === 'any' ? 'any' : 'all', conditions: t.definition?.conditions ?? [], columns: [] } as ReportDef;
    ids = evaluate(c.rows, def, c.fields).map((r) => r.id);
    label = `Αναφορά: ${t.name}`;
  } else if (src.kind === 'group') {
    const { data } = await db.from('contacts').select('id').overlaps('groups', [src.name]).limit(5000);
    ids = ((data ?? []) as any[]).map((c) => c.id);
    label = `Ομάδα: ${src.name}`;
  } else if (src.kind === 'preset') {
    label = PRESETS.find((p) => p[0] === src.key)?.[1] ?? '';
    const closed = '(won,lost,nurture,no_response,retargeting,reactivation)';
    if (src.key === 'stale_leads') {
      const cut = new Date(Date.now() - 14 * 864e5).toISOString();
      const { data } = await db.from('leads').select('contact_id, last_contacted_at').is('deleted_at', null).is('archived_at', null).not('status', 'in', closed).or(`last_contacted_at.is.null,last_contacted_at.lt.${cut}`).limit(5000);
      ids = ((data ?? []) as any[]).map((l) => l.contact_id);
    } else if (src.key === 'new_leads') {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data } = await db.from('leads').select('contact_id').is('deleted_at', null).gte('created_at', since).is('first_response_at', null).limit(5000);
      ids = ((data ?? []) as any[]).map((l) => l.contact_id);
    } else if (src.key === 'overdue_payments') {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: sch }, { data: pay }] = await Promise.all([
        db.from('payment_schedules').select('id, amount, due_date, contracts(buyer_contact_id, status)').lt('due_date', today).limit(10000),
        db.from('payments').select('payment_schedule_id, amount_paid').limit(20000),
      ]);
      const paid = new Map<string, number>();
      for (const p of (pay ?? []) as any[]) if (p.payment_schedule_id) paid.set(p.payment_schedule_id, (paid.get(p.payment_schedule_id) ?? 0) + Number(p.amount_paid ?? 0));
      ids = ((sch ?? []) as any[]).filter((s) => s.contracts?.status !== 'cancelled' && Number(s.amount ?? 0) - (paid.get(s.id) ?? 0) > 0.5).map((s) => s.contracts?.buyer_contact_id);
    } else if (src.key === 'homeowners') {
      const { data } = await db.from('homeowners').select('contact_id').limit(5000);
      ids = ((data ?? []) as any[]).map((h) => h.contact_id);
    }
  }
  ids = Array.from(new Set(ids.filter(Boolean)));
  if (!ids.length) return { contacts: [], label };
  const out: CallContact[] = [];
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await db.from('contacts').select('id, full_name, phone, email, status, anonymized_at').in('id', ids.slice(i, i + 500));
    for (const c of (data ?? []) as any[]) {
      if (c.anonymized_at || c.status === 'archived' || c.status === 'do_not_contact') continue;
      out.push({ id: c.id, name: c.full_name ?? c.email ?? '—', phone: c.phone ?? null, email: c.email ?? null });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'el'));
  return { contacts: out, label };
}
