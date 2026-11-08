import { NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/auth';
import { exportAllZip } from '@/lib/gdpr';
import { logActivity } from '@/lib/activity';
import { mfaSatisfied } from '@/lib/mfa';
import { getOrgSettingsRaw } from '@/lib/org-settings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Settings → GDPR & δεδομένα: all company data as CSV files in a ZIP. Admin only. */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await mfaSatisfied((await getOrgSettingsRaw()).security.trustedDevices))) return NextResponse.json({ error: 'Χρειάζεται ο κωδικός μίας χρήσης (2FA).' }, { status: 401 });
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Μόνο ο admin.' }, { status: 403 });
  const { zip, tables } = await exportAllZip();
  await logActivity({ entityType: 'org_settings', entityId: 'org', action: 'gdpr_full_export', metadata: { tables: tables.length } });
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="oramira-export-${day}.zip"`,
      'cache-control': 'no-store',
    },
  });
}
