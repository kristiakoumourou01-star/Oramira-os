/**
 * Marketing → Δικοί μου αυτοματισμοί — client-safe τύποι, κατάλογος γεγονότων,
 * υπολογισμός επόμενης εκτέλεσης (ώρα Κύπρου) και περιγραφή «με λόγια».
 */
import { cleanAudience, type CampaignAudience, type CampaignChannel } from '@/lib/campaigns-shared';

export const TZ = 'Europe/Nicosia';

/* ── Χρονοδιάγραμμα ─────────────────────────────────────────────────────── */

export type ScheduleKind = 'once' | 'daily' | 'weekly' | 'monthly';
export interface AutoSchedule {
  kind: ScheduleKind;
  /** Μία φορά: YYYY-MM-DD. */
  date?: string;
  /** HH:MM, ώρα Κύπρου. */
  time: string;
  /** Κάθε εβδομάδα: 0 = Κυριακή … 6 = Σάββατο. */
  weekdays?: number[];
  /** Κάθε μήνα: 1–28. */
  day?: number;
  /** Προαιρετική τελευταία μέρα (YYYY-MM-DD) για τα επαναλαμβανόμενα. */
  until?: string | null;
}

/* ── Γεγονότα ───────────────────────────────────────────────────────────── */

export type CategoryKey = 'leads' | 'sales' | 'viewings' | 'clients' | 'payments' | 'special';
export type EventKey =
  | 'new_lead' | 'lead_unanswered'
  | 'lead_stage' | 'reservation' | 'contract_signed' | 'lead_won' | 'lead_lost'
  | 'viewing_booked' | 'viewing'
  | 'handover' | 'handover_anniversary' | 'no_contact'
  | 'payment_due' | 'payment_overdue'
  | 'birthday';

export type DelayUnit = 'minutes' | 'hours' | 'days';
export interface AutoDelay { amount: number; unit: DelayUnit; dir: 'after' | 'before' }
export interface AutoTrigger {
  event: EventKey;
  /** source (νέο lead), stage (αλλαγή σταδίου), days (χωρίς επικοινωνία), time (ώρα αποστολής για γεγονότα με ημερομηνία). */
  params: { source?: string; stage?: string; days?: number; time?: string };
  delay: AutoDelay;
  /** Μόνο επαφές σε αυτή την ομάδα / με αυτό το tag (προαιρετικό). */
  filter: { group?: string; tag?: string };
}

export interface EventDef {
  key: EventKey; category: CategoryKey; label: string; hint: string;
  /** Το γεγονός έχει ημερομηνία στο μέλλον → επιτρέπεται «πριν». */
  before?: boolean;
  /** Μόνο ημερομηνία (όχι ώρα) → ρωτάμε ώρα αποστολής. */
  dateOnly?: boolean;
  /** Σε ποιο «τι» αναφέρεται, για τις μεταβλητές. */
  vars: string[];
}

