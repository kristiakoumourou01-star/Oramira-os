/**
 * Ρυθμίσεις της εφαρμογής κινητού (Admin → Mobile app). Client-safe.
 * Δύο εφαρμογές με την ίδια δομή, όπως στο FitnessCRM:
 *  - Customer app: ό,τι βλέπουν ιδιοκτήτες, αγοραστές και επενδυτές
 *  - Admin app: ό,τι βλέπει η ομάδα στο κινητό
 * Κάθε αρχική οθόνη είναι λίστα από μπλοκ (σειρά, ορατότητα, τίτλος, κείμενο).
 * Αποθηκεύεται στο org_settings.data.mobileApp.
 */
export type MobileAppKind = 'customer' | 'admin';
export interface MobileBlock { key: string; on: boolean; title?: string; text?: string }
export interface MobileProject { id: string; shown: boolean; tagline?: string }
export interface MobileAppSettings {
  /** Αρχική οθόνη της εφαρμογής πελατών. */
  blocks: MobileBlock[];
  /** Αρχική οθόνη της εφαρμογής της ομάδας. */
  adminBlocks: MobileBlock[];
  projects: MobileProject[];
  appEnabled: boolean; adminEnabled: boolean;
  showPrices: boolean; showAvailability: boolean; allowViewings: boolean; allowMaintenance: boolean;
  showPayments: boolean; showDocuments: boolean; showConstruction: boolean; selfRegister: boolean; autoApprove: boolean;
  loginMethod: 'email' | 'sms'; welcome: string; adminWelcome: string; supportPhone: string; supportEmail: string; instagram: string; facebook: string; website: string;
}

export interface BlockDef { key: string; label: string; hint: string; locked?: boolean; /** Has a body text the owner writes (e.g. the banner). */ text?: boolean }

export const BLOCK_CATALOG: BlockDef[] = [
  { key: 'header', label: 'Κεφαλίδα', hint: 'Καλωσόρισμα, αναζήτηση και ειδοποιήσεις. Δεν μετακινείται.', locked: true },
  { key: 'banner', label: 'Ανακοίνωση / banner', hint: 'Μεγάλη κάρτα με μήνυμα ή προσφορά.', text: true },
  { key: 'my_unit', label: 'Το ακίνητό μου', hint: 'Η μονάδα του πελάτη με φωτογραφία και κατάσταση.' },
  { key: 'construction', label: 'Πρόοδος κατασκευής', hint: 'Ποσοστό και τελευταίες φωτογραφίες από το εργοτάξιο.' },
  { key: 'payments', label: 'Πληρωμές', hint: 'Επόμενη δόση και πρόγραμμα πληρωμών.' },
  { key: 'documents', label: 'Έγγραφα', hint: 'Συμβόλαια, τίτλοι, εγγυήσεις.' },
  { key: 'maintenance', label: 'Αίτημα συντήρησης', hint: 'Κουμπί για δήλωση βλάβης — ειδοποιεί την ομάδα.' },
  { key: 'projects', label: 'Έργα & διαθέσιμα ακίνητα', hint: 'Τα έργα που επιλέγετε στο Content.' },
  { key: 'viewings', label: 'Κλείστε προβολή', hint: 'Κουμπί για ραντεβού προβολής.' },
  { key: 'agent', label: 'Ο σύμβουλός σας', hint: 'Στοιχεία και κουμπιά κλήσης / WhatsApp.' },
  { key: 'notice', label: 'Σημείωμα', hint: 'Ελεύθερο κείμενο, π.χ. ωράριο γραφείου ή οδηγίες.', text: true },
  { key: 'footer', label: 'Υποσέλιδο', hint: 'Δεν μετακινείται.', locked: true },
];

export const ADMIN_BLOCK_CATALOG: BlockDef[] = [
  { key: 'header', label: 'Κεφαλίδα', hint: 'Καλωσόρισμα του μέλους της ομάδας. Δεν μετακινείται.', locked: true },
  { key: 'kpis', label: 'Νούμερα ημέρας', hint: 'Νέα leads, follow-ups για σήμερα, διαθέσιμες μονάδες.' },
  { key: 'quick_actions', label: 'Γρήγορες ενέργειες', hint: 'Νέο lead, κλήση, ραντεβού, εργασία.' },
  { key: 'agenda', label: 'Το πρόγραμμα της ημέρας', hint: 'Ραντεβού και προβολές σήμερα.' },
  { key: 'followups', label: 'Follow-ups', hint: 'Κλήσεις και δραστηριότητες που λήγουν σήμερα.' },
  { key: 'new_leads', label: 'Νέα leads', hint: 'Τα τελευταία leads με κουμπί κλήσης.' },
  { key: 'tasks', label: 'Εργασίες', hint: 'Οι ανοιχτές εργασίες του χρήστη.' },
  { key: 'approvals', label: 'Εγκρίσεις', hint: 'Άδειες και αιτήματα που περιμένουν (για όσους εγκρίνουν).' },
  { key: 'availability', label: 'Διαθεσιμότητα έργων', hint: 'Διαθέσιμες μονάδες ανά έργο.' },
  { key: 'announcement', label: 'Ανακοίνωση για την ομάδα', hint: 'Μήνυμα της διοίκησης προς όλους.', text: true },
  { key: 'footer', label: 'Υποσέλιδο', hint: 'Δεν μετακινείται.', locked: true },
];

