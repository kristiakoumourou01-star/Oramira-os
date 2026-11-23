/**
 * Χρώμα (tone) για τιμές κατάστασης/ρόλου/πηγής σε πίνακες.
 * Κοινό για server & client — χωρίς imports.
 */
export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'forest' | 'neutral';

const GREEN = ['active', 'paid', 'sent', 'won', 'completed', 'complete', 'done', 'approved', 'accepted', 'delivered', 'available', 'signed', 'success', 'succeeded', 'yes', 'true', 'acquired', 'closed_won', 'handed_over', 'rewarded', 'enabled', 'on', 'resolved',
  'ναι', 'ενεργός', 'ενεργό', 'ενεργή', 'ενεργοί', 'πληρώθηκε', 'εξοφλήθηκε', 'εξοφλημένο', 'στάλθηκε', 'ολοκληρώθηκε', 'ολοκληρωμένο', 'εγκρίθηκε', 'διαθέσιμο', 'διαθέσιμη', 'υπογράφηκε', 'κερδήθηκε', 'ανάληψη'];
const AMBER = ['pending', 'draft', 'scheduled', 'in_progress', 'in progress', 'reserved', 'waiting', 'partially_paid', 'partial', 'due', 'new', 'invited', 'probation', 'paused', 'on_hold', 'leave', 'medium', 'planning', 'planned', 'permitting', 'offer', 'under_offer',
  'σε αναμονή', 'εκκρεμεί', 'εκκρεμής', 'πρόχειρο', 'προγραμματισμένη', 'προγραμματισμένο', 'σε εξέλιξη', 'κρατημένο', 'δεσμευμένο', 'νέο', 'νέος', 'νέα', 'σε άδεια', 'σε παύση', 'μερικώς πληρωμένο', 'προσκλήθηκε', 'δοκιμαστική'];
const RED = ['terminated', 'lost', 'cancelled', 'canceled', 'failed', 'rejected', 'overdue', 'expired', 'archived', 'no', 'false', 'sold_out', 'blocked', 'high', 'urgent', 'closed_lost', 'disabled', 'off',
  'όχι', 'όχι ακόμη', 'απολύθηκε', 'τερματισμένος', 'ακυρώθηκε', 'ακυρωμένο', 'απέτυχε', 'απορρίφθηκε', 'ληξιπρόθεσμο', 'έληξε', 'χάθηκε', 'αρχειοθετημένο', 'υψηλή', 'επείγον', 'μπλοκαρισμένο'];
const BLUE = ['viewing', 'negotiating', 'negotiation', 'contacted', 'qualified', 'under_construction', 'construction', 'open', 'proposal', 'meeting', 'interested', 'assigned', 'in_review', 'review', 'low', 'selling',
  'ξενάγηση', 'διαπραγμάτευση', 'σε επαφή', 'επικοινωνήσαμε', 'κατάλληλος', 'υπό κατασκευή', 'ανοιχτή', 'ανοιχτό', 'πρόταση', 'ραντεβού', 'ανάθεση από', 'χαμηλή'];
const FOREST = ['sold', 'πωλήθηκε', 'πωλημένη', 'πωλημένο'];
const VIOLET = ['owner', 'admin', 'administrator', 'superadmin', 'super_admin', 'ιδιοκτήτης', 'ιδιοκτήτρια', 'διαχειριστής', 'διαχειρίστρια'];

const MAP = new Map<string, Tone>();
for (const [list, tone] of [[GREEN, 'green'], [AMBER, 'amber'], [RED, 'red'], [BLUE, 'blue'], [VIOLET, 'violet'], [FOREST, 'forest']] as const) {
  for (const k of list) MAP.set(k, tone);
}

/** Χρώμα για κλειδί ή ετικέτα (π.χ. 'active', 'Ενεργός', 'Σε αναμονή'). Άγνωστα → neutral. */
export function toneFor(key: string | null | undefined): Tone {
  if (key == null) return 'neutral';
  const k = String(key).trim().toLowerCase().replace(/\s+/g, ' ');
  return MAP.get(k) ?? MAP.get(k.replace(/[\s-]+/g, '_')) ?? 'neutral';
}