export const EVENTS: EventDef[] = [
  { key: 'new_lead', category: 'leads', label: 'Νέο lead', hint: 'Μόλις έρθει νέο lead (προαιρετικά μόνο από μία πηγή).', vars: ['project', 'agent'] },
  { key: 'lead_unanswered', category: 'leads', label: 'Lead χωρίς απάντηση', hint: 'Το lead δεν έχει απαντηθεί ακόμη από την ομάδα.', vars: ['project', 'agent'] },
  { key: 'lead_stage', category: 'sales', label: 'Αλλαγή σταδίου', hint: 'Το lead μπήκε σε συγκεκριμένο στάδιο της πώλησης.', vars: ['project', 'agent'] },
  { key: 'reservation', category: 'sales', label: 'Κράτηση μονάδας', hint: 'Ο πελάτης έκανε κράτηση μονάδας.', vars: ['project', 'unit', 'date'] },
  { key: 'contract_signed', category: 'sales', label: 'Υπογραφή συμβολαίου', hint: 'Υπογράφηκε το συμβόλαιο αγοράς.', vars: ['project', 'unit', 'date'] },
  { key: 'lead_won', category: 'sales', label: 'Κερδισμένο lead', hint: 'Η πώληση έκλεισε (Won).', vars: ['project', 'agent'] },
  { key: 'lead_lost', category: 'sales', label: 'Χαμένο lead', hint: 'Το lead σημειώθηκε ως χαμένο (Lost).', vars: ['project', 'agent'] },
  { key: 'viewing_booked', category: 'viewings', label: 'Κλείστηκε ραντεβού / ξενάγηση', hint: 'Μόλις κλειστεί ραντεβού ή ξενάγηση.', vars: ['date', 'time', 'project', 'unit', 'agent'] },
  { key: 'viewing', category: 'viewings', label: 'Ώρα ραντεβού / ξενάγησης', hint: 'Πριν (υπενθύμιση) ή μετά (ευχαριστώ) την ώρα του ραντεβού.', before: true, vars: ['date', 'time', 'project', 'unit', 'agent'] },
  { key: 'handover', category: 'clients', label: 'Παράδοση σπιτιού', hint: 'Τη μέρα που ο ιδιοκτήτης παραλαμβάνει το σπίτι.', before: true, dateOnly: true, vars: ['date', 'project', 'unit'] },
  { key: 'handover_anniversary', category: 'clients', label: 'Επέτειος παράδοσης', hint: 'Κάθε χρόνο, την ίδια μέρα με την παράδοση.', before: true, dateOnly: true, vars: ['date', 'project', 'unit'] },
  { key: 'no_contact', category: 'clients', label: 'Χωρίς επικοινωνία', hint: 'Κανένα τηλεφώνημα ή μήνυμα για τόσες μέρες (ανοιχτά leads).', vars: ['agent'] },
  { key: 'payment_due', category: 'payments', label: 'Δόση πλησιάζει', hint: 'Πριν τη μέρα λήξης μιας απλήρωτης δόσης.', before: true, dateOnly: true, vars: ['date', 'amount', 'project', 'unit'] },
  { key: 'payment_overdue', category: 'payments', label: 'Δόση καθυστέρησε', hint: 'Η δόση έληξε και δεν έχει πληρωθεί.', dateOnly: true, vars: ['date', 'amount', 'project', 'unit'] },
  { key: 'birthday', category: 'special', label: 'Γενέθλια πελάτη', hint: 'Τη μέρα των γενεθλίων του πελάτη.', before: true, dateOnly: true, vars: [] },
];
export const EVENT_BY_KEY = Object.fromEntries(EVENTS.map((e) => [e.key, e])) as Record<EventKey, EventDef>;

export interface CategoryDef { key: CategoryKey; title: string; sub: string }
export const CATEGORIES: CategoryDef[] = [
  { key: 'leads', title: 'Νέα leads', sub: 'Καλωσόρισμα, follow-up, πηγή, χωρίς απάντηση' },
  { key: 'sales', title: 'Πωλήσεις', sub: 'Στάδιο, κράτηση, συμβόλαιο, κερδισμένο / χαμένο' },
  { key: 'viewings', title: 'Ραντεβού & ξεναγήσεις', sub: 'Επιβεβαίωση, υπενθύμιση, ευχαριστώ' },
  { key: 'clients', title: 'Πελάτες & ιδιοκτήτες', sub: 'Παράδοση, επέτειος, χωρίς επικοινωνία' },
  { key: 'payments', title: 'Πληρωμές', sub: 'Δόση πλησιάζει, δόση καθυστέρησε' },
  { key: 'special', title: 'Ειδικές μέρες & ενημερώσεις', sub: 'Γενέθλια, γιορτές, προγραμματισμένα μηνύματα' },
];

/** Μεταβλητές που γράφονται στο κείμενο. */
export const VARIABLES: { key: string; label: string }[] = [
  { key: 'first_name', label: 'Μικρό όνομα' },
  { key: 'name', label: 'Ονοματεπώνυμο' },
  { key: 'date', label: 'Ημερομηνία' },
  { key: 'time', label: 'Ώρα' },
  { key: 'project', label: 'Έργο' },
  { key: 'unit', label: 'Μονάδα' },
  { key: 'amount', label: 'Ποσό' },
  { key: 'agent', label: 'Σύμβουλος' },
];

