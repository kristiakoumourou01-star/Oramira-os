import { requireRole } from '@/lib/auth';
import { loadLeadTeam } from '@/lib/lead-automation';
import { headers } from 'next/headers';
import { getBranding } from '@/lib/branding';
import { getOrgSettings } from '@/lib/org-settings';
import { isCalendarConnected } from '@/lib/calendar-sync';
import { listSeries } from '@/lib/invoices';
import { recentErasures, gdprMissing } from '@/lib/gdpr';
import { SettingsScreen } from '@/components/admin/SettingsScreen';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMfaStatus } from '@/lib/mfa';
import type { StartStep } from '@/components/admin/GettingStarted';
import { getSection, type SettingsKey } from '@/lib/settings-sections';

export const dynamic = 'force-dynamic';

/**
 * Settings — the agency control area, structured exactly like the prototype:
 * a left sub-nav (Account / Work / Money / Connections) switching sections.
 * Appearance and Business details are fully wired; the rest arrive section by
 * section on the same org_settings backend.
 */
export default async function SettingsPage({ searchParams }: { searchParams: { section?: string } }) {
  const profile = await requireRole(['admin']);
  const initialSection = getSection(searchParams.section).key as SettingsKey;
  const isGdpr = initialSection === 'gdpr';
  const [branding, settings, conn, docSeries, erasures, gdprMiss] = await Promise.all([
    getBranding(), getOrgSettings(), isCalendarConnected(profile.id),
    initialSection === 'invoices' ? listSeries() : Promise.resolve({ series: [], missing: false }),
    isGdpr ? recentErasures() : Promise.resolve([]),
    isGdpr ? gdprMissing() : Promise.resolve(false),
  ]);
  const team = initialSection === 'leads' ? await loadLeadTeam() : [];

  // «Πρώτα βήματα» — only on the landing section.
  let startSteps: StartStep[] = [];
  if (initialSection === 'business') {
    const supabase = await createSupabaseServerClient();
    const [{ data: raw }, { count: staff }, mfa] = await Promise.all([
      supabase.from('org_settings').select('data').eq('id', 'org').maybeSingle(),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['admin', 'sales', 'management', 'finance', 'construction', 'viewer']),
      getMfaStatus(),
    ]);
    const saved = (k: string) => !!((raw as any)?.data && (raw as any).data[k] !== undefined);
    const b = settings.business;
    startSteps = [
      { key: 'business', label: 'Στοιχεία εταιρείας', hint: 'ΑΦΜ, αρ. εγγραφής, γραφείο — μπαίνουν στα τιμολόγια.', href: '/settings?section=business', done: !!(b.vatNo && b.offices.length) },
      { key: 'logo', label: 'Logo και χρώματα', hint: 'Φαίνονται στο μενού, στη σύνδεση και στα παραστατικά.', href: '/settings?section=appearance', done: !!branding.logoUrl },
      { key: 'users', label: 'Προσθήκη της ομάδας', hint: 'Λογαριασμοί για όσους δουλεύουν στο σύστημα.', href: '/settings/users', done: (staff ?? 0) > 1 },
      { key: 'mfa', label: 'Κωδικός μίας χρήσης (2FA)', hint: 'Ενεργοποιήστε τον για εσάς και, αν θέλετε, για όλους.', href: '/account/security', done: mfa.hasFactor || settings.security.otp },
      { key: 'invoices', label: 'Τιμολόγια: IBAN και αρίθμηση', hint: 'Τραπεζικά στοιχεία και από ποιον αριθμό ξεκινάτε.', href: '/settings?section=invoices', done: !!settings.invoices.bankDetails },
      { key: 'pipelines', label: 'Στάδια pipeline και πηγές leads', hint: 'Ελέγξτε ότι ταιριάζουν με τον τρόπο που πουλάτε.', href: '/settings?section=pipelines', done: saved('pipelines') },
      { key: 'gdpr', label: 'GDPR: συγκατάθεση και διατήρηση', hint: 'Κείμενα για τις φόρμες και πόσο κρατάτε τα leads.', href: '/settings?section=gdpr', done: saved('gdpr') },
      { key: 'portal', label: 'Portals πελατών', hint: 'Email υποστήριξης, συχνές ερωτήσεις, όροι χρήσης.', href: '/settings?section=portals', done: !!settings.portal.helpEmail },
    ];
  }

  return (
    <SettingsScreen
      startSteps={startSteps}
      key={initialSection}
      initialSection={initialSection}
      branding={branding}
      company={(() => {
        const main = settings.business.offices.find((o) => o.main) ?? settings.business.offices[0];
        return {
          name: branding.companyName, logo: settings.appearance.logoOnLight ?? branding.logoUrl,
          address: main?.address ?? '', phone: main?.phone ?? '', vatNo: settings.business.vatNo,
          regNo: settings.business.registrationNo, email: settings.business.invoiceEmail, footer: settings.business.footer,
        };
      })()}
      settings={settings}
      agencyName={branding.companyName}
      plan="Professional"
      canEdit={profile.role === 'admin'}
      googleConnected={conn.connected}
      googleConfigured={conn.configured}
      series={docSeries.series}
      seriesMissing={docSeries.missing}
      erasures={erasures}
      gdprMissing={gdprMiss}
      team={team}
      currentIp={((await headers()).get('x-forwarded-for') ?? '').split(',')[0].trim() || null}
    />
  );
}
