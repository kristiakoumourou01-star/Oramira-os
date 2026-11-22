import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { sendMessage } from '@/lib/communications';
import { notifyUser } from '@/lib/notifications';
import { formatCurrency } from '@/lib/format';
import { resolveAudience, deliverCampaign, htmlBody } from '@/lib/campaign-send';
import {
  cleanSchedule, cleanTrigger, delayMs, localParts, nextRun, renderAutomation, zonedToUtc,
  type AutoTrigger, type AutoVars,
} from '@/lib/marketing-automations-shared';
import { cleanAudience, type CampaignChannel } from '@/lib/campaigns-shared';

/**
 * Marketing → Δικοί μου αυτοματισμοί: η εργασία που τρέχει κάθε 15 λεπτά.
 *  - «Σε συγκεκριμένη ώρα»: όταν φτάσει η ώρα, φτιάχνει campaign και το στέλνει
 *    με τον ίδιο κώδικα που χρησιμοποιεί το κουμπί «Αποστολή».
 *  - «Όταν συμβεί κάτι»: βρίσκει τα γεγονότα που η ώρα τους (+ καθυστέρηση)
 *    έφτασε και στέλνει στην επαφή του καθενός, μία φορά ανά γεγονός.
 */
type Svc = ReturnType<typeof createSupabaseServiceRoleClient>;
const DAY = 86_400_000;
/** Πόσο πίσω κοιτάμε (αν η εργασία δεν έτρεξε για λίγο, δεν χάνεται τίποτα). */
const LOOKBACK = 2 * DAY;

interface Cand { key: string; contactId: string; vars: AutoVars }

const dmy = (d: Date) => { const p = localParts(d); return `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}`; };
const hhmm = (d: Date) => { const p = localParts(d); return `${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}`; };
const dateAt = (iso: string, time: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); const [hh, mm] = time.split(':').map(Number); return zonedToUtc(y, m, d, hh, mm); };
const isoDay = (d: Date) => new Date(d.getTime()).toISOString().slice(0, 10);

/** Ονόματα έργων, μονάδων και συμβούλων για τις μεταβλητές. */
async function lookups(svc: any, ids: { projects: string[]; units: string[]; agents: string[] }) {
  const uniq = (a: string[]) => Array.from(new Set(a.filter(Boolean)));
  const [p, u, a] = await Promise.all([
    uniq(ids.projects).length ? svc.from('projects').select('id, name').in('id', uniq(ids.projects)) : { data: [] },
    uniq(ids.units).length ? svc.from('units').select('id, unit_number, project_id, project:project_id(name)').in('id', uniq(ids.units)) : { data: [] },
    uniq(ids.agents).length ? svc.from('profiles').select('id, full_name').in('id', uniq(ids.agents)) : { data: [] },
  ]);
  const proj = new Map<string, string>(((p.data ?? []) as any[]).map((x) => [x.id, x.name]));
  const unit = new Map<string, { n: string; project: string }>(((u.data ?? []) as any[]).map((x) => [x.id, { n: x.unit_number, project: x.project?.name ?? '' }]));
  const agent = new Map<string, string>(((a.data ?? []) as any[]).map((x) => [x.id, String(x.full_name ?? '').split(/\s+/)[0] ?? '']));
  return { proj, unit, agent };
}