export type AutomationKind = 'schedule' | 'event';
export interface AutomationRow {
  id: string; name: string; kind: AutomationKind; channel: CampaignChannel;
  audience: CampaignAudience | null; trigger: AutoTrigger | null; schedule: AutoSchedule | null;
  subject: string | null; body: string; active: boolean;
  nextRunAt: string | null; lastRunAt: string | null; runs: number; createdAt: string;
}
export interface AutomationInput {
  id?: string; name: string; kind: AutomationKind; channel: CampaignChannel;
  audience?: unknown; trigger?: unknown; schedule?: unknown; subject?: string; body: string;
}

export function categoryOf(a: { kind: AutomationKind; trigger: AutoTrigger | null }): CategoryKey {
  if (a.kind === 'schedule' || !a.trigger) return 'special';
  return EVENT_BY_KEY[a.trigger.event]?.category ?? 'special';
}

/* ── Καθαρισμός εισόδου ─────────────────────────────────────────────────── */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const time = (v: unknown, d = '10:00') => (typeof v === 'string' && TIME.test(v) ? v : d);

export function cleanSchedule(v: unknown): AutoSchedule | null {
  const x = (v ?? {}) as any;
  const kind: ScheduleKind | null = (['once', 'daily', 'weekly', 'monthly'] as const).find((k) => k === x.kind) ?? null;
  if (!kind) return null;
  const s: AutoSchedule = { kind, time: time(x.time, '09:00') };
  if (kind === 'once') { if (typeof x.date !== 'string' || !DATE.test(x.date)) return null; s.date = x.date; return s; }
  if (kind === 'weekly') {
    const w = Array.isArray(x.weekdays) ? Array.from(new Set(x.weekdays.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6))) as number[] : [];
    if (!w.length) return null;
    s.weekdays = w.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  }
  if (kind === 'monthly') s.day = Math.max(1, Math.min(28, Math.round(Number(x.day) || 1)));
  s.until = typeof x.until === 'string' && DATE.test(x.until) ? x.until : null;
  return s;
}

export function cleanTrigger(v: unknown): AutoTrigger | null {
  const x = (v ?? {}) as any;
  const def = EVENTS.find((e) => e.key === x.event);
  if (!def) return null;
  const p = (x.params ?? {}) as any;
  const d = (x.delay ?? {}) as any;
  const f = (x.filter ?? {}) as any;
  const unit: DelayUnit = (['minutes', 'hours', 'days'] as const).find((u) => u === d.unit) ?? 'hours';
  const max = unit === 'minutes' ? 59 * 24 : unit === 'hours' ? 24 * 30 : 365;
  const params: AutoTrigger['params'] = {};
  if (def.key === 'new_lead' && typeof p.source === 'string' && p.source.trim()) params.source = p.source.trim().slice(0, 40);
  if (def.key === 'lead_stage') { if (typeof p.stage !== 'string' || !p.stage.trim()) return null; params.stage = p.stage.trim().slice(0, 60); }
  if (def.key === 'no_contact') params.days = Math.max(1, Math.min(365, Math.round(Number(p.days) || 30)));
  if (def.dateOnly) params.time = time(p.time, '10:00');
  return {
    event: def.key,
    params,
    delay: { amount: def.key === 'no_contact' ? 0 : Math.max(0, Math.min(max, Math.round(Number(d.amount) || 0))), unit, dir: def.before && d.dir === 'before' ? 'before' : 'after' },
    filter: {
      ...(typeof f.group === 'string' && f.group.trim() ? { group: f.group.trim().slice(0, 80) } : {}),
      ...(typeof f.tag === 'string' && f.tag.trim() ? { tag: f.tag.trim().slice(0, 60) } : {}),
    },
  };
}

