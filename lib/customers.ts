import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Unified customer ledger.
 *
 * One row per contact who is actually a customer — a buyer, investor, or
 * homeowner, or anyone holding a contract/reservation — with their money rolled
 * up from the contract → payment chain: total committed value, total collected,
 * balance, units, and reservations. This is the aggregation behind the
 * Customers workspace, where staff filter the book of business by value, type
 * and recency. Pure read; resilient (missing money tables degrade to zeroes so
 * the list still renders the people).
 */

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
}

export interface CustomerLedger {
  rows: CustomerRow[];
  totals: { count: number; contractValue: number; paid: number; balance: number };
}

export async function getCustomers(): Promise<CustomerLedger> {
  const empty: CustomerLedger = { rows: [], totals: { count: 0, contractValue: 0, paid: 0, balance: 0 } };
  try {
    const supabase = await createSupabaseServerClient();

    const [{ data: contacts }, { data: contracts }, { data: payments }, { data: reservations }] = await Promise.all([
      supabase
        .from('contacts')
        .select('id, full_name, email, phone, buyer_type, preferred_language, first_touch_source, is_buyer, is_investor, is_homeowner, created_at'),
      supabase.from('contracts').select('id, buyer_contact_id, unit_id, total_price, status'),
      supabase.from('payments').select('contract_id, amount_paid'),
      supabase.from('reservations').select('buyer_contact_id, status'),
    ]);

    if (!contacts) return empty;

    // contract_id → contact, for attributing payments.
    const contractToContact = new Map<string, string>();
    const agg = new Map<string, { value: number; units: Set<string>; reservations: number; paid: number }>();
    const ensure = (cid: string) => {
      let a = agg.get(cid);
      if (!a) { a = { value: 0, units: new Set(), reservations: 0, paid: 0 }; agg.set(cid, a); }
      return a;
    };

    for (const c of contracts ?? []) {
      if (!c.buyer_contact_id) continue;
      contractToContact.set(c.id, c.buyer_contact_id);
      if (c.status === 'cancelled') continue;
      const a = ensure(c.buyer_contact_id);
      a.value += Number(c.total_price ?? 0);
      if (c.unit_id) a.units.add(c.unit_id);
    }
    for (const p of payments ?? []) {
      const cid = contractToContact.get(p.contract_id);
      if (!cid) continue;
      ensure(cid).paid += Number(p.amount_paid ?? 0);
    }
    for (const r of reservations ?? []) {
      if (!r.buyer_contact_id) continue;
      if (r.status === 'cancelled' || r.status === 'expired') continue;
      ensure(r.buyer_contact_id).reservations += 1;
    }

    const rows: CustomerRow[] = [];
    for (const c of contacts as any[]) {
      const types: CustomerType[] = [];
      if (c.is_buyer) types.push('buyer');
      if (c.is_investor) types.push('investor');
      if (c.is_homeowner) types.push('homeowner');
      const a = agg.get(c.id);
      // A customer = flagged as one, or holds any contract/reservation.
      if (types.length === 0 && !a) continue;

      const value = a?.value ?? 0;
      const paid = a?.paid ?? 0;
      rows.push({
        contactId: c.id,
        name: c.full_name ?? 'Unnamed',
        email: c.email ?? null,
        phone: c.phone ?? null,
        types,
        buyerType: c.buyer_type ?? null,
        language: c.preferred_language ?? null,
        source: c.first_touch_source ?? null,
        createdAt: c.created_at,
        contractValue: value,
        paid,
        balance: Math.max(0, value - paid),
        units: a?.units.size ?? 0,
        reservations: a?.reservations ?? 0,
      });
    }

    rows.sort((x, y) => y.contractValue - x.contractValue || x.name.localeCompare(y.name));

    const totals = rows.reduce(
      (t, r) => ({ count: t.count + 1, contractValue: t.contractValue + r.contractValue, paid: t.paid + r.paid, balance: t.balance + r.balance }),
      { count: 0, contractValue: 0, paid: 0, balance: 0 },
    );

    return { rows, totals };
  } catch {
    return empty;
  }
}
