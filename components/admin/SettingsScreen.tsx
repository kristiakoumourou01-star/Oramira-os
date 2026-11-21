'use client';

import { Lock as LockIcon, Check } from 'lucide-react';
import { SETTINGS_SECTIONS, type SettingsKey, type SettingsSection } from '@/lib/settings-sections';
import { BrandingForm } from '@/components/admin/BrandingForm';
import { BusinessSection } from '@/components/admin/BusinessSection';
import {
  NotificationsSection, SecuritySection, TagsSection,
} from '@/components/admin/SettingsSections';
import { InvoicesSettings } from '@/components/admin/InvoicesSettings';
import { GdprSettings } from '@/components/admin/GdprSettings';
import { PortalSettingsSection } from '@/components/admin/PortalSettingsSection';
import type { CompanyInfo } from '@/components/admin/ReceiptPreview';
import { GettingStarted, type StartStep } from '@/components/admin/GettingStarted';
import { CompanyLocaleDefault } from '@/components/admin/CompanyLocaleDefault';
import { UnitFormsEditor } from '@/components/admin/UnitFormsEditor';
import { WatermarkSettings } from '@/components/admin/WatermarkSettings';
import { ReservationSettingsForm } from '@/components/admin/ReservationSettingsForm';
import { AmlSettingsForm } from '@/components/admin/AmlSettingsForm';
import { PipelineSettingsEditor } from '@/components/admin/PipelineSettingsEditor';
import { LeadAutomationForm } from '@/components/admin/LeadAutomationForm';
import type { TeamMember } from '@/lib/lead-automation-shared';
import type { DocSeries } from '@/lib/invoices-shared';
import { MenuEditor } from '@/components/admin/MenuEditor';
import { DashboardEditor } from '@/components/admin/DashboardEditor';
import { AppearanceExtras } from '@/components/admin/AppearanceExtras';
import { AppearanceBasics } from '@/components/admin/AppearanceBasics';
import { LivePreview } from '@/components/admin/LivePreview';
import { DepartmentsSettings } from '@/components/admin/DepartmentsSettings';
import { CustomerFieldsSettings } from '@/components/admin/CustomerFieldsSettings';
import { CommunicationSettingsForm } from '@/components/admin/CommunicationSettings';
import type { LocalePrefs } from '@/lib/locale-shared';
import { GoogleCalendarConnect } from '@/components/dashboard/GoogleCalendarConnect';
import type { Branding } from '@/lib/branding-shared';
import type { OrgSettings } from '@/lib/org-settings-shared';
import type { ExtraSettings } from '@/lib/settings-extra-shared';
import { SignInCodeSection, ReceiptExtras, PaymentsSection, AtlasSection, SessionCard } from '@/components/admin/ExtraSettings';