export function cleanAutomation(input: AutomationInput): { ok: true; value: Omit<AutomationRow, 'id' | 'active' | 'nextRunAt' | 'lastRunAt' | 'runs' | 'createdAt'> } | { ok: false; error: string } {
  const channel: CampaignChannel = (['sms', 'whatsapp', 'push'] as const).find((c) => c === input.channel) ?? 'email';
  const name = (input.name ?? '').trim().slice(0, 120);
  const body = (input.body ?? '').trim().slice(0, channel === 'sms' ? 1000 : 20000);
  const subject = (input.subject ?? '').trim().slice(0, 200) || null;
  if (!name) return { ok: false, error: 'Γράψτε όνομα αυτοματισμού.' };
  if (!body) return { ok: false, error: 'Γράψτε το μήνυμα.' };
  if (channel === 'email' && !subject) return { ok: false, error: 'Γράψτε θέμα για το email.' };
  if (input.kind === 'event') {
    const trigger = cleanTrigger(input.trigger);
    if (!trigger) return { ok: false, error: 'Διαλέξτε πότε στέλνεται.' };
    return { ok: true, value: { name, kind: 'event', channel, audience: null, trigger, schedule: null, subject, body } };
  }
  const schedule = cleanSchedule(input.schedule);
  if (!schedule) return { ok: false, error: 'Συμπληρώστε ημερομηνία / μέρες και ώρα.' };
  if (schedule.kind === 'once') return { ok: false, error: 'Για μήνυμα μία φορά φτιάξτε καμπάνια (Καμπάνιες → Προγραμματισμός).' };
  const audience = cleanAudience(input.audience, channel);
  if (!audience) return { ok: false, error: 'Διαλέξτε σε ποιους στέλνεται.' };
  return { ok: true, value: { name, kind: 'schedule', channel, audience, trigger: null, schedule, subject, body } };
}

/* ── Ώρα Κύπρου ─────────────────────────────────────────────────────────── */

const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Τοπικά μέρη (Κύπρος) μιας στιγμής. */
export function localParts(d: Date): { y: number; m: number; d: number; hh: number; mm: number } {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: Number(p.hour), mm: Number(p.minute) };
}

/** Τοπική ώρα Κύπρου → στιγμή UTC (σωστά και στις αλλαγές θερινής ώρας). */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number): Date {
  const want = Date.UTC(y, m - 1, d, hh, mm);
  let t = want;
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(t));
    const diff = want - Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
    if (diff === 0) break;
    t += diff;
  }
  return new Date(t);
}

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const hm = (t: string) => t.split(':').map(Number) as [number, number];

/** Η πρώτη εκτέλεση αυστηρά μετά από `after` — null όταν δεν υπάρχει άλλη. */
export function nextRun(s: AutoSchedule, after: Date): Date | null {
  const [hh, mm] = hm(s.time);
  if (s.kind === 'once') {
    if (!s.date) return null;
    const [y, m, d] = s.date.split('-').map(Number);
    const t = zonedToUtc(y, m, d, hh, mm);
    return t.getTime() > after.getTime() ? t : null;
  }
  const start = localParts(after);
  for (let i = 0; i < 400; i++) {
    const day = new Date(Date.UTC(start.y, start.m - 1, start.d + i));
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate();
    if (s.until && ymd(y, m, d) > s.until) return null;
    const ok = s.kind === 'daily' || (s.kind === 'weekly' && (s.weekdays ?? []).includes(day.getUTCDay())) || (s.kind === 'monthly' && d === (s.day ?? 1));
    if (!ok) continue;
    const t = zonedToUtc(y, m, d, hh, mm);
    if (t.getTime() > after.getTime()) return t;
  }
  return null;
}

/** Καθυστέρηση σε ms (αρνητική για «πριν»). */
export function delayMs(d: AutoDelay): number {
  const unit = d.unit === 'minutes' ? 60_000 : d.unit === 'hours' ? 3_600_000 : 86_400_000;
  return (d.dir === 'before' ? -1 : 1) * d.amount * unit;
}

/* ── Περιγραφή με λόγια (κάθε φράση χωριστά, για μετάφραση) ─────────────── */

export const WEEKDAY_EL = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
export const WEEKDAY_SHORT = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'];
export const EVERY_WEEKDAY = ['Κάθε Κυριακή', 'Κάθε Δευτέρα', 'Κάθε Τρίτη', 'Κάθε Τετάρτη', 'Κάθε Πέμπτη', 'Κάθε Παρασκευή', 'Κάθε Σάββατο'];
/** Τμήμα κειμένου· `data` = αριθμοί / ημερομηνίες (δεν μεταφράζονται). */
export interface Seg { t: string; data?: boolean }
const dmy = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

