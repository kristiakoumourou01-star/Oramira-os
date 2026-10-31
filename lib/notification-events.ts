/**
 * Every notification the system sends, by key — the rows of Settings →
 * Ειδοποιήσεις. Client-safe. `who` describes the recipients (decided by the
 * feature); the admin chooses the channels per event.
 */
export interface NotifEventDef {
  key: string;
  label: string;
  who: string;
  group: 'Πωλήσεις' | 'Έργα & πελάτες' | 'Οικονομικά' | 'Ομάδα & HR' | 'Μηνύματα';
  /** Default channels. */
  inApp: boolean;
  email: boolean;
  /** Important enough to go out even during quiet hours (SMS/push). */
  urgent?: boolean;
}

export const NOTIF_EVENTS: NotifEventDef[] = [
  { key: 'new_lead', label: 'Νέο lead', who: 'Ο υπεύθυνος πωλητής', group: 'Πωλήσεις', inApp: true, email: true, urgent: true },
  { key: 'lead_assigned', label: 'Ανάθεση lead', who: 'Ο πωλητής που το παίρνει', group: 'Πωλήσεις', inApp: true, email: false },
  { key: 'lead_unanswered', label: 'Lead χωρίς απάντηση', who: 'Πωλητές και managers', group: 'Πωλήσεις', inApp: true, email: true, urgent: true },
  { key: 'lead_digest', label: 'Ημερήσια σύνοψη leads', who: 'Πωλητές (τα δικά τους) και managers', group: 'Πωλήσεις', inApp: true, email: true },
  { key: 'viewing_assigned', label: 'Νέα προβολή', who: 'Ο πωλητής της προβολής', group: 'Πωλήσεις', inApp: true, email: true },
  { key: 'reservation_expired', label: 'Κράτηση έληξε', who: 'Ομάδα πωλήσεων', group: 'Πωλήσεις', inApp: true, email: false },
  { key: 'payment_overdue', label: 'Καθυστερημένη πληρωμή', who: 'Ομάδα (οικονομικά)', group: 'Οικονομικά', inApp: true, email: true, urgent: true },
  { key: 'contractor_payment', label: 'Πληρωμή εργολάβου', who: 'Οικονομικά', group: 'Οικονομικά', inApp: true, email: false },
  { key: 'vat_deadline', label: 'Προθεσμία ΦΠΑ', who: 'Οικονομικά', group: 'Οικονομικά', inApp: true, email: true },
  { key: 'warranty_expiring', label: 'Εγγύηση λήγει', who: 'Ομάδα', group: 'Έργα & πελάτες', inApp: true, email: false },
  { key: 'maintenance_escalation', label: 'Συντήρηση σε καθυστέρηση', who: 'Property management', group: 'Έργα & πελάτες', inApp: true, email: true },
  { key: 'owner_checkin', label: 'Επικοινωνία με ιδιοκτήτη / επιθεώρηση', who: 'Property management', group: 'Έργα & πελάτες', inApp: true, email: false },
  { key: 'construction_update', label: 'Νέα ενημέρωση κατασκευής', who: 'Οι αγοραστές των μονάδων', group: 'Έργα & πελάτες', inApp: true, email: true },
  { key: 'contract_expiring', label: 'Σύμβαση υπαλλήλου λήγει', who: 'Admins', group: 'Ομάδα & HR', inApp: true, email: true },
  { key: 'probation_ending', label: 'Τέλος δοκιμαστικής περιόδου', who: 'Admins', group: 'Ομάδα & HR', inApp: true, email: true },
  { key: 'payroll_deadline', label: 'Προθεσμία μισθοδοσίας', who: 'Admins', group: 'Ομάδα & HR', inApp: true, email: true },
  { key: 'leave_decision', label: 'Απάντηση σε αίτημα άδειας', who: 'Ο υπάλληλος', group: 'Ομάδα & HR', inApp: true, email: true },
  { key: 'payslip_ready', label: 'Payslip διαθέσιμο', who: 'Ο υπάλληλος', group: 'Ομάδα & HR', inApp: true, email: true },
  { key: 'commission_paid', label: 'Προμήθεια πληρώθηκε', who: 'Ο πωλητής', group: 'Ομάδα & HR', inApp: true, email: false },
  { key: 'message_received', label: 'Νέο μήνυμα', who: 'Ο παραλήπτης', group: 'Μηνύματα', inApp: true, email: false },
];

export type NotifEventKey = (typeof NOTIF_EVENTS)[number]['key'];

/** Is it quiet time now (Europe/Nicosia)? Handles ranges over midnight (21:00–08:30). */
export function isQuietNow(from: string, to: string, now = new Date()): boolean {
  const toMin = (t: string) => { const [h, m] = (t || '').split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : NaN; };
  const f = toMin(from); const t = toMin(to);
  if (!Number.isFinite(f) || !Number.isFinite(t) || f === t) return false;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Nicosia', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const cur = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) * 60 + Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return f < t ? cur >= f && cur < t : cur >= f || cur < t;
}
