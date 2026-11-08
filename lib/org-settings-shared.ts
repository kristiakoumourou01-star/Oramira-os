/**
 * Agency settings — pure types + defaults (client-safe half), mirroring the
 * prototype's Settings domains. Each section persists its own JSONB slice via
 * lib/org-settings (server). New sections add a slice here; no schema change.
 */

import { DEFAULT_WATERMARK, mergeWatermark, type WatermarkSettings } from '@/lib/watermark-shared';
import { DEFAULT_RESERVATIONS, mergeReservations, type ReservationSettings } from '@/lib/pricing-shared';
import { DEFAULT_AML, mergeAml, type AmlSettings } from '@/lib/kyc-shared';
import { DEFAULT_LEAD_AUTOMATION, mergeLeadAutomation, type LeadAutomationSettings } from '@/lib/lead-automation-shared';
import { DEFAULT_PIPELINE_SETTINGS, mergePipelines, type PipelineSettings } from '@/lib/pipeline-shared';
import { DEFAULT_NAV, allNavTargets, type NavDef, type NavGroupDef } from '@/lib/nav';
import { NOTIF_EVENTS } from '@/lib/notification-events';
import { DEFAULT_ROLES, mergeRoles, type RolesSettings } from '@/lib/roles-shared';
import { DEFAULT_DASHBOARD, mergeDashboard, type DashboardSettings } from '@/lib/dashboard-shared';
import { DEFAULT_LOCALE, parseLocale, serializeLocale, type LocalePrefs } from '@/lib/locale-shared';
import { DEFAULT_UNIT_FORMS, mergeUnitForms, type UnitFormsSettings } from '@/lib/unit-forms-shared';

/* ---- Business ---- */
export interface Office { name: string; address: string; phone: string; manager: string; main: boolean }
export interface BusinessSettings {
  registrationNo: string; vatNo: string; licence: string;
  invoiceEmail: string; website: string; footer: string; offices: Office[];
  /** Ταυτότητα: επίσημη επωνυμία και εμπορική ονομασία. */
  officialName: string; tradingName: string;
  /** Διεύθυνση & επικοινωνία (με αναζήτηση στον χάρτη). */
  address1: string; address2: string; city: string; region: string; postalCode: string; country: string;
  landline: string; mobile: string; lat: string; lng: string;
}

/* ---- Invoices and VAT ---- */
/**
 * VAT rates offered when issuing a document. Changing a rate never touches
 * documents already issued — each line stores the rate it was issued with.
 * Numbering series live in the database (document_series), not here, so a
 * number is handed out exactly once and without gaps (see lib/invoices).
 */
export interface VatRate { label: string; rate: number; note: string }
export interface InvoiceSettings {
  defaultVat: number;
  vatRates: VatRate[];
  /** Printed on documents when receiptShowBank is on (bank, IBAN, BIC). */
  bankDetails: string;
  /** Payment terms in days for new invoices (due date = issue date + N). */
  paymentTermsDays: number;
  receiptShowLogo: boolean; receiptShowAddress: boolean; receiptShowBank: boolean;
  mydataExport: boolean;
}

/* ---- Required fields ---- */
/**
 * Which fields must be filled in, beyond the ones the system always needs
 * (name + email for staff; email or phone for the public). `staff` = the
 * "New lead" form in the CRM; `public` = website form and booking page.
 */
