/**
 * Settings sections — mirrors the Kyma Estates prototype's Settings area exactly
 * (same groups, same section labels and subtitles). Pure/client-safe so both the
 * nav and the section content can share one source of wording.
 *
 * Appearance is fully wired (lib/branding). The rest are faithful scaffolds for
 * now and get implemented section by section.
 */

export type SettingsKey =
  | 'business' | 'appearance' | 'layout' | 'dashboard' | 'invoices'
  | 'notifications' | 'security' | 'tags' | 'pipelines' | 'integrations' | 'gdpr';

export interface SettingsSection {
  key: SettingsKey;
  label: string;
  subtitle: string;
  group: 'Account' | 'Work' | 'Money' | 'Connections';
  /** true once the section is backed by real functionality. */
  ready?: boolean;
  /** Faithful outline of what the section contains (prototype wording). */
  outline: string[];
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { key: 'business', label: 'Business details', subtitle: 'Company, licence, offices, logo', group: 'Account', outline: ['Company name, registration no., VAT no.', 'Estate agent licence & registration council', 'Invoice email and website', 'Offices (address, phone, manager)', 'Document footer'] },
  { key: 'appearance', label: 'Appearance', subtitle: 'Colours, fonts, text size, boxes', group: 'Account', ready: true, outline: ['Logo & company name', 'Brand colours', 'Heading & body fonts', 'Content width & density'] },
  { key: 'layout', label: 'Layout', subtitle: 'Menu, sidebar, start screen, lists', group: 'Account', outline: ['Menu & sidebar arrangement', 'Start screen', 'Default list columns & sorting'] },
  { key: 'dashboard', label: 'Dashboard', subtitle: 'Choose and order the boxes', group: 'Account', outline: ['Pick which cards appear', 'Reorder the dashboard blocks', 'Show commissions / rankings'] },
  { key: 'invoices', label: 'Invoices and VAT', subtitle: 'VAT rates, numbering, receipt', group: 'Money', outline: ['VAT rates (19% standard, 9%, 5%, exempt)', 'Numbering series (INV-, RCT-, CN-)', 'Receipt logo / address / bank details', 'myDATA export'] },
  { key: 'notifications', label: 'Notifications', subtitle: 'Who gets told, and how', group: 'Work', outline: ['Events (new lead, viewing booked, payment failed…)', 'Who gets told (agent / manager / client)', 'Channels: in-app, push, email, SMS', 'Quiet hours'] },
  { key: 'security', label: 'Security', subtitle: 'Login, devices, passwords', group: 'Work', outline: ['Two-factor (OTP)', 'Trusted devices & session timeout', 'Password policy (length, symbols, expiry)', 'IP allow-list'] },
  { key: 'tags', label: 'Tags, groups and fields', subtitle: 'For contacts', group: 'Work', outline: ['Contact tags (Cash buyer, Investor, VIP…)', 'Saved groups / segments', 'Custom fields (type, required)'] },
  { key: 'pipelines', label: 'Pipelines and forms', subtitle: 'Stages, sources, listing forms', group: 'Work', outline: ['Pipeline stages & probabilities', 'Lead sources', 'Listing & intake forms'] },
  { key: 'integrations', label: 'Integrations', subtitle: 'Payments, messages, calendar, AI', group: 'Connections', outline: ['Payments (Viva Wallet, SEPA)', 'Messages (SMS, email, WhatsApp)', 'Calendar (Google / Outlook)', 'Documents & AI (e-signature, assistant)'] },
  { key: 'gdpr', label: 'GDPR and data', subtitle: 'Consent, retention, import, export', group: 'Connections', outline: ['Consent text', 'Retention periods (leads, deals)', 'Import / export data', 'Right to erasure'] },
];

export const SETTINGS_GROUPS: SettingsSection['group'][] = ['Account', 'Work', 'Money', 'Connections'];

/** Appearance reuses the existing branding page/route; the rest live under /settings?section=<key>. */
export function sectionHref(key: SettingsKey): string {
  return `/settings?section=${key}`;
}

export function getSection(key: string | undefined): SettingsSection {
  return SETTINGS_SECTIONS.find((s) => s.key === key) ?? SETTINGS_SECTIONS[0];
}
