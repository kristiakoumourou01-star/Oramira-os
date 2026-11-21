import 'server-only';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

/**
 * Σύνδεση πελάτη στην εφαρμογή με κωδικό: δέχεται και τον «προεπιλεγμένο
 * κωδικό» της καρτέλας πελάτη (migration 0093), για όταν δεν έρχεται το SMS /
 * email. Ο έλεγχος γίνεται μέσα στη βάση (bcrypt) — ο κωδικός δεν διαβάζεται ποτέ.
 * Όποια ροή σύνδεσης με κωδικό προστεθεί, καλεί αυτό πριν απορρίψει τον κωδικό.
 */
export async function verifyDefaultOtp(contactId: string, code: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(contactId ?? '') || !/^\d{4,8}$/.test((code ?? '').trim())) return false;
  try {
    const supabase = createSupabaseServiceRoleClient() as any;
    const { data, error } = await supabase.rpc('verify_contact_default_otp', { p_contact: contactId, p_code: code.trim() });
    return !error && data === true;
  } catch {
    return false;
  }
}