/** Τα γεγονότα που «ωρίμασαν» στο διάστημα [lower, now]. */
async function candidates(svc: any, t: AutoTrigger, lower: Date, now: Date): Promise<Cand[]> {
  const off = delayMs(t.delay);
  const from = new Date(lower.getTime() - off), to = new Date(now.getTime() - off);
  const inWin = (at: Date) => at.getTime() + off >= lower.getTime() && at.getTime() + off <= now.getTime();
  const time = t.params.time ?? '10:00';
  const out: Cand[] = [];
  const need = { projects: [] as string[], units: [] as string[], agents: [] as string[] };
  const raw: { key: string; contactId: string; at: Date; project?: string; unit?: string; agent?: string; amount?: number | null; when?: Date }[] = [];

  switch (t.event) {
    case 'new_lead':
    case 'lead_unanswered': {
      let q = svc.from('leads').select('id, contact_id, source, created_at, first_response_at, assigned_to, preferred_project_id').gte('created_at', from.toISOString()).lte('created_at', to.toISOString()).limit(2000);
      if (t.event === 'new_lead' && t.params.source) q = q.eq('source', t.params.source);
      if (t.event === 'lead_unanswered') q = q.is('first_response_at', null);
      const { data } = await q;
      for (const l of (data ?? []) as any[]) raw.push({ key: `${t.event}:${l.id}`, contactId: l.contact_id, at: new Date(l.created_at), project: l.preferred_project_id, agent: l.assigned_to });
      break;
    }
    case 'lead_stage': {
      const { data } = await svc.from('leads').select('id, contact_id, stage, status, stage_entered_at, assigned_to, preferred_project_id').gte('stage_entered_at', from.toISOString()).lte('stage_entered_at', to.toISOString()).limit(2000);
      for (const l of (data ?? []) as any[]) {
        if ((l.stage ?? l.status) !== t.params.stage) continue;
        raw.push({ key: `stage:${l.id}:${t.params.stage}:${l.stage_entered_at}`, contactId: l.contact_id, at: new Date(l.stage_entered_at), project: l.preferred_project_id, agent: l.assigned_to });
      }
      break;
    }
    case 'lead_won':
    case 'lead_lost': {
      const status = t.event === 'lead_won' ? 'won' : 'lost';
      const { data } = await svc.from('leads').select('id, contact_id, status, stage_entered_at, updated_at, assigned_to, preferred_project_id').eq('status', status).gte('updated_at', from.toISOString()).limit(2000);
      for (const l of (data ?? []) as any[]) {
        const at = new Date(l.stage_entered_at ?? l.updated_at);
        if (!inWin(at)) continue;
        raw.push({ key: `${status}:${l.id}`, contactId: l.contact_id, at, project: l.preferred_project_id, agent: l.assigned_to });
      }
      break;
    }
    case 'viewing_booked':
    case 'viewing': {
      const col = t.event === 'viewing' ? 'scheduled_at' : 'created_at';
      const { data } = await svc.from('viewings').select('id, contact_id, scheduled_at, created_at, status, project_id, unit_id, agent_id').gte(col, from.toISOString()).lte(col, to.toISOString()).limit(2000);
      for (const v of (data ?? []) as any[]) {
        if (v.status === 'cancelled' || (t.event === 'viewing' && t.delay.dir === 'after' && t.delay.amount > 0 && v.status === 'no_show')) continue;
        // {{date}} / {{time}} = η ώρα του ραντεβού, και για το «Κλείστηκε».
        raw.push({ key: `${t.event}:${v.id}:${t.event === 'viewing' ? v.scheduled_at : ''}`, contactId: v.contact_id, at: new Date(v[col]), when: new Date(v.scheduled_at), project: v.project_id, unit: v.unit_id, agent: v.agent_id });
      }
      break;
    }
    case 'contract_signed': {
      const { data } = await svc.from('contracts').select('id, buyer_contact_id, unit_id, signed_at, status').eq('status', 'signed').gte('signed_at', from.toISOString()).lte('signed_at', to.toISOString()).limit(2000);
      for (const c of (data ?? []) as any[]) raw.push({ key: `contract:${c.id}`, contactId: c.buyer_contact_id, at: new Date(c.signed_at), unit: c.unit_id });
      break;
    }
    case 'reservation': {
      const { data } = await svc.from('reservations').select('id, buyer_contact_id, unit_id, reserved_at, status').gte('reserved_at', from.toISOString()).lte('reserved_at', to.toISOString()).limit(2000);
      for (const r of (data ?? []) as any[]) if (r.status !== 'cancelled') raw.push({ key: `reservation:${r.id}`, contactId: r.buyer_contact_id, at: new Date(r.reserved_at), unit: r.unit_id });
      break;
    }
    case 'handover': {
      const { data } = await svc.from('homeowners').select('id, contact_id, unit_id, moved_in_at').gte('moved_in_at', isoDay(new Date(from.getTime() - DAY))).lte('moved_in_at', isoDay(new Date(to.getTime() + DAY))).limit(2000);
      for (const h of (data ?? []) as any[]) { const at = dateAt(h.moved_in_at, time); if (inWin(at)) raw.push({ key: `handover:${h.id}`, contactId: h.contact_id, at, unit: h.unit_id }); }
      break;
    }
    case 'handover_anniversary':
    case 'birthday': {
      const isB = t.event === 'birthday';
      const { data } = isB
        ? await svc.from('contacts').select('id, date_of_birth').not('date_of_birth', 'is', null).limit(10000)
        : await svc.from('homeowners').select('id, contact_id, unit_id, moved_in_at').not('moved_in_at', 'is', null).limit(10000);
      const years = Array.from(new Set([localParts(from).y, localParts(to).y]));
      for (const r of (data ?? []) as any[]) {
        const iso = String(isB ? r.date_of_birth : r.moved_in_at);
        const [y0, m, d] = iso.slice(0, 10).split('-').map(Number);
        for (const y of years) {
          if (!isB && y <= y0) continue;
          if (m === 2 && d === 29 && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) continue;
          const at = zonedToUtc(y, m, d, ...(time.split(':').map(Number) as [number, number]));
          if (inWin(at)) raw.push({ key: `${t.event}:${r.id}:${y}`, contactId: isB ? r.id : r.contact_id, at, unit: isB ? undefined : r.unit_id });
        }
      }
      break;
    }
    case 'payment_due':
    case 'payment_overdue': {
      const { data } = await svc.from('payment_schedules').select('id, due_date, amount, contract:contract_id(buyer_contact_id, unit_id, status)').gte('due_date', isoDay(new Date(from.getTime() - DAY))).lte('due_date', isoDay(new Date(to.getTime() + DAY))).limit(3000);
      const rows = ((data ?? []) as any[]).filter((s) => s.contract?.buyer_contact_id && s.contract?.status !== 'cancelled');
      const { data: pays } = rows.length ? await svc.from('payments').select('payment_schedule_id').in('payment_schedule_id', rows.map((s) => s.id)) : { data: [] };
      const paid = new Set(((pays ?? []) as any[]).map((p) => p.payment_schedule_id));
      for (const s of rows) {
        if (paid.has(s.id)) continue;
        const at = dateAt(s.due_date, time);
        if (inWin(at)) raw.push({ key: `${t.event}:${s.id}`, contactId: s.contract.buyer_contact_id, at, unit: s.contract.unit_id, amount: Number(s.amount) });
      }
      break;
    }
    case 'no_contact': {
      const days = (t.params.days ?? 30) * DAY;
      const { data } = await svc.from('leads').select('id, contact_id, status, last_contacted_at, assigned_to, preferred_project_id')
        .not('status', 'in', '(won,lost)').not('last_contacted_at', 'is', null)
        .gte('last_contacted_at', new Date(from.getTime() - days).toISOString()).lte('last_contacted_at', new Date(to.getTime() - days).toISOString()).limit(2000);
      for (const l of (data ?? []) as any[]) raw.push({ key: `quiet:${l.id}:${l.last_contacted_at}`, contactId: l.contact_id, at: new Date(new Date(l.last_contacted_at).getTime() + days), project: l.preferred_project_id, agent: l.assigned_to });
      break;
    }
  }

  const fresh = raw.filter((r) => r.contactId && inWin(r.at));
  for (const r of fresh) { if (r.project) need.projects.push(r.project); if (r.unit) need.units.push(r.unit); if (r.agent) need.agents.push(r.agent); }
  const L = await lookups(svc, need);
  for (const r of fresh) {
    const when = r.when ?? r.at;
    const u = r.unit ? L.unit.get(r.unit) : undefined;
    out.push({
      key: r.key, contactId: r.contactId,
      vars: {
        date: dmy(when), time: hhmm(when),
        project: (r.project ? L.proj.get(r.project) : undefined) ?? u?.project ?? '',
        unit: u?.n ?? '', agent: r.agent ? L.agent.get(r.agent) ?? '' : '',
        amount: r.amount != null ? formatCurrency(r.amount) : '',
      },
    });
  }
  return out;
}

