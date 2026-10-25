/**
 * Agency settings — pure types + defaults (client-safe half), mirroring the
 * prototype's Settings domains. Each section persists its own JSONB slice via
 * lib/org-settings (server). New sections add a slice here; no schema change.
 */

/* ---- Business ---- */
export interface Office { name: string; address: string; phone: string; manager: string; main: boolean }
export interface BusinessSettings {
  registrationNo: string; vatNo: string; licence: string;
  invoiceEmail: string; website: string; footer: string; offices: Office[];
}

/* ---- Invoices and VAT ---- */
export interface VatRate { label: string; rate: number; note: string }
export interface NumberSeries { label: string; prefix: string; next: number }
export interface InvoiceSettings {
  defaultVat: number;
  vatRates: VatRate[];
  series: NumberSeries[];
  receiptShowLogo: boolean; receiptShowAddress: boolean; receiptShowBank: boolean;
  mydataExport: boolean;
}

/* ---- Notifications ---- */
export interface NotifRow { event: string; who: string; inApp: boolean; push: boolean; email: boolean; sms: boolean }
export interface NotificationSettings { rows: NotifRow[]; quietFrom: string; quietTo: string }

/* ---- Security ---- */
export interface SecuritySettings {
  otp: boolean; trustedDevices: boolean; sessionTimeoutHours: number;
  pwLength: number; pwSymbols: boolean; pwExpire90: boolean; ipAllowList: string;
}

/* ---- Tags, groups and fields ---- */
export interface CustomField { name: string; type: string; required: boolean }
export interface TagsSettings { tags: string[]; groups: string[]; fields: CustomField[] }
export const FIELD_TYPES = ['Text', 'Number', 'Date', 'Choice', 'Yes / No'];

/* ---- Pipelines and forms ---- */
export interface PipelineStage { name: string; probability: number }
export interface PipelineSettings { stages: PipelineStage[]; sources: string[] }

/* ---- GDPR and data ---- */
export interface GdprSettings { consentText: string; retentionLeadsMonths: number; retentionDealsYears: number; marketingOptIn: boolean }

/* ---- Layout ---- */
export interface LayoutSettings { startScreen: string; sidebarCompact: boolean; denseLists: boolean }
export const START_SCREENS: { value: string; label: string }[] = [
  { value: '/dashboard', label: 'My Workspace' },
  { value: '/calendar', label: 'Calendar' },
  { value: '/crm/leads', label: 'Sales (pipeline)' },
  { value: '/crm/customers', label: 'Customers' },
  { value: '/property', label: 'Property' },
  { value: '/reports', label: 'Intelligence' },
];

/* ---- Dashboard ---- */
export interface DashboardBlock { key: string; label: string; visible: boolean }
export const DASHBOARD_BLOCK_DEFS: { key: string; label: string }[] = [
  { key: 'briefing', label: 'Morning briefing' },
  { key: 'planner', label: 'Planner & quick actions' },
  { key: 'pipeline', label: "Today's pipeline" },
  { key: 'tasks', label: "Today's tasks" },
];
export interface DashboardSettings { blocks: DashboardBlock[] }

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
}

/* ---- Defaults (prototype values where applicable) ---- */
export const DEFAULT_BUSINESS: BusinessSettings = { registrationNo: '', vatNo: '', licence: '', invoiceEmail: '', website: '', footer: '', offices: [] };

export const DEFAULT_INVOICES: InvoiceSettings = {
  defaultVat: 19,
  vatRates: [
    { label: 'Standard', rate: 19, note: 'Commission, management fees, valuations' },
    { label: 'Reduced', rate: 9, note: 'Not used by estate agents' },
    { label: 'Super-reduced', rate: 5, note: 'Not used by estate agents' },
    { label: 'Exempt', rate: 0, note: 'Residential rent (no VAT)' },
  ],
  series: [
    { label: 'Commission invoices', prefix: 'INV-2026-', next: 148 },
    { label: 'Rent receipts', prefix: 'RCT-2026-', next: 1093 },
    { label: 'Credit notes', prefix: 'CN-2026-', next: 7 },
  ],
  receiptShowLogo: true, receiptShowAddress: true, receiptShowBank: true, mydataExport: false,
};

const EVENTS = ['New lead', 'Lead unanswered 1 h', 'Viewing booked', 'Viewing reminder', 'Payment failed', 'Mandate ends in 30 days', 'Deal won'];
const WHO = ['Assigned agent', 'Agent and manager', 'Agent and client', 'Agent and client', 'Back office and agent', 'Listing agent', 'Whole office'];
const MATRIX = [[1, 1, 1, 0], [1, 1, 0, 1], [1, 1, 1, 0], [0, 1, 0, 1], [1, 0, 1, 0], [1, 0, 1, 0], [1, 1, 0, 0]];
export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  rows: EVENTS.map((event, i) => ({ event, who: WHO[i], inApp: !!MATRIX[i][0], push: !!MATRIX[i][1], email: !!MATRIX[i][2], sms: !!MATRIX[i][3] })),
  quietFrom: '21:00', quietTo: '08:30',
};

