/** Ιστορικό μονάδας — τύποι και ετικέτες που χρησιμοποιούνται και στον browser. */

export type HistoryKind =
  | 'created' | 'reservation' | 'reservation_end' | 'contract' | 'contract_signed' | 'payment'
  | 'owner' | 'owner_removed' | 'tenancy_start' | 'tenancy_end' | 'handover'
  | 'ticket' | 'ticket_resolved' | 'charge' | 'charge_paid' | 'document' | 'status';

export interface HistoryEvent {
  id: string;
  at: string;
  kind: HistoryKind;
  /** Ελληνική ετικέτα του συμβάντος (μεταφράζεται). */
  title: string;
  /** Δεύτερη ελληνική ετικέτα (π.χ. η νέα κατάσταση) — μεταφράζεται. */
  sub?: string | null;
  /** Πρόσωπο (όνομα πελάτη) — δεδομένα χρήστη, δεν μεταφράζονται. */
  person?: string | null;
  personId?: string | null;
  /** Ελεύθερο κείμενο χρήστη (τίτλος αιτήματος, όνομα εγγράφου). */
  detail?: string | null;
  amount?: number | null;
}

export interface OwnerPeriod { id: string; contactId: string | null; name: string | null; from: string | null; to: string | null; kind: string | null; price: number | null; note: string | null }
export interface Tenancy { id: string; tenantContactId: string | null; tenantName: string | null; startDate: string | null; endDate: string | null; monthlyRent: number | null; deposit: number | null; status: string; notes: string | null }
export interface Charge { id: string; kind: string; description: string | null; amount: number; status: string; dueDate: string | null; periodYear: number | null; createdAt: string; paidAt: string | null; ticketId: string | null; contactName: string | null }

export interface UnitHistory {
  events: HistoryEvent[];
  owners: OwnerPeriod[];
  currentOwner: { id: string; name: string | null } | null;
  tenancies: Tenancy[];
  charges: Charge[];
  annualFee: number | null;
  occupancy: string | null;
  /** false όταν το migration 0095 δεν έχει εφαρμοστεί ακόμη. */
  ready: boolean;
}

export const OWNER_KIND: Record<string, string> = { sale: 'Πώληση', resale: 'Μεταπώληση', transfer: 'Μεταβίβαση', inheritance: 'Κληρονομιά', removed: 'Αφαίρεση ιδιοκτήτη' };
export const OCCUPANCY: Record<string, string> = { owner_occupied: 'Ιδιοκατοίκηση', rented: 'Ενοικιασμένο', vacant: 'Κενό', holiday_home: 'Εξοχικό' };
export const TENANCY_STATUS: Record<string, string> = { active: 'Ενεργή', planned: 'Προγραμματισμένη', ended: 'Έληξε' };
export const CHARGE_KIND: Record<string, string> = { service: 'Υπηρεσία / επισκευή', maintenance_fee: 'Ετήσια συντήρηση', other: 'Άλλο' };
export const CHARGE_STATUS: Record<string, string> = { pending: 'Εκκρεμεί', paid: 'Πληρώθηκε', cancelled: 'Ακυρώθηκε' };
