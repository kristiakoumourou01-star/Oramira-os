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
  | 'notifications' | 'security' | 'tags' | 'pipelines' | 'leads' | 'integrations' | 'gdpr' | 'portals' | 'unitforms'
  | 'departments' | 'customerFields' | 'communication';

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
  { key: 'business', label: 'Στοιχεία εταιρείας', subtitle: 'Επωνυμία, ΑΦΜ, γραφεία, logo', group: 'Account', outline: ['Company name, registration no., VAT no.', 'Licence or registry (optional)', 'Invoice email and website', 'Offices (address, phone, manager)', 'Document footer'] },
  { key: 'appearance', label: 'Εμφάνιση', subtitle: 'Logo, χρώματα, γραμματοσειρές, μέγεθος κειμένου', group: 'Account', ready: true, outline: ['Logo & company name', 'Brand colours', 'Heading & body fonts', 'Content width & density'] },
  { key: 'layout', label: 'Μενού & διάταξη', subtitle: 'Μενού, sidebar, οθόνη έναρξης, λίστες', group: 'Account', outline: ['Menu & sidebar arrangement', 'Start screen', 'Default list columns & sorting'] },
  { key: 'dashboard', label: 'Dashboard', subtitle: 'Ποια κουτιά εμφανίζονται και με ποια σειρά', group: 'Account', outline: ['Pick which cards appear', 'Reorder the dashboard blocks', 'Show commissions / rankings'] },
  { key: 'invoices', label: 'Τιμολόγια & ΦΠΑ', subtitle: 'Συντελεστές ΦΠΑ, αρίθμηση, απόδειξη', group: 'Money', ready: true, outline: ['Συντελεστές ΦΠΑ', 'Αρίθμηση χωρίς κενά (INV-, REC-, CN-)', 'Logo / διεύθυνση / IBAN στο παραστατικό', 'myDATA export'] },
  { key: 'notifications', label: 'Ειδοποιήσεις', subtitle: 'Ποιος ενημερώνεται, και πώς', group: 'Work', outline: ['Events (new lead, viewing booked, payment failed…)', 'Who gets told (agent / manager / client)', 'Channels: in-app, push, email, SMS', 'Quiet hours'] },
  { key: 'security', label: 'Ασφάλεια', subtitle: 'Σύνδεση, συσκευές, κωδικοί', group: 'Work', outline: ['Two-factor (OTP)', 'Trusted devices & session timeout', 'Password policy (length, symbols, expiry)', 'IP allow-list'] },
  { key: 'tags', label: 'Tags & ομάδες', subtitle: 'Ετικέτες και λίστες επαφών', group: 'Work', outline: ['Contact tags (Cash buyer, Investor, VIP…)', 'Saved groups / segments', 'Custom fields (type, required)'] },
  { key: 'communication', label: 'Επικοινωνία', subtitle: 'SMS, email και push', group: 'Connections', ready: true, outline: [] },
  { key: 'departments', label: 'Τμήματα', subtitle: 'Γραφεία / ομάδες και αίθουσες συναντήσεων', group: 'Work', ready: true, outline: [] },
  { key: 'customerFields', label: 'Πεδία πελατών', subtitle: 'Όλα τα πεδία σε ένα σημείο: υποχρεωτικά, στη φόρμα, δικά σας πεδία', group: 'Work', ready: true, outline: [] },
  { key: 'pipelines', label: 'Pipelines & φόρμες', subtitle: 'Pipelines, στάδια και όρια, λόγοι απώλειας, προμήθεια, κρατήσεις', group: 'Work', ready: true, outline: ['Πολλαπλά pipelines', 'Στάδια, πιθανότητες, μέγιστες μέρες', 'Λόγοι απώλειας', 'Πηγές leads', 'Τιμολόγιο προμήθειας στο «Won»', 'Κρατήσεις: διάρκεια, προειδοποίηση, αποδέσμευση'] },
  { key: 'leads', label: 'Leads & αυτοματισμοί', subtitle: 'Υπεύθυνος ανά πηγή, round robin, καλωσόρισμα, follow-up, αναπάντητα, ημερήσια σύνοψη', group: 'Work', ready: true, outline: ['Υπεύθυνος ανά πηγή', 'Round robin (με άδειες)', 'Καλωσόρισμα στη γλώσσα του πελάτη', 'Αναπάντητο lead: ειδοποίηση και επαναδιανομή', 'Follow-up sequence', 'Ημερήσια σύνοψη'] },
  { key: 'unitforms', label: 'Φόρμες μονάδων', subtitle: 'Τύποι μονάδων, δικά σας πεδία (EL/EN), υδατογράφημα φωτογραφιών', group: 'Work', ready: true, outline: ['Τύποι μονάδων', 'Πεδία ανά τύπο', 'Ορατό στον πελάτη ή μόνο στο προσωπικό', 'Χρήση στο matching', 'Υδατογράφημα φωτογραφιών'] },
  { key: 'portals', label: 'Portals πελατών', subtitle: 'Όροι χρήσης, συχνές ερωτήσεις, επικοινωνία', group: 'Work', ready: true, outline: ['Όροι χρήσης', 'Συχνές ερωτήσεις (FAQ)', 'Email και τηλέφωνο υποστήριξης'] },
  { key: 'integrations', label: 'Integrations', subtitle: 'Πληρωμές, μηνύματα, ημερολόγιο, διαφημίσεις, AI', group: 'Connections', outline: ['Payments (Viva Wallet, SEPA)', 'Messages (SMS, email, WhatsApp)', 'Calendar (Google / Outlook)', 'Documents & AI (e-signature, assistant)'] },
  { key: 'gdpr', label: 'GDPR & δεδομένα', subtitle: 'Συγκατάθεση, διατήρηση, export, AML', group: 'Connections', ready: true, outline: ['Κείμενο συγκατάθεσης (EL/EN) και marketing', 'Διατήρηση δεδομένων', 'Export όλων σε ZIP', 'Διαγραφή κατόπιν αιτήματος', 'AML: χώρες υψηλού κινδύνου (FATF)'] },
];