export const catalogFor = (kind: MobileAppKind) => (kind === 'admin' ? ADMIN_BLOCK_CATALOG : BLOCK_CATALOG);

const DEFAULT_CUSTOMER_BLOCKS: MobileBlock[] = ['header', 'banner', 'my_unit', 'construction', 'payments', 'documents', 'maintenance', 'projects', 'agent', 'footer'].map((key) => ({ key, on: true }));
const DEFAULT_ADMIN_BLOCKS: MobileBlock[] = ['header', 'kpis', 'quick_actions', 'agenda', 'followups', 'new_leads', 'tasks', 'approvals', 'footer'].map((key) => ({ key, on: true }));
export const defaultBlocks = (kind: MobileAppKind): MobileBlock[] => (kind === 'admin' ? DEFAULT_ADMIN_BLOCKS : DEFAULT_CUSTOMER_BLOCKS).map((b) => ({ ...b }));

export const DEFAULT_MOBILE: MobileAppSettings = {
  blocks: defaultBlocks('customer'),
  adminBlocks: defaultBlocks('admin'),
  projects: [],
  appEnabled: true, adminEnabled: true,
  showPrices: true, showAvailability: true, allowViewings: true, allowMaintenance: true,
  showPayments: true, showDocuments: true, showConstruction: true, selfRegister: false, autoApprove: false,
  loginMethod: 'email', welcome: 'Καλώς ήρθατε στο σπίτι σας 👋', adminWelcome: 'Καλημέρα 👋', supportPhone: '', supportEmail: '', instagram: '', facebook: '', website: '',
};

const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');

/** Validate one home screen: known blocks once each, header first, footer last. */
function mergeBlocks(raw: unknown, kind: MobileAppKind): MobileBlock[] {
  const cat = catalogFor(kind);
  const known = new Set(cat.map((b) => b.key));
  const blocks: MobileBlock[] = [];
  for (const b of Array.isArray(raw) ? raw : defaultBlocks(kind)) {
    if (!b || !known.has(b.key) || blocks.some((y) => y.key === b.key)) continue;
    const t = s(b.title, 60).trim();
    const x = s(b.text, 400).trim();
    blocks.push({ key: b.key, on: b.on !== false, ...(t ? { title: t } : {}), ...(x ? { text: x } : {}) });
  }
  const head = blocks.find((b) => b.key === 'header');
  const foot = blocks.find((b) => b.key === 'footer');
  const mid = blocks.filter((b) => b.key !== 'header' && b.key !== 'footer');
  return [{ ...(head ?? {}), key: 'header', on: true }, ...mid, { ...(foot ?? {}), key: 'footer', on: true }];
}

export function mergeMobileApp(v: any): MobileAppSettings {
  const x = v && typeof v === 'object' ? v : {};
  const projects: MobileProject[] = (Array.isArray(x.projects) ? x.projects : []).filter((p: any) => p && typeof p.id === 'string').slice(0, 100).map((p: any) => ({ id: p.id, shown: p.shown !== false, ...(s(p.tagline, 120).trim() ? { tagline: s(p.tagline, 120).trim() } : {}) }));
  const b = (k: keyof MobileAppSettings) => (typeof x[k] === 'boolean' ? x[k] : DEFAULT_MOBILE[k]) as boolean;
  return {
    blocks: mergeBlocks(x.blocks, 'customer'),
    adminBlocks: mergeBlocks(x.adminBlocks, 'admin'),
    projects,
    appEnabled: b('appEnabled'), adminEnabled: b('adminEnabled'),
    showPrices: b('showPrices'), showAvailability: b('showAvailability'), allowViewings: b('allowViewings'), allowMaintenance: b('allowMaintenance'),
    showPayments: b('showPayments'), showDocuments: b('showDocuments'), showConstruction: b('showConstruction'), selfRegister: b('selfRegister'), autoApprove: b('autoApprove'),
    loginMethod: x.loginMethod === 'sms' ? 'sms' : 'email',
    welcome: s(x.welcome ?? DEFAULT_MOBILE.welcome, 120), adminWelcome: s(x.adminWelcome ?? DEFAULT_MOBILE.adminWelcome, 120),
    supportPhone: s(x.supportPhone, 40), supportEmail: s(x.supportEmail, 120), instagram: s(x.instagram, 200), facebook: s(x.facebook, 200), website: s(x.website, 200),
  };
}

/**
 * What a signed-in person's app shows: the visible home blocks in order, with
 * customer blocks that a setting switches off already removed (e.g. Payments
 * when "Πληρωμές" is off). Used by the portal / app routes.
 */
export function visibleHome(cfg: MobileAppSettings, kind: MobileAppKind): MobileBlock[] {
  const list = (kind === 'admin' ? cfg.adminBlocks : cfg.blocks).filter((b) => b.on);
  if (kind === 'admin') return list;
  const off: Record<string, boolean> = {
    construction: !cfg.showConstruction, payments: !cfg.showPayments, documents: !cfg.showDocuments,
    maintenance: !cfg.allowMaintenance, viewings: !cfg.allowViewings,
  };
  return list.filter((b) => !off[b.key]);
}

/** A block's title as shown: the owner's own, else the catalogue name. */
export function blockTitle(b: MobileBlock, kind: MobileAppKind): string {
  return b.title ?? catalogFor(kind).find((c) => c.key === b.key)?.label ?? b.key;
}