/** Στέλνει ένα μήνυμα σε μία επαφή, με τη συγκατάθεση του καναλιού (receive_email / receive_sms / receive_push). */
async function sendToContact(svc: any, a: { id: string; channel: CampaignChannel; subject: string | null; body: string; name: string }, c: any, vars: AutoVars): Promise<'sent' | 'queued' | 'failed' | 'skipped'> {
  if (!c || c.anonymized_at || c.status === 'archived' || c.status === 'do_not_contact') return 'skipped';
  const v = { ...vars, name: c.full_name ?? '' };
  const text = renderAutomation(a.body, v);
  if (a.channel === 'push') {
    if (c.receive_push === false) return 'skipped';
    const { data: prof } = await svc.from('profiles').select('id').eq('contact_id', c.id).maybeSingle();
    if (!prof) return 'skipped';
    try { await notifyUser({ userId: prof.id, title: renderAutomation(a.subject ?? a.name, v), body: text.slice(0, 500), link: '/' }); return 'sent'; } catch { return 'failed'; }
  }
  const consent = a.channel === 'email' ? c.receive_email : c.receive_sms;
  if (!consent) return 'skipped';
  const to = String((a.channel === 'email' ? c.email : c.phone) ?? '').trim();
  if (!to) return 'skipped';
  const res = await sendMessage({ contactId: c.id, channel: a.channel, to, subject: a.channel === 'email' ? renderAutomation(a.subject ?? a.name, v) : null, body: a.channel === 'email' ? htmlBody(text) : text, templateKey: `automation:${a.id}` });
  return res.status === 'sent' ? 'sent' : res.status === 'queued' ? 'queued' : 'failed';
}

