/**
 * Tasks (όπως στο FitnessCRM): κάθε γραμμή είναι μια εργασία με πρόοδο «x από N».
 *  - Λίστα κλήσεων: N = επαφές της λίστας, x = όσες κλήθηκαν.
 *  - Εργασία ομάδας (ίδια εργασία σε πολλά άτομα): N = άτομα, x = όσοι την ολοκλήρωσαν.
 *  - Απλή εργασία: 0 ή 1 από 1.
 * Client-safe.
 */

export type BoardStatus = 'open' | 'progress' | 'done' | 'overdue';
export type BoardKind = 'call' | 'task';

export interface BoardMember { taskId: string; userId: string; name: string; done: boolean; outcome: string | null }

export interface BoardRow {
  key: string;
  kind: BoardKind;
  /** Λίστα κλήσεων: id λίστας. Εργασία: id της πρώτης γραμμής του group. */
  id: string;
  groupId: string | null;
  title: string;
  description: string | null;
  list: string | null;
  source: string | null;
  priority: string;
  deadline: string | null;
  done: number;
  total: number;
  status: BoardStatus;
  assigneeIds: string[];
  assignees: string[];
  createdBy: string | null;
  creator: string | null;
  createdAt: string;
  href: string | null;
  members: BoardMember[];
}

export interface CallItem { id: string; contactId: string | null; name: string; phone: string | null; email: string | null; done: boolean; outcome: string | null; doneAt: string | null }

export const STATUS_EL: Record<BoardStatus, string> = { open: 'Ανοιχτή', progress: 'Σε εξέλιξη', done: 'Ολοκληρώθηκε', overdue: 'Καθυστερεί' };
export const PRIORITY_EL: Record<string, string> = { low: 'Χαμηλή', normal: 'Κανονική', high: 'Υψηλή', urgent: 'Επείγον' };

/** Γρήγορα αποτελέσματα κλήσης. */
export const CALL_OUTCOMES = ['Απάντησε', 'Δεν απάντησε', 'Ενδιαφέρεται', 'Κλείστηκε viewing', 'Να ξανακληθεί', 'Δεν ενδιαφέρεται', 'Λάθος αριθμός'];

export function boardStatus(done: number, total: number, deadline: string | null, now = Date.now()): BoardStatus {
  if (total > 0 && done >= total) return 'done';
  if (deadline && Date.parse(deadline) < now) return 'overdue';
  return done > 0 ? 'progress' : 'open';
}

/** Πηγές για νέα λίστα κλήσεων. */
export type CallSource =
  | { kind: 'report'; id: string }
  | { kind: 'group'; name: string }
  | { kind: 'preset'; key: string }
  | { kind: 'ids'; ids: string[]; label: string };

export const PRESETS: [string, string][] = [
  ['stale_leads', 'Ανοιχτά leads χωρίς επαφή 14+ ημέρες'],
  ['new_leads', 'Νέα leads (7 ημέρες) χωρίς πρώτη απάντηση'],
  ['overdue_payments', 'Αγοραστές με ληξιπρόθεσμη δόση'],
  ['homeowners', 'Όλοι οι ιδιοκτήτες μονάδων'],
];
