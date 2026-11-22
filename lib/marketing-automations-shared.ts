/**
 * Marketing → Δικοί μου αυτοματισμοί — client-safe τύποι, κατάλογος γεγονότων,
 * υπολογισμός επόμενης εκτέλεσης (ώρα Κύπρου) και περιγραφή «με λόγια».
 */
import { cleanAudience, cleanSender, type CampaignAudience, type CampaignChannel } from '@/lib/campaigns-shared';

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
  subject: string | null; body: string; active: boolean; senderName: string | null;
  subjectEn: string | null; bodyEn: string | null;
  nextRunAt: string | null; lastRunAt: string | null; runs: number; createdAt: string;
}
export interface AutomationInput {
  id?: string; name: string; kind: AutomationKind; channel: CampaignChannel;
  audience?: unknown; trigger?: unknown; schedule?: unknown; subject?: string; body: string; senderName?: string;
  subjectEn?: string; bodyEn?: string;
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
  const max = channel === 'sms' ? 1000 : 20000;
  const body = (input.body ?? '').trim().slice(0, max);
  const bodyEn = (input.bodyEn ?? '').trim().slice(0, max) || null;
  const subject = (input.subject ?? '').trim().slice(0, 200) || null;
  const subjectEn = (input.subjectEn ?? '').trim().slice(0, 200) || null;
  if (!name) return { ok: false, error: 'Γράψτε όνομα αυτοματισμού.' };
  if (!body && !bodyEn) return { ok: false, error: 'Γράψτε το μήνυμα.' };
  if (channel === 'email' && !subject && !subjectEn) return { ok: false, error: 'Γράψτε θέμα για το email.' };
  const sender = cleanSender(input.senderName, channel);
  if (!sender.ok) return sender;
  const senderName = sender.value;
  if (input.kind === 'event') {
    const trigger = cleanTrigger(input.trigger);
    if (!trigger) return { ok: false, error: 'Διαλέξτε πότε στέλνεται.' };
    return { ok: true, value: { name, kind: 'event', channel, audience: null, trigger, schedule: null, subject, body, senderName, subjectEn, bodyEn } };
  }
  const schedule = cleanSchedule(input.schedule);
  if (!schedule) return { ok: false, error: 'Συμπληρώστε ημερομηνία / μέρες και ώρα.' };
  if (schedule.kind === 'once') return { ok: false, error: 'Για μήνυμα μία φορά φτιάξτε καμπάνια (Καμπάνιες → Προγραμματισμός).' };
  const audience = cleanAudience(input.audience, channel);
  if (!audience) return { ok: false, error: 'Διαλέξτε σε ποιους στέλνεται.' };
  return { ok: true, value: { name, kind: 'schedule', channel, audience, trigger: null, schedule, subject, body, senderName, subjectEn, bodyEn } };
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

/* ── Ιστορικό αποστολών ─────────────────────────────────────────────────── */

export type SendReason = 'archived' | 'no_consent' | 'no_address' | 'no_app' | 'no_provider' | 'provider_error';
/** Σύντομη εξήγηση γιατί κάποιος δεν πήρε το μήνυμα. */
export function reasonText(r: string | null | undefined, channel: string | null | undefined): string | null {
  const ch = channel === 'email' ? 'Email' : channel === 'sms' ? 'SMS' : channel === 'whatsapp' ? 'WhatsApp' : 'Push';
  switch (r) {
    case 'archived': return 'Ο πελάτης είναι αρχειοθετημένος ή δεν θέλει επικοινωνία';
    case 'no_consent': return channel === 'email' ? 'Ο πελάτης δεν δέχεται email' : channel === 'push' ? 'Ο πελάτης δεν δέχεται ειδοποιήσεις' : 'Ο πελάτης δεν δέχεται SMS';
    case 'no_address': return channel === 'email' ? 'Χωρίς email' : 'Χωρίς τηλέφωνο';
    case 'no_app': return 'Χωρίς λογαριασμό στην εφαρμογή';
    case 'no_provider': return `Δεν υπάρχει πάροχος ${ch}`;
    case 'provider_error': return 'Ο πάροχος απέρριψε το μήνυμα';
    default: return null;
  }
}
export interface SendHistoryRow { at: string; contactId: string | null; contactName: string | null; channel: string | null; status: string; reason: string | null }
export interface RunHistoryRow { id: string; at: string; name: string; recipients: number; sent: number; failed: number; skipped: number; status: string }
export interface AutomationStats { sent: number; failed: number; skipped: number }

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
  { category: 'leads', title: 'Καλωσόρισμα με email μόλις έρθει νέο lead', input: { name: 'Καλωσόρισμα νέου lead', kind: 'event', channel: 'email', trigger: ev('new_lead'),
    subject: 'Σας ευχαριστούμε για το ενδιαφέρον σας', body: 'Αγαπητέ/ή {{name}},\n\nΣας ευχαριστούμε για το ενδιαφέρον σας. Λάβαμε το αίτημά σας και ένας σύμβουλός μας θα επικοινωνήσει μαζί σας το συντομότερο.\n\nΜε εκτίμηση,',
    subjectEn: 'Thank you for your interest', bodyEn: 'Dear {{name}},\n\nThank you for your interest. We have received your enquiry and one of our consultants will contact you shortly.\n\nKind regards,' } },
  { category: 'leads', title: 'SMS 2 ώρες μετά αν δεν έχουμε απαντήσει', input: { name: 'Lead χωρίς απάντηση', kind: 'event', channel: 'sms', trigger: ev('lead_unanswered', { amount: 2, unit: 'hours' }),
    body: 'Αγαπητέ/ή {{first_name}}, λάβαμε το αίτημά σας και θα επικοινωνήσουμε μαζί σας σύντομα.', bodyEn: 'Dear {{first_name}}, we have received your enquiry and will contact you shortly.' } },
  { category: 'leads', title: 'WhatsApp σε leads από Facebook / Instagram', input: { name: 'Leads από Facebook / Instagram', kind: 'event', channel: 'whatsapp', trigger: ev('new_lead', { amount: 5, unit: 'minutes' }, { source: 'meta' }),
    body: 'Αγαπητέ/ή {{first_name}}, σας ευχαριστούμε για το ενδιαφέρον σας. Θα θέλατε να σας στείλουμε κατόψεις και τιμές των διαθέσιμων ακινήτων;', bodyEn: 'Dear {{first_name}}, thank you for your interest. Would you like us to send you floor plans and prices of the available properties?' } },
  { category: 'sales', title: 'Συγχαρητήρια μετά την υπογραφή συμβολαίου', input: { name: 'Συγχαρητήρια για το συμβόλαιο', kind: 'event', channel: 'email', trigger: ev('contract_signed', { amount: 1, unit: 'hours' }),
    subject: 'Συγχαρητήρια για την αγορά σας', body: 'Αγαπητέ/ή {{name}},\n\nΣας συγχαίρουμε για την αγορά της μονάδας {{unit}} στο {{project}} και σας ευχαριστούμε για την εμπιστοσύνη σας. Θα σας ενημερώνουμε για κάθε στάδιο της κατασκευής.\n\nΜε εκτίμηση,',
    subjectEn: 'Congratulations on your purchase', bodyEn: 'Dear {{name}},\n\nCongratulations on the purchase of unit {{unit}} at {{project}}, and thank you for your trust. We will keep you informed at every stage of construction.\n\nKind regards,' } },
  { category: 'sales', title: 'Ευχαριστώ για την κράτηση μονάδας', input: { name: 'Ευχαριστώ για την κράτηση', kind: 'event', channel: 'whatsapp', trigger: ev('reservation'),
    body: 'Αγαπητέ/ή {{first_name}}, σας ευχαριστούμε για την κράτηση της μονάδας {{unit}} στο {{project}}. Ο σύμβουλός σας θα σας ενημερώσει σύντομα για τα επόμενα βήματα.', bodyEn: 'Dear {{first_name}}, thank you for reserving unit {{unit}} at {{project}}. Your consultant will shortly inform you of the next steps.' } },
  { category: 'sales', title: 'Μήνυμα 30 μέρες μετά από χαμένο lead', input: { name: 'Επανασύνδεση χαμένων leads', kind: 'event', channel: 'email', trigger: ev('lead_lost', { amount: 30, unit: 'days' }),
    subject: 'Νέα διαθέσιμα ακίνητα', body: 'Αγαπητέ/ή {{name}},\n\nΘα θέλαμε να σας ενημερώσουμε ότι έχουμε νέα διαθέσιμα ακίνητα που ενδέχεται να σας ενδιαφέρουν. Είμαστε στη διάθεσή σας για περισσότερες πληροφορίες.\n\nΜε εκτίμηση,',
    subjectEn: 'New properties available', bodyEn: 'Dear {{name}},\n\nWe would like to let you know that we have new properties available which may be of interest to you. We remain at your disposal for any further information.\n\nKind regards,' } },
  { category: 'viewings', title: 'Υπενθύμιση 1 μέρα πριν την ξενάγηση', input: { name: 'Υπενθύμιση ξενάγησης', kind: 'event', channel: 'sms', trigger: ev('viewing', { amount: 1, unit: 'days', dir: 'before' }),
    body: 'Αγαπητέ/ή {{first_name}}, σας υπενθυμίζουμε την ξενάγησή σας στο {{project}} στις {{date}}, ώρα {{time}}.', bodyEn: 'Dear {{first_name}}, this is a reminder of your viewing at {{project}} on {{date}} at {{time}}.' } },
  { category: 'viewings', title: 'Ευχαριστώ 2 ώρες μετά την ξενάγηση', input: { name: 'Ευχαριστώ μετά την ξενάγηση', kind: 'event', channel: 'whatsapp', trigger: ev('viewing', { amount: 2, unit: 'hours' }),
    body: 'Αγαπητέ/ή {{first_name}}, σας ευχαριστούμε για την επίσκεψή σας στο {{project}}. Για οποιαδήποτε ερώτηση, είμαστε στη διάθεσή σας. {{agent}}', bodyEn: 'Dear {{first_name}}, thank you for visiting {{project}}. Should you have any questions, we remain at your disposal. {{agent}}' } },
  { category: 'viewings', title: 'Επιβεβαίωση μόλις κλειστεί ραντεβού', input: { name: 'Επιβεβαίωση ραντεβού', kind: 'event', channel: 'email', trigger: ev('viewing_booked'),
    subject: 'Επιβεβαίωση ραντεβού {{date}}', body: 'Αγαπητέ/ή {{name}},\n\nΕπιβεβαιώνουμε το ραντεβού σας στις {{date}}, ώρα {{time}}, στο {{project}}. Για οποιαδήποτε αλλαγή, παρακαλούμε απαντήστε σε αυτό το μήνυμα.\n\nΜε εκτίμηση,',
    subjectEn: 'Appointment confirmation {{date}}', bodyEn: 'Dear {{name}},\n\nWe confirm your appointment on {{date}} at {{time}} at {{project}}. Should you need to make any change, please reply to this message.\n\nKind regards,' } },
  { category: 'clients', title: 'Καλωσόρισμα στο νέο σπίτι την ημέρα παράδοσης', input: { name: 'Καλωσόρισμα στο νέο σπίτι', kind: 'event', channel: 'email', trigger: ev('handover', {}, { time: '10:00' }),
    subject: 'Καλώς ήρθατε στο νέο σας σπίτι', body: 'Αγαπητέ/ή {{name}},\n\nΣας καλωσορίζουμε στη μονάδα {{unit}} στο {{project}}. Για οποιοδήποτε θέμα χρειαστείτε, η ομάδα μας παραμένει στη διάθεσή σας.\n\nΜε εκτίμηση,',
    subjectEn: 'Welcome to your new home', bodyEn: 'Dear {{name}},\n\nWelcome to unit {{unit}} at {{project}}. Should you need anything, our team remains at your disposal.\n\nKind regards,' } },
  { category: 'clients', title: 'Ευχές στην επέτειο παράδοσης', input: { name: 'Επέτειος παράδοσης', kind: 'event', channel: 'sms', trigger: ev('handover_anniversary', {}, { time: '10:00' }),
    body: 'Αγαπητέ/ή {{first_name}}, σήμερα συμπληρώνεται ένας ακόμη χρόνος στο σπίτι σας στο {{project}}. Σας ευχόμαστε να το χαίρεστε.', bodyEn: 'Dear {{first_name}}, today marks another year in your home at {{project}}. We wish you continued enjoyment of it.' } },
  { category: 'clients', title: 'Μήνυμα σε lead χωρίς επικοινωνία 30 μέρες', input: { name: 'Χωρίς επικοινωνία 30 μέρες', kind: 'event', channel: 'email', trigger: ev('no_contact', {}, { days: 30 }),
    subject: 'Μπορούμε να σας βοηθήσουμε;', body: 'Αγαπητέ/ή {{name}},\n\nΘα θέλαμε να μάθουμε αν εξακολουθείτε να αναζητάτε ακίνητο. Έχουμε νέες επιλογές που ίσως σας ενδιαφέρουν και θα χαρούμε να σας τις παρουσιάσουμε.\n\nΜε εκτίμηση,',
    subjectEn: 'May we assist you?', bodyEn: 'Dear {{name}},\n\nWe would like to know whether you are still looking for a property. We have new options that may interest you and would be pleased to present them to you.\n\nKind regards,' } },
  { category: 'payments', title: 'Υπενθύμιση 3 μέρες πριν τη δόση', input: { name: 'Υπενθύμιση δόσης', kind: 'event', channel: 'email', trigger: ev('payment_due', { amount: 3, unit: 'days', dir: 'before' }, { time: '09:00' }),
    subject: 'Υπενθύμιση πληρωμής δόσης {{date}}', body: 'Αγαπητέ/ή {{name}},\n\nΣας υπενθυμίζουμε ότι η δόση ύψους {{amount}} για τη μονάδα {{unit}} λήγει στις {{date}}. Εάν έχετε ήδη προχωρήσει στην πληρωμή, παρακαλούμε αγνοήστε αυτό το μήνυμα.\n\nΜε εκτίμηση,',
    subjectEn: 'Instalment reminder {{date}}', bodyEn: 'Dear {{name}},\n\nThis is a reminder that the instalment of {{amount}} for unit {{unit}} is due on {{date}}. If you have already made the payment, please disregard this message.\n\nKind regards,' } },
  { category: 'payments', title: 'SMS 2 μέρες μετά από καθυστερημένη δόση', input: { name: 'Καθυστερημένη δόση', kind: 'event', channel: 'sms', trigger: ev('payment_overdue', { amount: 2, unit: 'days' }, { time: '10:00' }),
    body: 'Αγαπητέ/ή {{first_name}}, η δόση ύψους {{amount}} με λήξη {{date}} δεν έχει ακόμη εξοφληθεί. Για οποιαδήποτε διευκρίνιση, παρακαλούμε επικοινωνήστε μαζί μας.', bodyEn: 'Dear {{first_name}}, the instalment of {{amount}} due on {{date}} remains outstanding. For any clarification, please contact us.' } },
  { category: 'special', title: 'Ευχές γενεθλίων με SMS', input: { name: 'Ευχές γενεθλίων', kind: 'event', channel: 'sms', trigger: ev('birthday', {}, { time: '09:00' }),
    body: 'Αγαπητέ/ή {{first_name}}, σας ευχόμαστε χρόνια πολλά, υγεία και κάθε επιτυχία.', bodyEn: 'Dear {{first_name}}, we wish you a very happy birthday, good health and every success.' } },
  { category: 'special', title: 'Κάθε Παρασκευή νέα της κατασκευής στους ιδιοκτήτες', input: { name: 'Εβδομαδιαία νέα κατασκευής', kind: 'schedule', channel: 'push', schedule: { kind: 'weekly', weekdays: [5], time: '12:00' }, audience: { kind: 'role', role: 'homeowner' },
    subject: 'Πρόοδος κατασκευής', body: 'Δείτε στην εφαρμογή τις νέες φωτογραφίες και την πρόοδο της κατασκευής αυτής της εβδομάδας.', subjectEn: 'Construction progress', bodyEn: 'See this week’s new photos and construction progress in the app.' } },
  { category: 'special', title: 'Κάθε Δευτέρα 10:00 SMS στους επενδυτές', input: { name: 'Εβδομαδιαία ενημέρωση επενδυτών', kind: 'schedule', channel: 'sms', schedule: { kind: 'weekly', weekdays: [1], time: '10:00' }, audience: { kind: 'role', role: 'investor' },
    body: 'Αγαπητέ/ή {{first_name}}, τα νέα διαθέσιμα ακίνητα της εβδομάδας είναι διαθέσιμα στην εφαρμογή.', bodyEn: 'Dear {{first_name}}, this week’s newly available properties can be viewed in the app.' } },
  { category: 'special', title: 'Μηνιαίο newsletter την 1η του μήνα', input: { name: 'Μηνιαίο newsletter', kind: 'schedule', channel: 'email', schedule: { kind: 'monthly', day: 1, time: '09:00' }, audience: { kind: 'role', role: 'newsletter' },
    subject: 'Τα νέα του μήνα', body: 'Αγαπητέ/ή {{name}},\n\nΣας παρουσιάζουμε τα νέα μας για αυτόν τον μήνα.\n\nΜε εκτίμηση,', subjectEn: 'This month’s news', bodyEn: 'Dear {{name}},\n\nPlease find below our news for this month.\n\nKind regards,' } },
];
