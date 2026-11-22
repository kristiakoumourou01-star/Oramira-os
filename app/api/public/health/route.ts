import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

/** Έλεγχος ότι η εφαρμογή και η βάση απαντούν (το χρησιμοποιεί και το καθημερινό αντίγραφο ασφαλείας ώστε η βάση να μην «παγώνει»). */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const svc = createSupabaseServiceRoleClient();
    const { error } = await svc.from('org_settings').select('id', { count: 'exact', head: true });
    return NextResponse.json({ ok: !error });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
