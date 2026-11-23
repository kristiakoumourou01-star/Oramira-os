/**
 * Διαχείριση leads — κοινοί τύποι & κανόνες (client-safe, χωρίς server imports).
 * Νέα leads, Follow-ups και στατιστικά Agents.
 */
import { effectiveCan, type UserPermissions } from '@/lib/permissions';

type Who = { role: string; moduleAccess?: string[] | null; permissions?: UserPermissions | null };

/** Μπορεί να αναλάβει ένα lead χωρίς υπεύθυνο («Ανάληψη»). */
export function canClaimLeads(p: Who): boolean {
  return effectiveCan(p.role, p.moduleAccess ?? [], 'leads', 'edit', p.permissions ?? null);
}

/**
 * Μπορεί να δώσει lead σε άλλον συνεργάτη. Admin / Manager (ή όποιος έχει
 * ρητά το «Αναθέτει» στα δικαιώματά του). Ο Sales Agent αναλαμβάνει μόνο για τον εαυτό του.
 */
export function canAssignOthers(p: Who): boolean {
  if (p.role === 'admin' || p.role === 'management') return effectiveCan(p.role, p.moduleAccess ?? [], 'leads', 'assign', p.permissions ?? null);
  if (p.role === 'sales') return false;
  return !!p.permissions && effectiveCan(p.role, p.moduleAccess ?? [], 'leads', 'assign', p.permissions);
}

export const CLOSED_STATUSES = ['won', 'lost', 'nurture', 'no_response', 'retargeting', 'reactivation'];

/** Ένα νέο lead (χωρίς υπεύθυνο) όπως το συμπλήρωσε ο πελάτης. */
export interface NewLead {
  id: string;
  createdAt: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  project: string | null;
  unit: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  timeline: string | null;
  message: string | null;
  status: string;
  /** Καμία καταγεγραμμένη επικοινωνία (κλήση, μήνυμα, κίνηση). */
  notContacted: boolean;
  isReturning: boolean;
}

export interface FollowUpItem {
  id: string;
  dueAt: string;
  note: string | null;
  type: string;
  leadId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  ownerId: string | null;
  ownerName: string | null;
  leadStatus: string | null;
}

export interface AgentStat {
  agentId: string;
  name: string;
  assigned: number;
  contacted: number;
  viewings: number;
  won: number;
  notes: number;
  activitiesDone: number;
  overdue: number;
  /** Διάμεσος χρόνος πρώτης επαφής σε λεπτά (null = χωρίς δεδομένα). */
  responseMin: number | null;
  /** Κόστος των leads του (από «Κόστος ανά πηγή»), null όταν δεν υπάρχουν κόστη. */
  cost: number | null;
}

export interface SourceCost { id: string; source: string; month: string; amount: number }

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

/** «Σήμερα» / «Χθες» / ημερομηνία — το κλειδί ομάδας ανά ημέρα άφιξης. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ανατεθειμένα leads — ποιος πήρε ποιο lead και πότε (για Owner / Manager). */
export interface AssignedLeadRow {
  id: string; name: string | null; source: string | null; status: string;
  assignedTo: string | null; assignedToName: string | null;
  assignedBy: string | null; assignedByName: string | null;
  assignedAt: string | null; createdAt: string; contacted: boolean;
}
