import { getOrgSettings } from '@/lib/org-settings';

/**
 * Settings → Πεδία πελατών → «Νέοι πελάτες ξεκινούν με συγκατάθεση». Μόνο για
 * επαφή που μόλις δημιουργήθηκε (τα τελευταία 2 λεπτά) και δεν έχει ήδη
 * δηλώσει επιλογή — ποτέ δεν αλλάζει την απόφαση υπάρχοντος πελάτη.
 */
export async function applyOptInDefault(db: any, contactId: string | null | undefined): Promise<void> {
  if (!contactId) return;
  try {
    const { fields } = await getOrgSettings();
    if (!fields.optInDefault) return;
    const since = new Date(Date.now() - 2 * 60_000).toISOString();
    await db.from('contacts').update({ marketing_opt_in: true, marketing_opt_in_at: new Date().toISOString() })
      .eq('id', contactId).is('marketing_opt_in_at', null).gte('created_at', since);
  } catch { /* η συγκατάθεση είναι προαιρετική — δεν σταματά τη δημιουργία */ }
}