export const SETTINGS_GROUPS: SettingsSection['group'][] = ['Account', 'Work', 'Money', 'Connections'];

/** Appearance reuses the existing branding page/route; the rest live under /settings?section=<key>. */
export function sectionHref(key: SettingsKey): string {
  return `/settings?section=${key}`;
}

export function getSection(key: string | undefined): SettingsSection {
  return SETTINGS_SECTIONS.find((s) => s.key === key) ?? SETTINGS_SECTIONS[0];
}

/**
 * The one Settings menu (shared by /settings and every /settings/* page and
 * /automation), grouped by product area. `module` = the permission
 * needed to see the entry; entries without it are admin-only.
 */
export interface SettingsNavItem { label: string; href: string; icon: string; module?: 'automation' }
export interface SettingsNavGroup { label: string; items: SettingsNavItem[] }

export const SETTINGS_NAV: SettingsNavGroup[] = [
  { label: 'Λογαριασμός', items: [
    { label: 'Στοιχεία εταιρείας', href: '/settings?section=business', icon: 'business' },
    { label: 'Εμφάνιση', href: '/settings?section=appearance', icon: 'appearance' },
    { label: 'Μενού & διάταξη', href: '/settings?section=layout', icon: 'layout' },
    { label: 'Dashboard', href: '/settings?section=dashboard', icon: 'dashboard' },
  ] },
  { label: 'Λειτουργία', items: [
    { label: 'Ειδοποιήσεις', href: '/settings?section=notifications', icon: 'notifications' },
    { label: 'Ασφάλεια', href: '/settings?section=security', icon: 'security' },
    { label: 'Tags & ομάδες', href: '/settings?section=tags', icon: 'tags' },
    { label: 'Τμήματα', href: '/settings?section=departments', icon: 'departments' },
    { label: 'Πεδία πελατών', href: '/settings?section=customerFields', icon: 'customerFields' },
    { label: 'Pipelines & φόρμες', href: '/settings?section=pipelines', icon: 'pipelines' },
    { label: 'Leads & αυτοματισμοί', href: '/settings?section=leads', icon: 'leads' },
    { label: 'Φόρμες μονάδων', href: '/settings?section=unitforms', icon: 'unitforms' },
    { label: 'Portals πελατών', href: '/settings?section=portals', icon: 'portals' },
    { label: 'Templates', href: '/settings/templates', icon: 'templates', module: 'automation' },
    { label: 'Αυτοματισμοί', href: '/automation', icon: 'automation', module: 'automation' },
  ] },
  { label: 'Χρήστες', items: [
    { label: 'Χρήστες & πρόσβαση', href: '/settings/users', icon: 'users' },
    { label: 'Ρόλοι & δικαιώματα', href: '/settings/roles', icon: 'roles' },
    { label: 'Προβολή ως χρήστης', href: '/settings/view-as', icon: 'viewas' },
  ] },
  { label: 'Φόροι', items: [
    { label: 'ΦΠΑ & αποδείξεις', href: '/settings?section=invoices', icon: 'invoices' },
  ] },
  { label: 'Συνδέσεις', items: [
    { label: 'Επικοινωνία', href: '/settings?section=communication', icon: 'communication' },
    { label: 'Mobile app', href: '/settings/mobile-app', icon: 'mobile' },
    { label: 'Integrations', href: '/settings?section=integrations', icon: 'integrations' },
  ] },
  { label: 'Δεδομένα', items: [
    { label: 'GDPR & δεδομένα', href: '/settings?section=gdpr', icon: 'gdpr' },
  ] },
];