export function scheduleSegments(s: AutoSchedule): Seg[] {
  const out: Seg[] = [];
  if (s.kind === 'once') out.push({ t: 'Μία φορά' }, { t: dmy(s.date ?? ''), data: true });
  else if (s.kind === 'daily') out.push({ t: 'Κάθε μέρα' });
  else if (s.kind === 'weekly') {
    const w = s.weekdays ?? [];
    if (w.length === 1) out.push({ t: EVERY_WEEKDAY[w[0]] });
    else { out.push({ t: 'Κάθε εβδομάδα' }); w.forEach((d) => out.push({ t: WEEKDAY_SHORT[d] })); }
  } else out.push({ t: `Κάθε μήνα, ημέρα ${s.day ?? 1}` });
  out.push({ t: s.time, data: true });
  if (s.kind !== 'once' && s.until) out.push({ t: 'έως' }, { t: dmy(s.until), data: true });
  return out;
}

const UNIT_EL: Record<DelayUnit, [string, string]> = { minutes: ['λεπτό', 'λεπτά'], hours: ['ώρα', 'ώρες'], days: ['μέρα', 'μέρες'] };
export function delaySegments(d: AutoDelay): Seg[] {
  if (!d.amount) return [{ t: 'Αμέσως' }];
  const u = UNIT_EL[d.unit][d.amount === 1 ? 0 : 1];
  return [{ t: `${d.amount}` , data: true }, { t: u }, { t: d.dir === 'before' ? 'πριν' : 'μετά' }];
}

export function triggerSegments(t: AutoTrigger, stageLabel: (k: string) => string = (k) => k, sourceLabel: (k: string) => string = (k) => k): Seg[] {
  const def = EVENT_BY_KEY[t.event];
  const out: Seg[] = [{ t: def?.label ?? t.event }];
  if (t.event === 'new_lead' && t.params.source) out.push({ t: sourceLabel(t.params.source) });
  if (t.event === 'lead_stage' && t.params.stage) out.push({ t: stageLabel(t.params.stage) });
  if (t.event === 'no_contact') out.push({ t: `${t.params.days ?? 30}`, data: true }, { t: 'μέρες' });
  else out.push(...delaySegments(t.delay));
  if (def?.dateOnly && t.params.time) out.push({ t: t.params.time, data: true });
  return out;
}

/* ── Κείμενο ────────────────────────────────────────────────────────────── */

export type AutoVars = Partial<Record<'name' | 'date' | 'time' | 'project' | 'unit' | 'amount' | 'agent', string>>;
export function renderAutomation(text: string, v: AutoVars): string {
  const name = (v.name ?? '').trim();
  const first = name.split(/\s+/)[0] ?? '';
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (all, k: string) => {
    const key = k.toLowerCase();
    if (key === 'first_name') return first;
    if (key === 'name') return name;
    return key in v ? (v as any)[key] ?? '' : all;
  });
}

/** Δείγμα τιμών για την προεπισκόπηση και τη «Δοκιμή». */
export const SAMPLE_VARS: AutoVars = { name: 'Μαρία Παπαδοπούλου', date: '12/12/2026', time: '10:30', project: 'Oramira Residences', unit: 'A12', amount: '€25.000', agent: 'Ελένη' };

/* ── Έτοιμες ιδέες ──────────────────────────────────────────────────────── */

