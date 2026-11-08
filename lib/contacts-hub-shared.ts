/**
 * Επαφές (Πελάτες → Όλες οι επαφές): ιδιότητες, κατάσταση, φίλτρα, ιστορικό.
 * Client-safe — χρησιμοποιείται από τη λίστα, την καρτέλα επαφής και τα tests.
 */

/** Ιδιότητες με δική τους στήλη στη βάση (is_*) + επιπλέον (contacts.extra_roles). */
export const FLAG_ROLES = ['lead', 'buyer', 'investor', 'homeowner', 'newsletter'] as const;
export const EXTRA_ROLES = ['seller', 'partner', 'tenant', 'supplier'] as const;
export type FlagRole = (typeof FLAG_ROLES)[number];
export type ExtraRole = (typeof EXTRA_ROLES)[number];
export type ContactRole = FlagRole | ExtraRole;
export const ALL_ROLES: ContactRole[] = [...FLAG_ROLES, ...EXTRA_ROLES];

export const ROLE_EL: Record<string, string> = {
  lead: 'Lead', buyer: 'Αγοραστής', investor: 'Επενδυτής', homeowner: 'Ιδιοκτήτης μονάδας', newsletter: 'Newsletter',
  seller: 'Πωλητής γης/ακινήτου', partner: 'Συνεργάτης / μεσίτης', tenant: 'Ενοικιαστής', supplier: 'Προμηθευτής',
};
export const ROLE_TONE: Record<string, string> = {
  lead: 'badge-champagne', buyer: 'badge-forest', investor: 'badge-forest', homeowner: 'badge-forest',
  newsletter: 'badge-neutral', seller: 'badge-neutral', partner: 'badge-neutral', tenant: 'badge-neutral', supplier: 'badge-neutral',
};
export const FLAG_COLUMN: Record<FlagRole, string> = {
  lead: 'is_lead', buyer: 'is_buyer', investor: 'is_investor', homeowner: 'is_homeowner', newsletter: 'is_newsletter_subscriber',
};

export const CONTACT_STATUSES = ['active', 'inactive', 'do_not_contact', 'archived'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export const STATUS_EL: Record<ContactStatus, string> = {
  active: 'Ενεργή', inactive: 'Ανενεργή', do_not_contact: 'Όχι επικοινωνία', archived: 'Αρχειοθετημένη',
};
export const STATUS_TONE: Record<ContactStatus, string> = {
  active: 'badge-forest', inactive: 'badge-neutral', do_not_contact: 'badge-champagne', archived: 'badge-neutral',
};

export const SOURCE_EL: Record<string, string> = {
  website: 'Ιστοσελίδα', meta: 'Facebook / Instagram', google: 'Google', organic: 'Οργανικά', referral: 'Σύσταση',
  walk_in: 'Επίσκεψη στο γραφείο', whatsapp: 'WhatsApp', other: 'Άλλο', manual: 'Καταχώριση από το προσωπικό',
};

/** Μία γραμμή της λίστας επαφών. */
export interface ContactListRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  roles: ContactRole[];
  status: ContactStatus;
  ownerId: string | null;
  ownerName: string | null;
  source: string | null;
  tags: string[];
  groups: string[];
  language: string | null;
  createdAt: string;
  lastContactAt: string | null;
  openLeads: number;
  kycStatus: string | null;
  value: number;  // αξία συμβολαίων
  paid: number;   // εισπραγμένα
}

