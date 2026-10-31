/**
 * Leads & αυτοματισμοί (Ρυθμίσεις → Leads & αυτοματισμοί) — ένα slice
 * org_settings.data.leadAutomation. Client-safe: χρησιμοποιείται από τη φόρμα,
 * τον server (cron/events) και τα tests. Το routing εκτελείται στη βάση
 * (trigger trg_b_lead_routing, migration 0069) διαβάζοντας το ίδιο JSON.
 */

export const LEAD_SOURCES = ['website', 'meta', 'google', 'organic', 'referral', 'walk_in', 'whatsapp', 'other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const SOURCE_EL: Record<LeadSource, string> = {
  website: 'Ιστοσελίδα', meta: 'Facebook / Instagram', google: 'Google', organic: 'Οργανικά',
  referral: 'Σύσταση', walk_in: 'Επίσκεψη στο γραφείο', whatsapp: 'WhatsApp', other: 'Άλλο',
};

export type RouteTarget = 'none' | 'round_robin' | 'agent';
export interface SourceRule { source: LeadSource; target: RouteTarget; agentId: string | null }
export interface RoutingSettings {
  enabled: boolean;
  defaultTarget: RouteTarget;
  defaultAgent: string | null;
  rules: SourceRule[];
  /** Η ομάδα του round robin (κενό = όλοι οι ενεργοί πωλητές). */
  pool: string[];
  skipOnLeave: boolean;
  returningToPrevious: boolean;
}

export type SeqAction = 'whatsapp' | 'email' | 'call_task';
export interface SeqStep { afterHours: number; action: SeqAction; templateKey: string }

export interface LeadAutomationSettings {
  routing: RoutingSettings;
  welcome: { enabled: boolean; whatsapp: boolean; email: boolean };
  unanswered: { minutes: number; notifyOwner: boolean; notifyManagers: boolean; reassignAfterMinutes: number | null };
  sequence: { enabled: boolean; stopOnReply: boolean; steps: SeqStep[] };
  digest: { enabled: boolean; hour: number; managers: boolean };
}

export const SEQUENCE_TEMPLATES = ['follow_up', 'nurture_intro', 'nurture_market', 'nurture_objections', 'reactivation'] as const;
export const TEMPLATE_EL: Record<string, string> = {
  follow_up: 'Follow-up', nurture_intro: 'Γνωριμία', nurture_market: 'Η αγορά', nurture_objections: 'Συχνές ανησυχίες', reactivation: 'Επανενεργοποίηση',
};
export const ACTION_EL: Record<SeqAction, string> = { whatsapp: 'WhatsApp', email: 'Email', call_task: 'Εργασία: τηλεφώνημα' };