export const DEFAULT_SECURITY: SecuritySettings = { otp: true, trustedDevices: true, sessionTimeoutHours: 8, pwLength: 10, pwSymbols: true, pwExpire90: false, ipAllowList: '' };

export const DEFAULT_TAGS: TagsSettings = {
  tags: ['Cash buyer', 'Investor', 'Golden visa', 'Relocating', 'Hot', 'VIP', 'Needs mortgage'],
  groups: ['Russian-speaking buyers', 'UK relocation', 'Landlords · Limassol', 'Developers', 'Past clients'],
  fields: [
    { name: 'Nationality', type: 'Choice', required: false },
    { name: 'Budget ceiling', type: 'Number', required: true },
    { name: 'Move-in date', type: 'Date', required: false },
    { name: 'Mortgage approved', type: 'Yes / No', required: false },
  ],
};

export const DEFAULT_PIPELINES: PipelineSettings = {
  stages: [
    { name: 'New', probability: 10 }, { name: 'Contacted', probability: 25 }, { name: 'Viewing', probability: 45 },
    { name: 'Offer', probability: 65 }, { name: 'Reserved', probability: 85 }, { name: 'Won', probability: 100 },
  ],
  sources: ['Website', 'Referral', 'Portal', 'Walk-in', 'Campaign', 'Social'],
};

export const DEFAULT_GDPR: GdprSettings = {
  consentText: 'I agree that the company stores my details to answer my enquiry. I can ask for them to be deleted at any time.',
  retentionLeadsMonths: 24, retentionDealsYears: 6, marketingOptIn: true,
};

export const DEFAULT_LAYOUT: LayoutSettings = { startScreen: '/dashboard', sidebarCompact: false, denseLists: false };
export const DEFAULT_DASHBOARD: DashboardSettings = { blocks: DASHBOARD_BLOCK_DEFS.map((b) => ({ ...b, visible: true })) };

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  business: DEFAULT_BUSINESS, invoices: DEFAULT_INVOICES, notifications: DEFAULT_NOTIFICATIONS,
  security: DEFAULT_SECURITY, tags: DEFAULT_TAGS, pipelines: DEFAULT_PIPELINES, gdpr: DEFAULT_GDPR,
  layout: DEFAULT_LAYOUT, dashboard: DEFAULT_DASHBOARD,
};

const arr = <T,>(v: any, fallback: T[]): T[] => (Array.isArray(v) ? v : fallback);

/** Merge a stored (possibly partial) data blob onto the defaults. */
export function mergeOrgSettings(data: any): OrgSettings {
  const d = data && typeof data === 'object' ? data : {};
  return {
    business: { ...DEFAULT_BUSINESS, ...(d.business ?? {}), offices: arr(d.business?.offices, DEFAULT_BUSINESS.offices) },
    invoices: { ...DEFAULT_INVOICES, ...(d.invoices ?? {}), vatRates: arr(d.invoices?.vatRates, DEFAULT_INVOICES.vatRates), series: arr(d.invoices?.series, DEFAULT_INVOICES.series) },
    notifications: { ...DEFAULT_NOTIFICATIONS, ...(d.notifications ?? {}), rows: arr(d.notifications?.rows, DEFAULT_NOTIFICATIONS.rows) },
    security: { ...DEFAULT_SECURITY, ...(d.security ?? {}) },
    tags: { ...DEFAULT_TAGS, ...(d.tags ?? {}), tags: arr(d.tags?.tags, DEFAULT_TAGS.tags), groups: arr(d.tags?.groups, DEFAULT_TAGS.groups), fields: arr(d.tags?.fields, DEFAULT_TAGS.fields) },
    pipelines: { ...DEFAULT_PIPELINES, ...(d.pipelines ?? {}), stages: arr(d.pipelines?.stages, DEFAULT_PIPELINES.stages), sources: arr(d.pipelines?.sources, DEFAULT_PIPELINES.sources) },
    gdpr: { ...DEFAULT_GDPR, ...(d.gdpr ?? {}) },
    layout: { ...DEFAULT_LAYOUT, ...(d.layout ?? {}) },
    dashboard: { blocks: mergeBlocks(d.dashboard?.blocks) },
  };
}

/** Keep the canonical block set/order; apply stored visibility. */
function mergeBlocks(stored: any): DashboardBlock[] {
  const vis = new Map<string, boolean>();
  if (Array.isArray(stored)) for (const b of stored) if (b && typeof b.key === 'string') vis.set(b.key, b.visible !== false);
  return DASHBOARD_BLOCK_DEFS.map((b) => ({ ...b, visible: vis.has(b.key) ? !!vis.get(b.key) : true }));
}