export interface ContactFilters {
  q: string;
  role: ContactRole | '';
  status: ContactStatus | '' | 'all';
  owner: string; // '' όλοι · 'none' χωρίς υπεύθυνο · uuid
  tag: string;
  group: string;
  source: string;
  kyc: '' | 'verified' | 'pending' | 'none';
  quietDays: number; // 0 = όλοι · 30 = χωρίς επαφή 30+ μέρες
  /** Φίλτρο ημερομηνίας: ποια ημερομηνία και διάστημα (YYYY-MM-DD, κενό = χωρίς όριο). */
  dateField: 'created' | 'last_contact';
  dateFrom: string;
  dateTo: string;
  sort: 'recent' | 'name' | 'last_contact' | 'value';
}
export const DEFAULT_FILTERS: ContactFilters = { q: '', role: '', status: '', owner: '', tag: '', group: '', source: '', kyc: '', quietDays: 0, dateField: 'created', dateFrom: '', dateTo: '', sort: 'recent' };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Φίλτρα της λίστας. Η «κατάσταση» κενή = όλες εκτός από αρχειοθετημένες. */
export function filterContacts(rows: ContactListRow[], f: ContactFilters, now = Date.now()): ContactListRow[] {
  const q = norm(f.q.trim());
  const qDigits = f.q.replace(/\D/g, '');
  const out = rows.filter((r) => {
    if (q) {
      const hay = norm([r.name, r.email ?? '', ...r.tags, ...r.groups].join(' '));
      const phoneHit = qDigits.length >= 3 && (r.phone ?? '').replace(/\D/g, '').includes(qDigits);
      if (!hay.includes(q) && !phoneHit) return false;
    }
    if (f.role && !r.roles.includes(f.role)) return false;
    if (f.status === '' && r.status === 'archived') return false;
    if (f.status && f.status !== 'all' && r.status !== f.status) return false;
    if (f.owner === 'none' && r.ownerId) return false;
    if (f.owner && f.owner !== 'none' && r.ownerId !== f.owner) return false;
    if (f.tag && !r.tags.includes(f.tag)) return false;
    if (f.group && !r.groups.includes(f.group)) return false;
    if (f.source && (r.source ?? 'manual') !== f.source) return false;
    if (f.kyc === 'verified' && r.kycStatus !== 'verified') return false;
    if (f.kyc === 'pending' && !(r.kycStatus && r.kycStatus !== 'verified')) return false;
    if (f.kyc === 'none' && r.kycStatus) return false;
    if (f.dateFrom || f.dateTo) {
      const iso = f.dateField === 'last_contact' ? r.lastContactAt : r.createdAt;
      if (!iso) return false;
      const d = new Date(iso); const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (f.dateFrom && day < f.dateFrom) return false;
      if (f.dateTo && day > f.dateTo) return false;
    }
    if (f.quietDays > 0) {
      const last = r.lastContactAt ? Date.parse(r.lastContactAt) : Date.parse(r.createdAt);
      if (now - last < f.quietDays * 86_400_000) return false;
    }
    return true;
  });
  const by: Record<ContactFilters['sort'], (a: ContactListRow, b: ContactListRow) => number> = {
    recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
    name: (a, b) => a.name.localeCompare(b.name, 'el'),
    last_contact: (a, b) => (a.lastContactAt ?? '').localeCompare(b.lastContactAt ?? ''),
    value: (a, b) => b.value - a.value,
  };
  return out.sort(by[f.sort]);
}

/** Μετρητές ανά ιδιότητα (για τα chips πάνω από τη λίστα). */
export function roleCounts(rows: ContactListRow[]): Record<string, number> {
  const c: Record<string, number> = { all: 0 };
  for (const r of rows) {
    if (r.status === 'archived') continue;
    c.all += 1;
    for (const role of r.roles) c[role] = (c[role] ?? 0) + 1;
  }
  return c;
}

/** Ρόλοι από μια γραμμή της βάσης. */
export function rolesFromRow(c: any): ContactRole[] {
  const roles: ContactRole[] = [];
  for (const r of FLAG_ROLES) if (c[FLAG_COLUMN[r]]) roles.push(r);
  for (const r of Array.isArray(c.extra_roles) ? c.extra_roles : []) if ((EXTRA_ROLES as readonly string[]).includes(r)) roles.push(r as ContactRole);
  return roles;
}