export function SettingsScreen({
  initialSection,
  branding,
  settings,
  agencyName,
  plan: _plan,
  canEdit,
  googleConnected,
  googleConfigured,
  currentIp = null,
  series = [],
  seriesMissing = false,
  erasures = [],
  gdprMissing = false,
  company,
  startSteps = [],
  team = [],
  myLocale = null,
  emailConnected = false,
  extra,
  payConnected = {},
  aiConnected = false,
}: {
  initialSection: SettingsKey;
  branding: Branding;
  settings: OrgSettings;
  agencyName: string;
  plan: string;
  canEdit: boolean;
  googleConnected: boolean;
  googleConfigured: boolean;
  currentIp?: string | null;
  series?: DocSeries[];
  seriesMissing?: boolean;
  erasures?: { id: string; mode: string; reason: string | null; erased_at: string; by: string | null }[];
  gdprMissing?: boolean;
  team?: TeamMember[];
  company?: CompanyInfo;
  startSteps?: StartStep[];
  myLocale?: LocalePrefs | null;
  emailConnected?: boolean;
  extra: ExtraSettings;
  payConnected?: Record<string, boolean>;
  aiConnected?: boolean;
}) {
  // The section comes from the URL (?section=…) — the page is keyed by it, so
  // switching in the Settings menu re-renders with the new section.
  const section = SETTINGS_SECTIONS.find((s) => s.key === initialSection) ?? SETTINGS_SECTIONS[0];

  return (
    <div className="space-y-5">
      {!canEdit && (
        <p className="flex items-center gap-2 rounded-md bg-champagne-50 px-4 py-2 text-sm text-champagne-600">
          <LockIcon size={12} /> Μόνο ο admin αλλάζει τις ρυθμίσεις. Τις βλέπετε μόνο για ανάγνωση.
        </p>
      )}

      {canEdit && startSteps.length > 0 && <GettingStarted steps={startSteps} />}

      <div>
        {/* Content */}
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-2xl text-charcoal">{section.label}</h2>
            <p className="text-sm text-charcoal-600/70">{section.subtitle}</p>
          </div>

          {section.key === 'appearance' ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-5">
              <AppearanceBasics primary={branding.colorPrimary} secondary={branding.colorSecondary} logoUrl={branding.logoUrl} layout={settings.layout} lang={myLocale?.lang ?? settings.locale.lang} num={myLocale?.num ?? settings.locale.num} canEdit={canEdit} />
              <details className="group rounded-xl border border-stone-line bg-white/60">
                <summary className="cursor-pointer list-none px-5 py-4 font-display text-xl text-charcoal">
                  Περισσότερες ρυθμίσεις εμφάνισης <span className="font-sans text-sm text-charcoal-600/60">— γραμματοσειρές, όλα τα χρώματα, χρώμα μενού, γωνίες, favicon, γλώσσα εταιρείας</span>
                </summary>
                <div className="space-y-5 px-5 pb-5">
                  <BrandingForm initial={branding} />
                  <AppearanceExtras logoUrl={branding.logoUrl} primary={branding.colorPrimary} initial={settings.appearance} canEdit={canEdit} />
                  <CompanyLocaleDefault initial={settings.locale} canEdit={canEdit} />
                </div>
              </details>
            </div>
            <div className="z-10 xl:sticky xl:top-[72px] xl:self-start"><LivePreview branding={branding} logoUrl={branding.logoUrl} sidebar={{ style: settings.appearance.sidebarStyle, custom: settings.appearance.sidebarColor }} /></div>
            </div>
          ) : section.key === 'business' ? (
            <BusinessSection initial={settings.business} companyName={branding.companyName || agencyName} canEdit={canEdit} logoUrl={branding.logoUrl} colorPrimary={branding.colorPrimary} colorSecondary={branding.colorSecondary} />
          ) : section.key === 'vats' ? (
            <InvoicesSettings part="vats" initial={settings.invoices} series={series} seriesMissing={seriesMissing} canEdit={canEdit} company={company} />
          ) : section.key === 'receipts' ? (
            <div className="space-y-6">
              <ReceiptExtras initial={extra} canEdit={canEdit} />
              <InvoicesSettings part="receipts" initial={settings.invoices} series={series} seriesMissing={seriesMissing} canEdit={canEdit} company={company} />
            </div>
          ) : section.key === 'privacy' ? (
            <div className="space-y-6">
              <SessionCard isAdmin={canEdit} />
              <SecuritySection initial={settings.security} canEdit={canEdit} currentIp={currentIp} />
              <GdprSettings initial={settings.gdpr} canEdit={canEdit} erasures={erasures} missing={gdprMissing} />
              <AmlSettingsForm initial={settings.aml} canEdit={canEdit} />
            </div>
          ) : section.key === 'otp' ? (
            <SignInCodeSection initial={extra} canEdit={canEdit} />
          ) : section.key === 'payments' ? (
            <PaymentsSection initial={extra} canEdit={canEdit} connected={payConnected} />
          ) : section.key === 'atlas' ? (
            <AtlasSection initial={extra} canEdit={canEdit} connected={aiConnected} />
          ) : section.key === 'notifications' ? (
            <NotificationsSection initial={settings.notifications} canEdit={canEdit} />
          ) : section.key === 'security' ? (
            <SecuritySection initial={settings.security} canEdit={canEdit} currentIp={currentIp} />
          ) : section.key === 'tags' ? (
            <TagsSection initial={settings.tags} canEdit={canEdit} />
          ) : section.key === 'customerFields' ? (
            <CustomerFieldsSettings initial={settings.fields} tags={settings.tags} canEdit={canEdit} />
          ) : section.key === 'communication' ? (
            <div className="space-y-6">
              <CommunicationSettingsForm initial={settings.communication} canEdit={canEdit} emailConnected={emailConnected} />
              <IntegrationsSection googleConnected={googleConnected} googleConfigured={googleConfigured} />
            </div>
          ) : section.key === 'departments' ? (
            <DepartmentsSettings initial={settings.departments} canEdit={canEdit} />
          ) : section.key === 'unitforms' ? (
            <div className="space-y-4">
              <UnitFormsEditor initial={settings.unitForms} canEdit={canEdit} />
              <WatermarkSettings initial={settings.watermark} canEdit={canEdit} companyName={company?.name ?? agencyName} companyLogo={company?.logo ?? branding.logoUrl ?? null} />
            </div>
          ) : section.key === 'portals' ? (
            <PortalSettingsSection initial={settings.portal} canEdit={canEdit} />
          ) : section.key === 'pipelines' ? (
            <div className="space-y-4">
              <PipelineSettingsEditor initial={settings.pipelines} canEdit={canEdit} vatRates={settings.invoices.vatRates.map((r) => r.rate)} />
              <ReservationSettingsForm initial={settings.reservations} canEdit={canEdit} />
            </div>
          ) : section.key === 'leads' ? (
            <LeadAutomationForm initial={settings.leadAutomation} canEdit={canEdit} team={team} />
          ) : section.key === 'gdpr' ? (
            <div className="space-y-4">
              <GdprSettings initial={settings.gdpr} canEdit={canEdit} erasures={erasures} missing={gdprMissing} />
              <AmlSettingsForm initial={settings.aml} canEdit={canEdit} />
            </div>
          ) : section.key === 'layout' ? (
            <MenuEditor layout={settings.layout} menu={settings.menu} canEdit={canEdit} />
          ) : section.key === 'dashboard' ? (
            <DashboardEditor initial={settings.dashboard} roles={settings.roles} canEdit={canEdit} />
          ) : section.key === 'integrations' ? (
            <IntegrationsSection googleConnected={googleConnected} googleConfigured={googleConfigured} />
          ) : (
            <Scaffold section={section} />
          )}
        </div>
      </div>
    </div>
  );
}