export interface FieldRules {
  staff: string[]; public: string[];
  /** Ποια πεδία εμφανίζονται στη δημόσια φόρμα (κράτηση προβολής). */
  publicShown: string[];
  /** Νέοι πελάτες ξεκινούν με συγκατάθεση για email/SMS/push. */
  optInDefault: boolean;
}
export const STAFF_FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: 'phone', label: 'Τηλέφωνο' },
  { key: 'budget', label: 'Προϋπολογισμός' },
  { key: 'project', label: 'Έργο ενδιαφέροντος' },
  { key: 'buyerType', label: 'Τύπος αγοραστή' },
  { key: 'language', label: 'Γλώσσα' },
  { key: 'timeline', label: 'Πότε θέλει να αγοράσει' },
  { key: 'assignedTo', label: 'Υπεύθυνος πωλητής' },
  { key: 'message', label: 'Σημειώσεις' },
];
export const PUBLIC_FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: 'name', label: 'Όνομα' },
  { key: 'phone', label: 'Τηλέφωνο' },
  { key: 'email', label: 'Email' },
  { key: 'message', label: 'Μήνυμα' },
];
export const DEFAULT_FIELD_RULES: FieldRules = { staff: [], public: [], publicShown: ['name', 'phone', 'email', 'message'], optInDefault: false };
export function mergeFieldRules(x: any): FieldRules {
  const v = x && typeof x === 'object' ? x : {};
  const pick = (a: any, opts: { key: string }[], fb: string[]) => (Array.isArray(a) ? opts.map((o) => o.key).filter((k) => a.includes(k)) : fb);
  const shown = pick(v.publicShown, PUBLIC_FIELD_OPTIONS, DEFAULT_FIELD_RULES.publicShown);
  const pub = pick(v.public, PUBLIC_FIELD_OPTIONS, DEFAULT_FIELD_RULES.public);
  // Ό,τι είναι υποχρεωτικό εμφανίζεται πάντα· όνομα/email/τηλέφωνο μένουν πάντα στη φόρμα.
  const shownAll = PUBLIC_FIELD_OPTIONS.map((o) => o.key).filter((k) => shown.includes(k) || pub.includes(k) || k !== 'message');
  return { staff: pick(v.staff, STAFF_FIELD_OPTIONS, DEFAULT_FIELD_RULES.staff), public: pub, publicShown: shownAll, optInDefault: v.optInDefault === true };
}

/* ---- Client portals: terms & FAQ ---- */
export interface FaqItem { q: string; a: string }
export interface PortalSettings { termsText: string; faq: FaqItem[]; helpEmail: string; helpPhone: string }
export const DEFAULT_PORTAL: PortalSettings = {
  termsText: '',
  faq: [
    { q: 'Πότε θα πάρω τα κλειδιά;', a: 'Η ημερομηνία παράδοσης φαίνεται στην ενότητα «Handover». Θα σας ειδοποιήσουμε για το ραντεβού παράδοσης.' },
    { q: 'Πώς πληρώνω την επόμενη δόση;', a: 'Στο «Payment Center» βλέπετε τις δόσεις, τις ημερομηνίες και τα τραπεζικά στοιχεία.' },
    { q: 'Βρήκα ένα πρόβλημα στο σπίτι. Τι κάνω;', a: 'Ανοίξτε αίτημα στο «Maintenance» με φωτογραφία. Θα σας απαντήσουμε το συντομότερο.' },
  ],
  helpEmail: '', helpPhone: '',
};
export function mergePortal(x: any): PortalSettings {
  const v = x && typeof x === 'object' ? x : {};
  const s = (t: any, max: number) => (typeof t === 'string' ? t.trim().slice(0, max) : '');
  const faq = Array.isArray(v.faq)
    ? v.faq.map((f: any) => ({ q: s(f?.q, 300), a: s(f?.a, 3000) })).filter((f: FaqItem) => f.q && f.a).slice(0, 50)
    : DEFAULT_PORTAL.faq;
  return { termsText: s(v.termsText, 30000), faq, helpEmail: s(v.helpEmail, 200), helpPhone: s(v.helpPhone, 60) };
}

/* ---- Notifications ---- */
export interface NotifRow { key: string; event: string; who: string; inApp: boolean; push: boolean; email: boolean; sms: boolean }
export interface NotificationSettings { rows: NotifRow[]; quietFrom: string; quietTo: string }

/* ---- Security ---- */
export interface SecuritySettings {
  otp: boolean; trustedDevices: boolean; sessionTimeoutHours: number;
  pwLength: number; pwSymbols: boolean; pwExpire90: boolean; ipAllowList: string;
}

/* ---- Tags, groups and fields ---- */
/**
 * A custom contact field. `key` is fixed once created (values are stored under
 * it), so renaming a field never loses data. `options` is used by Choice.
 */
export interface CustomField { key: string; name: string; type: string; required: boolean; options: string[] }
export interface TagsSettings { tags: string[]; groups: string[]; fields: CustomField[] }
export const FIELD_TYPES = ['Text', 'Number', 'Date', 'Choice', 'Yes / No'];
export const FIELD_TYPE_LABEL: Record<string, string> = { Text: 'Κείμενο', Number: 'Αριθμός', Date: 'Ημερομηνία', Choice: 'Επιλογή', 'Yes / No': 'Ναι / Όχι' };