export const DEFAULT_LEAD_AUTOMATION: LeadAutomationSettings = {
  routing: { enabled: false, defaultTarget: 'round_robin', defaultAgent: null, rules: [], pool: [], skipOnLeave: true, returningToPrevious: true },
  welcome: { enabled: true, whatsapp: true, email: true },
  unanswered: { minutes: 10, notifyOwner: true, notifyManagers: true, reassignAfterMinutes: null },
  sequence: {
    enabled: true, stopOnReply: true,
    steps: [
      { afterHours: 24, action: 'whatsapp', templateKey: 'follow_up' },
      { afterHours: 48, action: 'call_task', templateKey: '' },
      { afterHours: 72, action: 'email', templateKey: 'nurture_market' },
      { afterHours: 168, action: 'email', templateKey: 'nurture_objections' },
    ],
  },
  digest: { enabled: true, hour: 8, managers: true },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (x: unknown) => (typeof x === 'string' && UUID.test(x) ? x : null);
const bool = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
const int = (x: unknown, d: number, lo: number, hi: number) => {
  const n = typeof x === 'string' ? Number(x) : x;
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
};
const target = (x: unknown, d: RouteTarget): RouteTarget => (x === 'none' || x === 'round_robin' || x === 'agent' ? x : d);

export function mergeLeadAutomation(x: any): LeadAutomationSettings {
  const D = DEFAULT_LEAD_AUTOMATION;
  const v = x && typeof x === 'object' ? x : {};
  const r = v.routing && typeof v.routing === 'object' ? v.routing : {};
  const seen = new Set<string>();
  const rules: SourceRule[] = (Array.isArray(r.rules) ? r.rules : [])
    .filter((q: any) => q && (LEAD_SOURCES as readonly string[]).includes(q.source) && !seen.has(q.source) && seen.add(q.source))
    .map((q: any) => {
      const t = target(q.target, 'round_robin'); const agentId = uuidOrNull(q.agentId);
      return { source: q.source, target: t === 'agent' && !agentId ? 'round_robin' : t, agentId: t === 'agent' ? agentId : null };
    });
  const dt = target(r.defaultTarget, D.routing.defaultTarget); const da = uuidOrNull(r.defaultAgent);
  const w = v.welcome ?? {}; const u = v.unanswered ?? {}; const s = v.sequence ?? {}; const g = v.digest ?? {};
  const steps: SeqStep[] = (Array.isArray(s.steps) ? s.steps : D.sequence.steps)
    .filter((q: any) => q && ['whatsapp', 'email', 'call_task'].includes(q.action))
    .map((q: any) => ({
      afterHours: int(q.afterHours, 24, 1, 24 * 60),
      action: q.action as SeqAction,
      templateKey: q.action === 'call_task' ? '' : (typeof q.templateKey === 'string' && /^[a-z0-9_]{2,40}$/.test(q.templateKey) ? q.templateKey : 'follow_up'),
    }))
    .sort((a: SeqStep, b: SeqStep) => a.afterHours - b.afterHours)
    .slice(0, 12);
  const reassign = u.reassignAfterMinutes === null || u.reassignAfterMinutes === '' || u.reassignAfterMinutes === undefined ? null : int(u.reassignAfterMinutes, 60, 5, 7 * 24 * 60);
  const minutes = int(u.minutes, D.unanswered.minutes, 1, 24 * 60);
  return {
    routing: {
      enabled: bool(r.enabled, D.routing.enabled),
      defaultTarget: dt === 'agent' && !da ? 'round_robin' : dt,
      defaultAgent: dt === 'agent' ? da : null,
      rules,
      pool: Array.from(new Set((Array.isArray(r.pool) ? r.pool : []).map(uuidOrNull).filter(Boolean) as string[])).slice(0, 100),
      skipOnLeave: bool(r.skipOnLeave, D.routing.skipOnLeave),
      returningToPrevious: bool(r.returningToPrevious, D.routing.returningToPrevious),
    },
    welcome: { enabled: bool(w.enabled, D.welcome.enabled), whatsapp: bool(w.whatsapp, D.welcome.whatsapp), email: bool(w.email, D.welcome.email) },
    unanswered: {
      minutes,
      notifyOwner: bool(u.notifyOwner, D.unanswered.notifyOwner),
      notifyManagers: bool(u.notifyManagers, D.unanswered.notifyManagers),
      reassignAfterMinutes: reassign === null ? null : Math.max(reassign, minutes),
    },
    sequence: { enabled: bool(s.enabled, D.sequence.enabled), stopOnReply: bool(s.stopOnReply, D.sequence.stopOnReply), steps },
    digest: { enabled: bool(g.enabled, D.digest.enabled), hour: int(g.hour, D.digest.hour, 0, 23), managers: bool(g.managers, D.digest.managers) },
  };
}

/** Ποιος παίρνει ένα lead από την πηγή του (ίδια λογική με τον SQL trigger, για προεπισκόπηση). */
export function routeFor(cfg: RoutingSettings, source: string): { target: RouteTarget; agentId: string | null } {
  if (!cfg.enabled) return { target: 'none', agentId: null };
  const rule = cfg.rules.find((r) => r.source === source);
  return rule ? { target: rule.target, agentId: rule.agentId } : { target: cfg.defaultTarget, agentId: cfg.defaultAgent };
}

/** Round robin: ο διαθέσιμος με την παλαιότερη τελευταία ανάθεση (ποτέ = πρώτος). */
export function pickRoundRobin(pool: string[], lastAssigned: Record<string, string | null | undefined>, unavailable: Set<string> = new Set(), exclude: string | null = null): string | null {
  const ok = pool.filter((id) => !unavailable.has(id) && id !== exclude);
  if (!ok.length) return null;
  const t = (id: string) => (lastAssigned[id] ? new Date(lastAssigned[id] as string).getTime() : -Infinity);
  return ok.reduce((best, id) => (t(id) < t(best) ? id : best), ok[0]);
}

/** Το πρότυπο που ταιριάζει στη γλώσσα του πελάτη: η ίδια η γλώσσα του (αν
 *  υπάρχει μετάφραση, αλλιώς πέφτει στα αγγλικά μέσα στο sendTemplate). */
export function audienceFor(language?: string | null, buyerType?: string | null): string {
  const l = (language ?? '').toLowerCase().slice(0, 5);
  if (l && l !== 'other' && /^[a-z]{2}$/.test(l)) return l;
  if (buyerType === 'russian_cis') return 'ru';
  if (buyerType === 'local_cypriot') return 'el';
  return 'en';
}

/** Βήματα της σειράς που πρέπει να γίνουν τώρα. */
export function dueSteps(steps: SeqStep[], ageHours: number, done: Set<string>, replied: boolean, stopOnReply: boolean): SeqStep[] {
  if (replied && stopOnReply) return [];
  return steps.filter((s) => ageHours >= s.afterHours && !done.has(stepKey(s)));
}
export const stepKey = (s: SeqStep) => (s.action === 'call_task' ? `call@${s.afterHours}` : s.templateKey);

/** Ώρα Κύπρου (για τη σύνοψη: στέλνεται μία φορά, στην ώρα που ορίσατε). */
export function localParts(d: Date, tz = 'Europe/Nicosia'): { hour: number; date: string } {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { hour: Number(p.hour), date: `${p.year}-${p.month}-${p.day}` };
}

export interface DigestCounts { newLeads: number; unanswered: number; late: number; followUps: number; viewings: number; unassigned?: number }
/** Κείμενο ημερήσιας σύνοψης — null όταν δεν υπάρχει τίποτα να πει. */
export function digestText(c: DigestCounts): { title: string; body: string } | null {
  const parts: string[] = [];
  if (c.newLeads) parts.push(`${c.newLeads} νέα leads (24ώρο)`);
  if (c.unanswered) parts.push(`${c.unanswered} αναπάντητα`);
  if (c.late) parts.push(`${c.late} σε καθυστέρηση σταδίου`);
  if (c.followUps) parts.push(`${c.followUps} follow-ups σήμερα`);
  if (c.viewings) parts.push(`${c.viewings} ξεναγήσεις σήμερα`);
  if (c.unassigned) parts.push(`${c.unassigned} χωρίς υπεύθυνο`);
  if (!parts.length) return null;
  const urgent = c.unanswered + (c.unassigned ?? 0);
  return { title: urgent ? `Η μέρα σας: ${urgent} leads θέλουν απάντηση` : 'Η μέρα σας στα leads', body: parts.join(' · ') };
}

export interface TeamMember { id: string; name: string; role: string; onLeave: boolean; lastAssigned: string | null }

/* ── Διπλές επαφές ── */
export interface DupContact {
  id: string; full_name: string | null; email: string | null; phone: string | null; created_at: string;
  leads: number; isBuyer: boolean; hasPortal: boolean;
}
export interface DupPair { a: DupContact; b: DupContact; reasons: string[] }
export interface DupMatch { id: string; full_name: string | null; email: string | null; phone: string | null; reasons: string[] }

export const MATCH_EL: Record<string, string> = { e: 'ίδιο email', p: 'ίδιο τηλέφωνο', n: 'ίδιο όνομα' };