async function runEventAutomation(svc: any, a: any, now: Date): Promise<number> {
  const t = cleanTrigger(a.trigger);
  if (!t) return 0;
  const lower = new Date(Math.max(now.getTime() - LOOKBACK, new Date(a.active_since ?? a.created_at).getTime()));
  const cands = await candidates(svc, t, lower, now);
  if (!cands.length) return 0;
  const ids = Array.from(new Set(cands.map((c) => c.contactId)));
  const { data: people } = await svc.from('contacts').select('id, full_name, email, phone, status, anonymized_at, groups, tags, receive_email, receive_sms, receive_push').in('id', ids);
  const byId = new Map(((people ?? []) as any[]).map((p) => [p.id, p]));
  let sent = 0;
  for (const c of cands) {
    const p = byId.get(c.contactId);
    if (!p) continue;
    if (t.filter.group && !(p.groups ?? []).includes(t.filter.group)) continue;
    if (t.filter.tag && !(p.tags ?? []).includes(t.filter.tag)) continue;
    // Πρώτα «κλείνουμε» το γεγονός (unique), ώστε να μη σταλεί ποτέ δύο φορές.
    const { data: claim } = await svc.from('marketing_automation_sends')
      .upsert({ automation_id: a.id, contact_id: c.contactId, record_key: c.key, status: 'pending' }, { onConflict: 'automation_id,record_key', ignoreDuplicates: true })
      .select('id');
    if (!claim?.length) continue;
    const status = await sendToContact(svc, a, p, c.vars);
    await svc.from('marketing_automation_sends').update({ status, sent_at: new Date().toISOString() }).eq('id', claim[0].id);
    if (status === 'sent' || status === 'queued') sent++;
  }
  if (sent) await svc.from('marketing_automations').update({ last_run_at: now.toISOString(), runs: (a.runs ?? 0) + sent }).eq('id', a.id);
  return sent;
}