/** Stable key from a field name ("Budget ceiling" → "budget_ceiling"), unique among `taken`. */
export function fieldKeyFrom(name: string, taken: string[]): string {
  const gr: Record<string, string> = { α:'a',β:'v',γ:'g',δ:'d',ε:'e',ζ:'z',η:'i',θ:'th',ι:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o',ά:'a',έ:'e',ή:'i',ί:'i',ό:'o',ύ:'y',ώ:'o' };
  const base = name.toLowerCase().split('').map((c) => gr[c] ?? c).join('').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'field';
  let k = base; let n = 2;
  while (taken.includes(k)) k = `${base}_${n++}`;
  return k;
}

/** Validate the tags slice: unique trimmed tags/groups, fields with keys and options. */
export function mergeTags(t: any): TagsSettings {
  const v = t && typeof t === 'object' ? t : {};
  const uniq = (a: any, fb: string[]) => (Array.isArray(a) ? Array.from(new Set(a.map((x: any) => String(x ?? '').trim()).filter(Boolean))).slice(0, 200) as string[] : fb);
  const fields: CustomField[] = [];
  for (const f of Array.isArray(v.fields) ? v.fields : DEFAULT_TAGS.fields) {
    const name = String(f?.name ?? '').trim();
    if (!name) continue;
    const key = typeof f.key === 'string' && /^[a-z0-9_]{1,48}$/.test(f.key) && !fields.some((x) => x.key === f.key)
      ? f.key : fieldKeyFrom(name, fields.map((x) => x.key));
    fields.push({
      key, name: name.slice(0, 60),
      type: FIELD_TYPES.includes(f.type) ? f.type : 'Text',
      required: !!f.required,
      options: uniq(f.options, []),
    });
  }
  return { tags: uniq(v.tags, DEFAULT_TAGS.tags), groups: uniq(v.groups, DEFAULT_TAGS.groups), fields };
}

/* ---- Pipelines and forms ---- */
export type { PipelineSettings } from '@/lib/pipeline-shared';

/* ---- GDPR and data ---- */
/**
 * GDPR. `consentText` / `marketingText` are the English wording; the *El fields
 * the Greek. Each contact stores the exact text it agreed to (contacts.consent_text).
 */
export interface GdprSettings {
  consentText: string; consentTextEl: string;
  marketingText: string; marketingTextEl: string;
  /** Public forms refuse a submission without the consent tick. */
  requireConsent: boolean;
  /** Pre-tick the marketing box (off = the person must tick it — the safe default). */
  marketingOptIn: boolean;
  retentionLeadsMonths: number; retentionDealsYears: number;
  /** Anonymize expired leads automatically every night. */
  autoRetention: boolean;
}

/* ---- Layout ---- */
export interface LayoutSettings {
  startScreen: string; sidebarCompact: boolean; denseLists: boolean;
  /** Προεπιλογή πλαϊνού μενού για όλους: πλήρες, μόνο εικονίδια ή αυτόματη απόκρυψη (ανοίγει με hover). */
  sidebarDefault: 'full' | 'icons' | 'auto';
  /** Πρώτη μέρα της εβδομάδας στα ημερολόγια. */
  weekStart: 'monday' | 'sunday' | 'saturday';
  /** Πλαϊνό μενού: ανοίγει μία ενότητα τη φορά (οι άλλες κλείνουν). */
  sidebarAccordion: boolean;
}
/** Start screen options = every page the menu can open (Settings → Μενού & διάταξη). */
export const START_SCREENS: { value: string; label: string }[] = allNavTargets();

/* ---- Dashboard (see lib/dashboard-shared) ---- */
export type { DashboardSettings } from '@/lib/dashboard-shared';

/* ---- Menu (sidebar) ---- */
/**
 * Admin overrides on top of lib/nav DEFAULT_NAV. `items` is the saved order of
 * top-level entries; anything not listed keeps its default place at the end.
 * Only what differs from the default needs to be stored.
 */
export type MenuPosition = 'left' | 'right' | 'top';
export interface MenuChildOverride { href: string; label?: string; hidden?: boolean }
export interface MenuItemOverride {
  href: string;
  label?: string;
  icon?: string;
  hidden?: boolean;
  /** Internal roles that don't see this entry (permissions still apply on top). */
  hiddenRoles?: string[];
  children?: MenuChildOverride[];
}
export interface MenuSettings { position: MenuPosition; items: MenuItemOverride[] }
export const DEFAULT_MENU: MenuSettings = { position: 'left', items: [] };

/** A menu entry after overrides — what the sidebar and the editor work with. */
export interface ResolvedNavChild { href: string; label: string; defaultLabel: string; hidden: boolean; module?: NavGroupDef['module'] }
export interface ResolvedNavItem {
  href: string; label: string; defaultLabel: string; icon: string; defaultIcon: string;
  hidden: boolean; hiddenRoles: string[]; module?: NavGroupDef['module'];
  section: number; locked: boolean; children: ResolvedNavChild[];
}

/** Apply saved overrides to the default menu. Settings can never be hidden. */
export function resolveMenu(menu: MenuSettings, nav: NavDef[] = DEFAULT_NAV): ResolvedNavItem[] {
  const defaults: ResolvedNavItem[] = [];
  nav.forEach((section, si) =>
    section.items.forEach((it) =>
      defaults.push({
        href: it.href, label: it.label, defaultLabel: it.label, icon: it.icon, defaultIcon: it.icon,
        hidden: false, hiddenRoles: [], module: it.module, section: si, locked: it.href === '/settings',
        children: (it.children ?? []).map((c) => ({ href: c.href, label: c.label, defaultLabel: c.label, hidden: false, module: c.module ?? it.module })),
      }),
    ),
  );
  const byHref = new Map(defaults.map((d) => [d.href, d]));
  const ordered: ResolvedNavItem[] = [];
  for (const o of menu.items ?? []) {
    const d = byHref.get(o?.href);
    if (!d || ordered.includes(d)) continue;
    ordered.push(d);
  }
  for (const d of defaults) if (!ordered.includes(d)) ordered.push(d);

  return ordered.map((d) => {
    const o = (menu.items ?? []).find((x) => x?.href === d.href);
    if (!o) return d;
    const kids: ResolvedNavChild[] = [];
    for (const co of o.children ?? []) {
      const c = d.children.find((x) => x.href === co?.href);
      if (c && !kids.includes(c)) kids.push(c);
    }
    for (const c of d.children) if (!kids.includes(c)) kids.push(c);
    return {
      ...d,
      label: (o.label ?? '').trim() || d.label,
      icon: o.icon || d.icon,
      hidden: d.locked ? false : !!o.hidden,
      hiddenRoles: d.locked ? [] : Array.isArray(o.hiddenRoles) ? o.hiddenRoles.filter((r) => typeof r === 'string') : [],
      children: kids.map((c) => {
        const co = (o.children ?? []).find((x) => x?.href === c.href);
        return co ? { ...c, label: (co.label ?? '').trim() || c.label, hidden: !!co.hidden } : c;
      }),
    };
  });
}

/** Store only what differs from the defaults (keeps the saved blob small and future-proof). */
export function menuOverridesFrom(items: ResolvedNavItem[], position: MenuPosition): MenuSettings {
  return {
    position,
    items: items.map((it) => {
      const o: MenuItemOverride = { href: it.href };
      if (it.label.trim() && it.label.trim() !== it.defaultLabel) o.label = it.label.trim();
      if (it.icon !== it.defaultIcon) o.icon = it.icon;
      if (it.hidden && !it.locked) o.hidden = true;
      if (it.hiddenRoles.length && !it.locked) o.hiddenRoles = it.hiddenRoles;
      o.children = it.children.map((c) => {
        const co: MenuChildOverride = { href: c.href };
        if (c.label.trim() && c.label.trim() !== c.defaultLabel) co.label = c.label.trim();
        if (c.hidden) co.hidden = true;
        return co;
      });
      return o;
    }),
  };
}

/* ---- Appearance extras (company-wide; colours/fonts live in org_branding) ---- */
export type SidebarStyle = 'brand' | 'charcoal' | 'custom';
export type Corners = 'square' | 'soft' | 'round';
export type BoxStyle = 'shadow' | 'outline' | 'flat';
export type LabelStyle = 'soft' | 'solid' | 'outline';
export interface AppearanceSettings {
  /** Logo for LIGHT backgrounds (login, documents). The main logo is for the dark menu. */
  logoOnLight: string | null;
  favicon: string | null;
  sidebarStyle: SidebarStyle;
  sidebarColor: string;
  corners: Corners;
  boxStyle: BoxStyle;
  /** Ετικέτες κατάστασης (badges): απαλές, γεμάτες ή μόνο περίγραμμα. */
  labelStyle: LabelStyle;
}
export const DEFAULT_APPEARANCE: AppearanceSettings = {
  logoOnLight: null, favicon: null, sidebarStyle: 'brand', sidebarColor: '#113124', corners: 'soft', boxStyle: 'shadow', labelStyle: 'soft',
};

export interface OrgSettings {
  business: BusinessSettings;
  invoices: InvoiceSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
  tags: TagsSettings;
  pipelines: PipelineSettings;
  gdpr: GdprSettings;
  layout: LayoutSettings;
  dashboard: DashboardSettings;
  menu: MenuSettings;
  appearance: AppearanceSettings;
  roles: RolesSettings;
  fields: FieldRules;
  portal: PortalSettings;
  /** Company default language + number format (each user can change their own). */
  locale: LocalePrefs;
  /** Settings → Φόρμες μονάδων: unit types and your own fields. */
  unitForms: UnitFormsSettings;
  /** Settings → Φόρμες μονάδων → Υδατογράφημα φωτογραφιών. */
  watermark: WatermarkSettings;
  /** Settings → Pipelines → Κρατήσεις: διάρκεια, προειδοποίηση, αποδέσμευση. */
  reservations: ReservationSettings;
  /** Settings → GDPR & δεδομένα → AML: λίστες χωρών FATF, επανέλεγχος. */
  aml: AmlSettings;
  /** Settings → Leads & αυτοματισμοί: υπεύθυνος ανά πηγή, round robin, καλωσόρισμα, follow-up, σύνοψη. */
  leadAutomation: LeadAutomationSettings;
  /** Settings → Τμήματα: γραφεία/ομάδες και αίθουσες. */
  departments: DepartmentSettings;
}

/* ---- Defaults (prototype values where applicable) ---- */
export const DEFAULT_BUSINESS: BusinessSettings = { registrationNo: '', vatNo: '', licence: '', invoiceEmail: '', website: '', footer: '', offices: [], officialName: '', tradingName: '', address1: '', address2: '', city: '', region: '', postalCode: '', country: 'CY', landline: '', mobile: '', lat: '', lng: '' };

export const DEFAULT_INVOICES: InvoiceSettings = {
  defaultVat: 19,
  vatRates: [
    { label: 'Κανονικός', rate: 19, note: 'Νέα ακίνητα, υπηρεσίες, προμήθειες' },
    { label: 'Μειωμένος', rate: 5, note: 'Κύρια κατοικία, με προϋποθέσεις — επιβεβαιώστε με τον λογιστή' },
    { label: 'Απαλλαγή', rate: 0, note: 'Γη, μεταπώληση παλιών ακινήτων, ενοίκιο κατοικίας' },
  ],
  bankDetails: '',
  paymentTermsDays: 30,
  receiptShowLogo: true, receiptShowAddress: true, receiptShowBank: true, mydataExport: false,
};

/** Validate the invoices slice (used on read AND before save). */
export function mergeInvoices(x: any): InvoiceSettings {
  const v = x && typeof x === 'object' ? x : {};
  const rates: VatRate[] = [];
  for (const r of Array.isArray(v.vatRates) ? v.vatRates : DEFAULT_INVOICES.vatRates) {
    const rate = Number(r?.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) continue;
    const clean = Math.round(rate * 100) / 100;
    if (rates.some((q) => q.rate === clean)) continue;
    rates.push({ label: String(r?.label ?? '').trim().slice(0, 40) || `${clean}%`, rate: clean, note: String(r?.note ?? '').trim().slice(0, 160) });
  }
  if (!rates.length) rates.push(...DEFAULT_INVOICES.vatRates);
  const def = Number(v.defaultVat);
  const terms = Number(v.paymentTermsDays);
  return {
    vatRates: rates,
    defaultVat: rates.some((r) => r.rate === def) ? def : rates[0].rate,
    bankDetails: typeof v.bankDetails === 'string' ? v.bankDetails.slice(0, 500) : '',
    paymentTermsDays: Number.isFinite(terms) ? Math.min(365, Math.max(0, Math.round(terms))) : DEFAULT_INVOICES.paymentTermsDays,
    receiptShowLogo: v.receiptShowLogo !== false,
    receiptShowAddress: v.receiptShowAddress !== false,
    receiptShowBank: v.receiptShowBank !== false,
    mydataExport: !!v.mydataExport,
  };
}

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  rows: NOTIF_EVENTS.map((e) => ({ key: e.key, event: e.label, who: e.who, inApp: e.inApp, push: false, email: e.email, sms: false })),
  quietFrom: '21:00', quietTo: '08:30',
};

