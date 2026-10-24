'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Append an entry to a lead's negotiation history (offered / counter / agreed
 * price, payment terms, deposit, notes). Each call is a new immutable row, so
 * the full back-and-forth is preserved. Nudges the lead into the negotiating
 * stage when it's still earlier in the pipeline.
 */
export async function addNegotiation(params: {
  leadId: string;
  unitId?: string | null;
  offeredPrice?: number | null;
  counterOffer?: number | null;
  agreedPrice?: number | null;
  paymentTerms?: string | null;
  reservationDeposit?: number | null;
  notes?: string | null;
}) {
  const profile = await requirePermission('leads', 'edit');
  const supabase = await createSupabaseServerClient();

  await supabase.from('negotiations').insert({
    lead_id: params.leadId,
    unit_id: params.unitId ?? null,
    offered_price: params.offeredPrice ?? null,
    counter_offer: params.counterOffer ?? null,
    agreed_price: params.agreedPrice ?? null,
    payment_terms: params.paymentTerms ?? null,
    reservation_deposit: params.reservationDeposit ?? null,
    notes: params.notes ?? null,
    created_by: profile.id,
  });

  // Advance the pipeline to negotiating if it's still upstream of it.
  const { data: lead } = await supabase.from('leads').select('status').eq('id', params.leadId).maybeSingle();
  const upstream = ['new', 'contacted', 'engaged', 'qualified', 'waiting', 'viewing', 'offer'];
  if (lead && upstream.includes(lead.status)) {
    await supabase.from('leads').update({ status: 'negotiating' }).eq('id', params.leadId);
  }

  revalidatePath(`/crm/leads/${params.leadId}`);
}