export interface Idea { category: CategoryKey; title: string; input: AutomationInput }
const ev = (event: EventKey, delay: Partial<AutoDelay> = {}, params: AutoTrigger['params'] = {}): AutoTrigger => ({ event, params, delay: { amount: 0, unit: 'hours', dir: 'after', ...delay }, filter: {} });
export const IDEAS: Idea[] = [
  { category: 'leads', title: 'Καλωσόρισμα με email μόλις έρθει νέο lead', input: { name: 'Καλωσόρισμα νέου lead', kind: 'event', channel: 'email', trigger: ev('new_lead'), subject: 'Καλώς ήρθατε, {{first_name}}', body: 'Γεια σας {{first_name}},\n\nΣας ευχαριστούμε για το ενδιαφέρον σας. Ο σύμβουλός μας θα επικοινωνήσει μαζί σας σύντομα.\n\nΜε εκτίμηση,\nOramira' } },
  { category: 'leads', title: 'SMS 2 ώρες μετά αν δεν έχουμε απαντήσει', input: { name: 'Lead χωρίς απάντηση', kind: 'event', channel: 'sms', trigger: ev('lead_unanswered', { amount: 2, unit: 'hours' }), body: 'Γεια σας {{first_name}}, λάβαμε το μήνυμά σας και θα σας καλέσουμε σύντομα. Oramira' } },
  { category: 'leads', title: 'WhatsApp σε leads από Facebook / Instagram', input: { name: 'Leads από Facebook / Instagram', kind: 'event', channel: 'whatsapp', trigger: ev('new_lead', { amount: 5, unit: 'minutes' }, { source: 'meta' }), body: 'Γεια σας {{first_name}}! Είδαμε το ενδιαφέρον σας στο Facebook. Θέλετε να σας στείλουμε κατόψεις και τιμές;' } },
  { category: 'sales', title: 'Συγχαρητήρια μετά την υπογραφή συμβολαίου', input: { name: 'Συγχαρητήρια για το συμβόλαιο', kind: 'event', channel: 'email', trigger: ev('contract_signed', { amount: 1, unit: 'hours' }), subject: 'Συγχαρητήρια για το νέο σας σπίτι!', body: 'Αγαπητέ/ή {{first_name}},\n\nΣυγχαρητήρια για την αγορά της μονάδας {{unit}} στο {{project}}! Θα σας ενημερώνουμε για κάθε βήμα της κατασκευής.\n\nOramira' } },
  { category: 'sales', title: 'Ευχαριστώ για την κράτηση μονάδας', input: { name: 'Ευχαριστώ για την κράτηση', kind: 'event', channel: 'whatsapp', trigger: ev('reservation'), body: 'Γεια σας {{first_name}}, σας ευχαριστούμε για την κράτηση της μονάδας {{unit}} στο {{project}}. Ο σύμβουλός σας θα σας στείλει τα επόμενα βήματα.' } },
  { category: 'sales', title: 'Μήνυμα 30 μέρες μετά από χαμένο lead', input: { name: 'Επανασύνδεση χαμένων leads', kind: 'event', channel: 'email', trigger: ev('lead_lost', { amount: 30, unit: 'days' }), subject: 'Νέα διαθέσιμα ακίνητα', body: 'Γεια σας {{first_name}},\n\nΈχουμε νέα διαθέσιμα ακίνητα που ίσως σας ενδιαφέρουν. Θέλετε να τα δείτε;\n\nOramira' } },
  { category: 'viewings', title: 'Υπενθύμιση 1 μέρα πριν την ξενάγηση', input: { name: 'Υπενθύμιση ξενάγησης', kind: 'event', channel: 'sms', trigger: ev('viewing', { amount: 1, unit: 'days', dir: 'before' }), body: 'Υπενθύμιση: {{first_name}}, σας περιμένουμε αύριο {{date}} στις {{time}} για την ξενάγηση στο {{project}}.' } },
  { category: 'viewings', title: 'Ευχαριστώ 2 ώρες μετά την ξενάγηση', input: { name: 'Ευχαριστώ μετά την ξενάγηση', kind: 'event', channel: 'whatsapp', trigger: ev('viewing', { amount: 2, unit: 'hours' }), body: 'Γεια σας {{first_name}}, σας ευχαριστούμε για την επίσκεψη στο {{project}}! Αν έχετε ερωτήσεις, είμαστε εδώ. {{agent}}' } },
  { category: 'viewings', title: 'Επιβεβαίωση μόλις κλειστεί ραντεβού', input: { name: 'Επιβεβαίωση ραντεβού', kind: 'event', channel: 'email', trigger: ev('viewing_booked'), subject: 'Επιβεβαίωση ραντεβού {{date}}', body: 'Γεια σας {{first_name}},\n\nΕπιβεβαιώνουμε το ραντεβού σας στις {{date}}, ώρα {{time}}, στο {{project}}.\n\nOramira' } },
  { category: 'clients', title: 'Καλωσόρισμα στο νέο σπίτι την ημέρα παράδοσης', input: { name: 'Καλωσόρισμα στο νέο σπίτι', kind: 'event', channel: 'email', trigger: ev('handover', {}, { time: '10:00' }), subject: 'Καλώς ήρθατε στο νέο σας σπίτι!', body: 'Αγαπητέ/ή {{first_name}},\n\nΚαλώς ήρθατε στη μονάδα {{unit}}! Για οτιδήποτε χρειαστείτε, η ομάδα μας είναι εδώ.\n\nOramira' } },
  { category: 'clients', title: 'Ευχές στην επέτειο παράδοσης', input: { name: 'Επέτειος παράδοσης', kind: 'event', channel: 'sms', trigger: ev('handover_anniversary', {}, { time: '10:00' }), body: 'Χρόνια πολλά για το σπίτι σας, {{first_name}}! Ένας χρόνος στη μονάδα {{unit}}. Oramira' } },
  { category: 'clients', title: 'Μήνυμα σε lead χωρίς επικοινωνία 30 μέρες', input: { name: 'Χωρίς επικοινωνία 30 μέρες', kind: 'event', channel: 'email', trigger: ev('no_contact', {}, { days: 30 }), subject: 'Ακόμη ψάχνετε σπίτι;', body: 'Γεια σας {{first_name}},\n\nΘέλαμε να δούμε αν ακόμη ψάχνετε ακίνητο. Έχουμε νέες επιλογές για εσάς.\n\nOramira' } },
  { category: 'payments', title: 'Υπενθύμιση 3 μέρες πριν τη δόση', input: { name: 'Υπενθύμιση δόσης', kind: 'event', channel: 'email', trigger: ev('payment_due', { amount: 3, unit: 'days', dir: 'before' }, { time: '09:00' }), subject: 'Υπενθύμιση δόσης {{date}}', body: 'Αγαπητέ/ή {{first_name}},\n\nΣας υπενθυμίζουμε ότι η δόση των {{amount}} για τη μονάδα {{unit}} λήγει στις {{date}}.\n\nOramira' } },
  { category: 'payments', title: 'SMS 2 μέρες μετά από καθυστερημένη δόση', input: { name: 'Καθυστερημένη δόση', kind: 'event', channel: 'sms', trigger: ev('payment_overdue', { amount: 2, unit: 'days' }, { time: '10:00' }), body: '{{first_name}}, η δόση των {{amount}} (λήξη {{date}}) δεν έχει ακόμη πληρωθεί. Για βοήθεια καλέστε μας. Oramira' } },
  { category: 'special', title: 'Ευχές γενεθλίων με SMS', input: { name: 'Ευχές γενεθλίων', kind: 'event', channel: 'sms', trigger: ev('birthday', {}, { time: '09:00' }), body: 'Χρόνια πολλά {{first_name}}! Σας ευχόμαστε υγεία και χαρά. Oramira' } },
  { category: 'special', title: 'Κάθε Παρασκευή νέα της κατασκευής στους ιδιοκτήτες', input: { name: 'Εβδομαδιαία νέα κατασκευής', kind: 'schedule', channel: 'push', schedule: { kind: 'weekly', weekdays: [5], time: '12:00' }, audience: { kind: 'role', role: 'homeowner' }, subject: 'Νέα από το εργοτάξιο', body: 'Γεια σας {{first_name}}! Δείτε στην εφαρμογή τις νέες φωτογραφίες και την πρόοδο της κατασκευής.' } },
  { category: 'special', title: 'Κάθε Δευτέρα 10:00 SMS στους επενδυτές', input: { name: 'Εβδομαδιαία ενημέρωση επενδυτών', kind: 'schedule', channel: 'sms', schedule: { kind: 'weekly', weekdays: [1], time: '10:00' }, audience: { kind: 'role', role: 'investor' }, body: 'Καλημέρα {{first_name}}! Δείτε τα νέα διαθέσιμα ακίνητα αυτής της εβδομάδας στην εφαρμογή. Oramira' } },
  { category: 'special', title: 'Μηνιαίο newsletter την 1η του μήνα', input: { name: 'Μηνιαίο newsletter', kind: 'schedule', channel: 'email', schedule: { kind: 'monthly', day: 1, time: '09:00' }, audience: { kind: 'role', role: 'newsletter' }, subject: 'Τα νέα του μήνα', body: 'Γεια σας {{first_name}},\n\nΑυτά είναι τα νέα μας για αυτόν τον μήνα…\n\nOramira' } },
];