/** Legacy rows (English names) → event keys, so earlier choices carry over. */
const LEGACY_NOTIF: Record<string, string> = {
  'New lead': 'new_lead', 'Lead unanswered 1 h': 'lead_unanswered', 'Viewing booked': 'viewing_assigned', 'Payment failed': 'payment_overdue',
};

/** One row per known event, in catalogue order, keeping stored channel choices. */
export function mergeNotifications(n: any): NotificationSettings {
  const v = n && typeof n === 'object' ? n : {};
  const stored = new Map<string, any>();
  for (const r of Array.isArray(v.rows) ? v.rows : []) {
    const key = typeof r?.key === 'string' ? r.key : LEGACY_NOTIF[r?.event];
    if (key && !stored.has(key)) stored.set(key, r);
  }
  const time = (t: any, fb: string) => (typeof t === 'string' && /^\d{2}:\d{2}$/.test(t) ? t : fb);
  return {
    rows: NOTIF_EVENTS.map((e) => {
      const r = stored.get(e.key);
      return {
        key: e.key, event: e.label, who: e.who,
        inApp: r ? r.inApp !== false : e.inApp,
        email: r ? !!r.email : e.email,
        push: r ? !!r.push : false,
        sms: r ? !!r.sms : false,
      };
    }),
    quietFrom: time(v.quietFrom, DEFAULT_NOTIFICATIONS.quietFrom),
    quietTo: time(v.quietTo, DEFAULT_NOTIFICATIONS.quietTo),
  };
}

