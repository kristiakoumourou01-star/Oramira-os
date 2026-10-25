'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Home, Brush, LayoutGrid, Grid3x3, Euro, Bell, Lock, Tag, Workflow, Plug, Database, Lock as LockIcon, Check } from 'lucide-react';
import { SETTINGS_SECTIONS, SETTINGS_GROUPS, type SettingsKey, type SettingsSection } from '@/lib/settings-sections';
import { BrandingForm } from '@/components/admin/BrandingForm';
import { BusinessSection } from '@/components/admin/BusinessSection';
import {
  InvoicesSection, NotificationsSection, SecuritySection, TagsSection,
  PipelinesSection, GdprSection, LayoutSection, DashboardSection,
} from '@/components/admin/SettingsSections';
import { GoogleCalendarConnect } from '@/components/dashboard/GoogleCalendarConnect';
import type { Branding } from '@/lib/branding-shared';
import type { OrgSettings } from '@/lib/org-settings-shared';

const ICON: Record<SettingsKey, any> = {
  business: Home, appearance: Brush, layout: LayoutGrid, dashboard: Grid3x3, invoices: Euro,
  notifications: Bell, security: Lock, tags: Tag, pipelines: Workflow, integrations: Plug, gdpr: Database,
};

export function SettingsScreen({
  initialSection,
  branding,
  settings,
  agencyName,
  plan,
  canEdit,
  googleConnected,
  googleConfigured,
}: {
  initialSection: SettingsKey;
  branding: Branding;
  settings: OrgSettings;
  agencyName: string;
  plan: string;
  canEdit: boolean;
  googleConnected: boolean;
  googleConfigured: boolean;
}) {
  const [sec, setSec] = useState<SettingsKey>(initialSection);
  const router = useRouter();
  const section = SETTINGS_SECTIONS.find((s) => s.key === sec) ?? SETTINGS_SECTIONS[0];

  const pick = (k: SettingsKey) => {
    setSec(k);
    router.replace(`/settings?section=${k}`, { scroll: false });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="panel flex flex-wrap items-center gap-3 p-5">
        <div>
          <p className="eyebrow mb-1">Admin</p>
          <h1 className="text-3xl">Settings</h1>
          <p className="text-sm text-charcoal-600/70">Company details, display, rules and connections for the whole agency.</p>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-charcoal-600/70">
          <span>Agency <strong className="text-charcoal">{agencyName}</strong></span>
          <span>Plan <strong className="text-charcoal">{plan}</strong></span>
          {!canEdit && <span className="flex items-center gap-1 text-champagne-600"><LockIcon size={12} /> Read-only</span>}
        </div>
      </div>

      {!canEdit && (
        <p className="rounded-md bg-champagne-50 px-4 py-2 text-sm text-champagne-600">Only owners and admins can change settings. You see them read-only.</p>
      )}

      <div className="grid gap-6 md:grid-cols-[230px_minmax(0,1fr)]">
        {/* Sub-nav */}
        <aside className="md:sticky md:top-5 md:self-start">
          <div className="panel space-y-4 p-3">
            {SETTINGS_GROUPS.map((g) => {
              const items = SETTINGS_SECTIONS.filter((s) => s.group === g);
              return (
                <div key={g}>
                  <p className="eyebrow mb-1.5 px-2">{g}</p>
                  <div className="space-y-0.5">
                    {items.map((s) => {
                      const Icon = ICON[s.key];
                      const active = s.key === sec;
                      return (
                        <button
                          key={s.key}
                          onClick={() => pick(s.key)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${active ? 'bg-forest/[0.07] font-medium text-forest' : 'text-charcoal-600 hover:bg-forest/5 hover:text-forest'}`}
                        >
                          <Icon size={15} strokeWidth={1.75} /> {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-2xl text-forest">{section.label}</h2>
            <p className="text-sm text-charcoal-600/70">{section.subtitle}</p>
          </div>

          {section.key === 'appearance' ? (
            <BrandingForm initial={branding} />
          ) : section.key === 'business' ? (
            <BusinessSection initial={settings.business} companyName={agencyName} canEdit={canEdit} />
          ) : section.key === 'invoices' ? (
            <InvoicesSection initial={settings.invoices} canEdit={canEdit} />
          ) : section.key === 'notifications' ? (
            <NotificationsSection initial={settings.notifications} canEdit={canEdit} />
          ) : section.key === 'security' ? (
            <SecuritySection initial={settings.security} canEdit={canEdit} />
          ) : section.key === 'tags' ? (
            <TagsSection initial={settings.tags} canEdit={canEdit} />
          ) : section.key === 'pipelines' ? (
            <PipelinesSection initial={settings.pipelines} canEdit={canEdit} />
          ) : section.key === 'gdpr' ? (
            <GdprSection initial={settings.gdpr} canEdit={canEdit} />
          ) : section.key === 'layout' ? (
            <LayoutSection initial={settings.layout} canEdit={canEdit} />
          ) : section.key === 'dashboard' ? (
            <DashboardSection initial={settings.dashboard} canEdit={canEdit} />
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

/* Integrations — Calendar is live (Google); the rest are faithful to the prototype. */
const INTEGRATIONS: { group: string; items: { name: string; desc: string; on: boolean }[] }[] = [
  { group: 'Payments', items: [{ name: 'Viva Wallet', desc: 'Cards on file, 3-D Secure, payouts to landlords.', on: false }, { name: 'SEPA direct debit', desc: 'Monthly rent by direct debit, mandate signed online.', on: false }] },
  { group: 'Messages', items: [{ name: 'SMS provider', desc: 'Bulk and single SMS.', on: false }, { name: 'Email provider', desc: 'Sends from your own domain.', on: false }, { name: 'WhatsApp Business', desc: 'Two-way chat with clients from the contact record.', on: false }] },
  { group: 'Documents and AI', items: [{ name: 'E-signature', desc: 'Sign mandates, reservations and leases online.', on: false }, { name: 'AI assistant', desc: 'Answers questions from your data and drafts listing texts.', on: false }] },
];

function IntegrationsSection({ googleConnected, googleConfigured }: { googleConnected: boolean; googleConfigured: boolean }) {
  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <p className="eyebrow mb-3">Calendar</p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-charcoal">Google Calendar</p>
            <p className="text-xs text-charcoal-600/60">Two-way sync of viewings & appointments with the agent&apos;s calendar.</p>
          </div>
          <GoogleCalendarConnect connected={googleConnected} configured={googleConfigured} />
        </div>
      </div>
      {INTEGRATIONS.map((grp) => (
        <div key={grp.group} className="panel p-5">
          <p className="eyebrow mb-3">{grp.group}</p>
          <div className="space-y-2.5">
            {grp.items.map((it) => (
              <div key={it.name} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-charcoal">{it.name}</p>
                  <p className="text-xs text-charcoal-600/60">{it.desc}</p>
                </div>
                <span className="badge-neutral">{it.on ? 'On' : 'Not connected'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
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