async function runScheduledAutomation(svc: any, a: any, now: Date): Promise<number> {
  const s = cleanSchedule(a.schedule);
  const next = s ? nextRun(s, now) : null;
  // «Κλείνουμε» την εκτέλεση: μόνο όποιος αλλάξει πρώτος το next_run_at στέλνει.
  const { data: claim } = await svc.from('marketing_automations')
    .update({ next_run_at: next?.toISOString() ?? null, active: !!next, last_run_at: now.toISOString(), runs: (a.runs ?? 0) + 1, updated_at: now.toISOString() })
    .eq('id', a.id).eq('next_run_at', a.next_run_at).select('id');
  if (!claim?.length) return 0;
  const audience = cleanAudience(a.audience, a.channel);
  if (!audience) return 0;
  const { list, noConsent, noAddress } = await resolveAudience(svc, audience, a.channel);
  const { data: camp, error } = await svc.from('marketing_campaigns').insert({
    name: `${a.name} · ${dmy(now)}`.slice(0, 120), channel: a.channel, audience, subject: a.subject, body: a.body, status: 'sending', created_by: a.created_by,
  }).select('id').single();
  if (error || !camp) return 0;
  if (!list.length) { await svc.from('marketing_campaigns').update({ status: 'sent', recipients: 0, skipped: noConsent + noAddress, sent_at: now.toISOString() }).eq('id', camp.id); return 0; }
  const r = await deliverCampaign(svc, { id: camp.id, name: a.name, channel: a.channel, subject: a.subject, body: a.body }, list, noConsent + noAddress);
  return r.sent + r.queued;
}

/** Προγραμματισμένες καμπάνιες (Marketing → Καμπάνιες → Προγραμματισμός) που έφτασε η ώρα τους. */
async function runScheduledCampaigns(svc: any, now: Date): Promise<{ campaigns: number; messages: number }> {
  const { data, error } = await svc.from('marketing_campaigns').select('id, name, channel, audience, subject, body, scheduled_at').eq('status', 'scheduled').lte('scheduled_at', now.toISOString()).limit(50);
  if (error) return { campaigns: 0, messages: 0 }; // χωρίς το migration 0110 δεν υπάρχουν προγραμματισμένες
  let campaigns = 0, messages = 0;
  for (const c of (data ?? []) as any[]) {
    // «Κλείνουμε» την καμπάνια ώστε να μη σταλεί δύο φορές.
    const { data: claim } = await svc.from('marketing_campaigns').update({ status: 'sending' }).eq('id', c.id).eq('status', 'scheduled').select('id');
    if (!claim?.length) continue;
    campaigns++;
    const audience = cleanAudience(c.audience, c.channel);
    const { list, noConsent, noAddress } = audience ? await resolveAudience(svc, audience, c.channel) : { list: [], noConsent: 0, noAddress: 0 };
    if (!list.length) { await svc.from('marketing_campaigns').update({ status: 'sent', recipients: 0, skipped: noConsent + noAddress, sent_at: now.toISOString() }).eq('id', c.id); continue; }
    const r = await deliverCampaign(svc, { id: c.id, name: c.name, channel: c.channel, subject: c.subject, body: c.body ?? '' }, list, noConsent + noAddress);
    messages += r.sent + r.queued;
  }
  return { campaigns, messages };
}

export async function runMarketingAutomations(svc: Svc): Promise<{ processed: number; summary: string; details?: Record<string, unknown> }> {
  const db = svc as any;
  const now = new Date();
  const sc = await runScheduledCampaigns(db, now);
  const { data, error } = await db.from('marketing_automations').select('*').eq('active', true).limit(500);
  if (error) return { processed: sc.messages, summary: /does not exist|schema cache/i.test(error.message) ? 'Λείπει το migration 0109.' : error.message };
  let messages = 0, ran = 0;
  for (const a of (data ?? []) as any[]) {
    try {
      if (a.kind === 'event') { const n = await runEventAutomation(db, a, now); messages += n; if (n) ran++; }
      else if (a.next_run_at && new Date(a.next_run_at).getTime() <= now.getTime()) { messages += await runScheduledAutomation(db, a, now); ran++; }
    } catch { /* ένας αυτοματισμός με πρόβλημα δεν σταματά τους άλλους */ }
  }
  return { processed: messages + sc.messages, summary: `${ran} αυτοματισμοί έτρεξαν, ${messages} μηνύματα · ${sc.campaigns} προγραμματισμένες καμπάνιες, ${sc.messages} μηνύματα.`, details: { active: (data ?? []).length, scheduledCampaigns: sc.campaigns } };
}

