/** Client-safe types for @/lib/customers (the server reads stay there). */

export type CustomerType = 'buyer' | 'investor' | 'homeowner';

export interface CustomerRow {
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  types: CustomerType[];
  buyerType: string | null;
  language: string | null;
  source: string | null;
  createdAt: string;
  contractValue: number; // sum of non-cancelled contract totals
  paid: number;          // sum of recorded payments
  balance: number;       // contractValue - paid (never negative)
  units: number;         // distinct units under contract
  reservations: number;  // active reservations
  tags: string[];        // Settings → Tags (migration 0055)
  groups: string[];
}

export interface CustomerLedger {
  rows: CustomerRow[];
  totals: { count: number; contractValue: number; paid: number; balance: number };
}