export const DEFAULT_SECURITY: SecuritySettings = { otp: false, trustedDevices: false, sessionTimeoutHours: 8, pwLength: 8, pwSymbols: false, pwExpire90: false, ipAllowList: '' };

export const DEFAULT_TAGS: TagsSettings = {
  tags: ['Cash buyer', 'Investor', 'Golden visa', 'Relocating', 'Hot', 'VIP', 'Needs mortgage'],
  groups: ['Russian-speaking buyers', 'UK relocation', 'Landlords · Limassol', 'Developers', 'Past clients'],
  fields: [
    { key: 'nationality', name: 'Nationality', type: 'Choice', required: false, options: ['Cypriot', 'Greek', 'British', 'Russian', 'Israeli', 'Other'] },
    { key: 'budget_ceiling', name: 'Budget ceiling', type: 'Number', required: false, options: [] },
    { key: 'move_in_date', name: 'Move-in date', type: 'Date', required: false, options: [] },
    { key: 'mortgage_approved', name: 'Mortgage approved', type: 'Yes / No', required: false, options: [] },
  ],
};

export const DEFAULT_PIPELINES: PipelineSettings = DEFAULT_PIPELINE_SETTINGS;

export const DEFAULT_GDPR: GdprSettings = {
  consentText: 'I agree that the company stores my details to answer my enquiry. I can ask for them to be deleted at any time.',
  consentTextEl: 'Συμφωνώ να αποθηκευτούν τα στοιχεία μου για να απαντήσετε στο αίτημά μου. Μπορώ να ζητήσω τη διαγραφή τους οποιαδήποτε στιγμή.',
  marketingText: 'Send me news about new projects and offers. I can unsubscribe at any time.',
  marketingTextEl: 'Στείλτε μου νέα για νέα έργα και προσφορές. Μπορώ να διαγραφώ οποιαδήποτε στιγμή.',
  requireConsent: false,
  marketingOptIn: false,
  retentionLeadsMonths: 24, retentionDealsYears: 6,
  autoRetention: false,
};

