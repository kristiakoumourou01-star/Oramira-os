import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentProfile, hasRight } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { exportContactData } from '@/lib/gdpr';
import { logActivity } from '@/lib/activity';
import { mfaSatisfied } from '@/lib/mfa';
import { getOrgSettingsRaw } from '@/lib/org-settings';

export const dynamic = 'force-dynamic';

/**
 * GDPR right of access: everything stored about one contact, as a JSON file.
 * Needs access to Πωλήσεις and the "Κάνει export" right (Settings → Ρόλοι).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await mfaSatisfied((await getOrgSettingsRaw()).security.trustedDevices))) return NextResponse.json({ error: 'Χρειάζεται ο κωδικός μίας χρήσης (2FA).' }, { status: 401 });
  if (!effectiveCan(profile.role, profile.moduleAccess, 'leads', 'view', profile.permissions) || !hasRight(profile, 'export_data')) {
    return NextResponse.json({ error: 'Δεν έχετε δικαίωμα export.' }, { status: 403 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const data = await exportContactData(params.id);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await logActivity({ entityType: 'contact', entityId: params.id, action: 'gdpr_exported', metadata: {} });
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="contact-${params.id.slice(0, 8)}-${day}.json"`,
      'cache-control': 'no-store',
    },
  });
}