/* Ημερολόγιο Google — συγχρονισμός ραντεβού και ξεναγήσεων. */
function IntegrationsSection({ googleConnected, googleConfigured }: { googleConnected: boolean; googleConfigured: boolean }) {
  return (
    <section className="rounded-2xl border border-stone-line bg-white p-5 shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-charcoal">Google Calendar</h3>
          <p className="text-sm text-charcoal-600/75">Συγχρονισμός ραντεβού και ξεναγήσεων με το ημερολόγιο κάθε συνεργάτη.</p>
        </div>
        <GoogleCalendarConnect connected={googleConnected} configured={googleConfigured} />
      </div>
    </section>
  );
}

function Scaffold({ section }: { section: SettingsSection }) {
  return (
    <div className="panel p-6">
      <p className="mb-3 text-sm text-charcoal-600/80">Αυτή η ενότητα θα περιλαμβάνει:</p>
      <ul className="space-y-2">
        {section.outline.map((o) => (
          <li key={o} className="flex items-start gap-2 text-sm text-charcoal">
            <Check size={15} className="mt-0.5 shrink-0 text-olive" strokeWidth={2} /> {o}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-charcoal-600/50">Σχεδιασμός κατά το prototype — υλοποιείται σε επόμενη φάση.</p>
    </div>
  );
}