/** Validate the GDPR slice (used on read AND before save). */
export function mergeGdpr(g: any): GdprSettings {
  const v = g && typeof g === 'object' ? g : {};
  const txt = (x: any, fb: string, max = 1000) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : fb);
  const num = (x: any, lo: number, hi: number, fb: number) => (Number.isFinite(Number(x)) ? Math.min(hi, Math.max(lo, Math.round(Number(x)))) : fb);
  return {
    consentText: txt(v.consentText, DEFAULT_GDPR.consentText),
    consentTextEl: txt(v.consentTextEl, DEFAULT_GDPR.consentTextEl),
    marketingText: txt(v.marketingText, DEFAULT_GDPR.marketingText),
    marketingTextEl: txt(v.marketingTextEl, DEFAULT_GDPR.marketingTextEl),
    requireConsent: !!v.requireConsent,
    marketingOptIn: !!v.marketingOptIn,
    retentionLeadsMonths: num(v.retentionLeadsMonths, 6, 120, DEFAULT_GDPR.retentionLeadsMonths),
    retentionDealsYears: num(v.retentionDealsYears, 5, 20, DEFAULT_GDPR.retentionDealsYears),
    autoRetention: !!v.autoRetention,
  };
}

export const DEFAULT_LAYOUT: LayoutSettings = { startScreen: '/dashboard', sidebarCompact: false, denseLists: false, sidebarAccordion: true, sidebarDefault: 'full', weekStart: 'monday' };