/** Από λίστα ρόλων → στήλες της βάσης. */
export function rolesToColumns(roles: ContactRole[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of FLAG_ROLES) out[FLAG_COLUMN[r]] = roles.includes(r);
  out.extra_roles = EXTRA_ROLES.filter((r) => roles.includes(r));
  return out;
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** CSV με τις επαφές όπως φαίνονται (φίλτρα εφαρμοσμένα). */
export function contactsCsv(rows: ContactListRow[]): string {
  const head = ['Όνομα', 'Email', 'Τηλέφωνο', 'Ιδιότητες', 'Κατάσταση', 'Υπεύθυνος', 'Πηγή', 'Tags', 'Ομάδες', 'Τελευταία επαφή', 'Καταχώριση', 'Αξία συμβολαίων', 'Εισπραγμένα'];
  const lines = rows.map((r) => [
    r.name, r.email, r.phone, r.roles.map((x) => ROLE_EL[x]).join(' / '), STATUS_EL[r.status], r.ownerName,
    SOURCE_EL[r.source ?? 'manual'] ?? r.source, r.tags.join(' / '), r.groups.join(' / '),
    r.lastContactAt?.slice(0, 10) ?? '', r.createdAt.slice(0, 10), r.value || '', r.paid || '',
  ].map(csvCell).join(','));
  return '﻿' + [head.join(','), ...lines].join('\n');
}

/* ── Ιστορικό ──────────────────────────────────────────────────────────── */

export interface ContactEvent { id: string; kind: string; from: string | null; to: string | null; note: string | null; actor: string | null; at: string }

/** Μία πρόταση για κάθε γεγονός. `names` = id υπεύθυνου → όνομα. */
export function eventText(e: ContactEvent, names: Record<string, string> = {}): string {
  const role = (k: string | null) => (k ? ROLE_EL[k] ?? k : '—');
  switch (e.kind) {
    case 'created': return `Καταχωρήθηκε η επαφή (${SOURCE_EL[e.to ?? 'manual'] ?? e.to})`;
    case 'role_added': return `Έγινε ${role(e.to)}`;
    case 'role_removed': return `Δεν είναι πλέον ${role(e.to)}`;
    case 'status': return `Κατάσταση: ${STATUS_EL[e.from as ContactStatus] ?? e.from ?? '—'} → ${STATUS_EL[e.to as ContactStatus] ?? e.to}`;
    case 'owner': return e.to ? `Υπεύθυνος: ${names[e.to] ?? 'άλλος χρήστης'}${e.from ? ` (πριν: ${names[e.from] ?? 'άλλος'})` : ''}` : 'Αφαιρέθηκε ο υπεύθυνος';
    case 'converted': return `Μετατροπή: ${role(e.from)} → ${role(e.to)}`;
    case 'lead': return `Νέο lead${e.to ? ` (${SOURCE_EL[e.to] ?? e.to})` : ''}`;
    case 'note': return 'Σημείωση';
    default: return e.kind;
  }
}

/** Γρήγορες μετατροπές που προτείνονται ανάλογα με τις τωρινές ιδιότητες. */
export function suggestedConversions(roles: ContactRole[]): { from: ContactRole | null; to: ContactRole; label: string }[] {
  const out: { from: ContactRole | null; to: ContactRole; label: string }[] = [];
  if (roles.includes('lead') && !roles.includes('buyer')) out.push({ from: 'lead', to: 'buyer', label: 'Lead → Αγοραστής' });
  if (roles.includes('buyer') && !roles.includes('investor')) out.push({ from: null, to: 'investor', label: '+ Επενδυτής' });
  if (roles.includes('buyer') && !roles.includes('homeowner')) out.push({ from: null, to: 'homeowner', label: '+ Ιδιοκτήτης μονάδας' });
  if (!roles.includes('lead') && !roles.includes('buyer')) out.push({ from: null, to: 'lead', label: '+ Lead' });
  return out;
}