/* ---- Departments & rooms (γραφεία/ομάδες και αίθουσες συναντήσεων) ---- */
export interface Department { key: string; name: string; active: boolean }
export interface Room { key: string; name: string; dept: string }
export interface DepartmentSettings { showOnCalendar: boolean; items: Department[]; rooms: Room[] }
export const DEFAULT_DEPARTMENTS: DepartmentSettings = { showOnCalendar: false, items: [], rooms: [] };
export function mergeDepartments(x: any): DepartmentSettings {
  const v = x && typeof x === 'object' ? x : {};
  const str = (t: any, n: number) => (typeof t === 'string' ? t.trim().slice(0, n) : '');
  const items: Department[] = [];
  for (const d of Array.isArray(v.items) ? v.items : []) {
    const name = str(d?.name, 60); if (!name) continue;
    const key = /^[a-z0-9_]{1,40}$/.test(d?.key) && !items.some((y) => y.key === d.key) ? d.key : `d${items.length + 1}_${Date.now().toString(36)}`;
    items.push({ key, name, active: d?.active !== false });
    if (items.length >= 50) break;
  }
  const rooms: Room[] = [];
  for (const r of Array.isArray(v.rooms) ? v.rooms : []) {
    const name = str(r?.name, 60); if (!name || !items.some((d) => d.key === r?.dept)) continue;
    const key = /^[a-z0-9_]{1,40}$/.test(r?.key) && !rooms.some((y) => y.key === r.key) ? r.key : `r${rooms.length + 1}_${Date.now().toString(36)}`;
    rooms.push({ key, name, dept: r.dept });
    if (rooms.length >= 100) break;
  }
  return { showOnCalendar: v.showOnCalendar === true && items.length > 0, items, rooms };
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  business: DEFAULT_BUSINESS, invoices: DEFAULT_INVOICES, notifications: DEFAULT_NOTIFICATIONS,
  security: DEFAULT_SECURITY, tags: DEFAULT_TAGS, pipelines: DEFAULT_PIPELINES, gdpr: DEFAULT_GDPR,
  layout: DEFAULT_LAYOUT, dashboard: DEFAULT_DASHBOARD, menu: DEFAULT_MENU,
  appearance: DEFAULT_APPEARANCE,
  fields: DEFAULT_FIELD_RULES,
  portal: DEFAULT_PORTAL,
  locale: DEFAULT_LOCALE,
  unitForms: DEFAULT_UNIT_FORMS,
  watermark: DEFAULT_WATERMARK,
  reservations: DEFAULT_RESERVATIONS,
  aml: DEFAULT_AML,
  leadAutomation: DEFAULT_LEAD_AUTOMATION,
  roles: DEFAULT_ROLES,
  departments: DEFAULT_DEPARTMENTS,
};

const arr = <T,>(v: any, fallback: T[]): T[] => (Array.isArray(v) ? v : fallback);

/** Merge a stored (possibly partial) data blob onto the defaults. */
export function mergeOrgSettings(data: any): OrgSettings {
  const d = data && typeof data === 'object' ? data : {};
  return {
    business: { ...DEFAULT_BUSINESS, ...(d.business ?? {}), offices: arr(d.business?.offices, DEFAULT_BUSINESS.offices) },
    invoices: mergeInvoices(d.invoices),
    notifications: mergeNotifications(d.notifications),
    security: (() => {
      const x = { ...DEFAULT_SECURITY, ...(d.security ?? {}) };
      const num = (v: any, lo: number, hi: number, fb: number) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : fb);
      return {
        otp: !!x.otp, trustedDevices: !!x.trustedDevices,
        sessionTimeoutHours: num(x.sessionTimeoutHours, 0, 168, DEFAULT_SECURITY.sessionTimeoutHours),
        pwLength: num(x.pwLength, 8, 64, DEFAULT_SECURITY.pwLength),
        pwSymbols: !!x.pwSymbols, pwExpire90: !!x.pwExpire90,
        ipAllowList: typeof x.ipAllowList === 'string' ? x.ipAllowList.slice(0, 2000) : '',
      };
    })(),
    tags: mergeTags(d.tags),
    pipelines: mergePipelines(d.pipelines),
    gdpr: mergeGdpr(d.gdpr),
    layout: (() => {
      const l = { ...DEFAULT_LAYOUT, ...(d.layout ?? {}) };
      return { ...l, sidebarDefault: ['full', 'icons', 'auto'].includes(l.sidebarDefault) ? l.sidebarDefault : (l.sidebarCompact ? 'icons' : 'full'), weekStart: ['monday', 'sunday', 'saturday'].includes(l.weekStart) ? l.weekStart : 'monday' };
    })(),
    departments: mergeDepartments(d.departments),
    dashboard: mergeDashboard(d.dashboard),
    appearance: mergeAppearance(d.appearance),
    roles: mergeRoles(d.roles),
    fields: mergeFieldRules(d.fields),
    portal: mergePortal(d.portal),
    unitForms: mergeUnitForms(d.unitForms),
    watermark: mergeWatermark(d.watermark),
    reservations: mergeReservations(d.reservations),
    aml: mergeAml(d.aml),
    leadAutomation: mergeLeadAutomation(d.leadAutomation),
    locale: parseLocale(d.locale && typeof d.locale === 'object' ? serializeLocale(d.locale) : null),
    menu: {
      position: ['left', 'right', 'top'].includes(d.menu?.position) ? d.menu.position : DEFAULT_MENU.position,
      items: arr(d.menu?.items, DEFAULT_MENU.items),
    },
  };
}


const IMG = /^(https?:\/\/|data:image\/(png|jpeg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,)/i;
const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** Validate/normalize the appearance slice (used on read AND before save). */
export function mergeAppearance(a: any): AppearanceSettings {
  const v = a && typeof a === 'object' ? a : {};
  const img = (x: any) => (typeof x === 'string' && IMG.test(x) && x.length <= 600_000 ? x : null);
  return {
    logoOnLight: img(v.logoOnLight),
    favicon: img(v.favicon),
    sidebarStyle: ['brand', 'charcoal', 'custom'].includes(v.sidebarStyle) ? v.sidebarStyle : DEFAULT_APPEARANCE.sidebarStyle,
    sidebarColor: typeof v.sidebarColor === 'string' && HEX6.test(v.sidebarColor) ? v.sidebarColor.toUpperCase() : DEFAULT_APPEARANCE.sidebarColor,
    corners: ['square', 'soft', 'round'].includes(v.corners) ? v.corners : DEFAULT_APPEARANCE.corners,
    boxStyle: ['shadow', 'outline', 'flat'].includes(v.boxStyle) ? v.boxStyle : DEFAULT_APPEARANCE.boxStyle,
    labelStyle: ['soft', 'solid', 'outline'].includes(v.labelStyle) ? v.labelStyle : DEFAULT_APPEARANCE.labelStyle,
  };
}
