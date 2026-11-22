/**
 * Ρυθμίσεις της εφαρμογής κινητού (Admin → Mobile app). Client-safe.
 * Δύο εφαρμογές με την ίδια δομή, όπως στο FitnessCRM:
 *  - Customer app: ό,τι βλέπουν ιδιοκτήτες, αγοραστές και επενδυτές
 *  - Admin app: ό,τι βλέπει η ομάδα στο κινητό
 * Κάθε αρχική οθόνη είναι λίστα από μπλοκ (σειρά, ορατότητα, τίτλος, κείμενο).
 * Αποθηκεύεται στο org_settings.data.mobileApp.
 */
export type MobileAppKind = 'customer' | 'admin';
export interface MobileBlock {
  key: string; on: boolean; title?: string; text?: string;
  /** Δημόσιο URL εικόνας (bucket app-media). */
  image?: string;
  /** Κουμπί του μπλοκ: ετικέτα και σύνδεσμος. */
  button?: string; link?: string;
}
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
  /** Εμφάνιση μόνο των διαθέσιμων μονάδων (όχι κρατημένες / πουλημένες). */
  availableOnly: boolean;
  /** Οι πελάτες μπορούν να ζητήσουν διαγραφή λογαριασμού (το απαιτεί η Apple). */
  allowDeletion: boolean;
  /** Πόσες συσκευές ανά πελάτη· 0 = απεριόριστες. */
  devicesPerMember: number;
  termsText: string;
  regFields: Record<string, { show: boolean; required: boolean }>;
  profileFields: Record<string, boolean>;
  welcomeEn: string; welcomeRu: string;
  tiktok: string; youtube: string;
  /** Χρώματα εφαρμογής (#RRGGBB)· κενό = το χρώμα της εταιρείας. */
  colorPrimary: string; colorSecondary: string;
  appleWallet: { bg: string; text: string; label: string; logoText: string; description: string; logo: string };
  googleWallet: { bg: string; title: string; subheader: string; logoAlt: string; logo: string };
  /** Admin app: ποιες ενότητες βλέπει κάθε ρόλος (ο Κάτοχος βλέπει όλες). */
  adminModules: Record<string, string[]>;
}

/** Πεδία εγγραφής πελάτη στην εφαρμογή. `locked`: πάντα εμφανίζεται και είναι υποχρεωτικό. */
export const REG_FIELDS: { key: string; label: string; locked?: boolean; show: boolean; required: boolean }[] = [
  { key: 'firstName', label: 'Όνομα', locked: true, show: true, required: true },
  { key: 'lastName', label: 'Επώνυμο', locked: true, show: true, required: true },
  { key: 'email', label: 'Email', show: true, required: true },
  { key: 'mobile', label: 'Κινητό', show: true, required: true },
  { key: 'dob', label: 'Ημερομηνία γέννησης', show: false, required: false },
  { key: 'nationality', label: 'Υπηκοότητα', show: true, required: false },
  { key: 'idNumber', label: 'Ταυτότητα / Διαβατήριο', show: false, required: false },
  { key: 'address', label: 'Διεύθυνση', show: false, required: false },
  { key: 'city', label: 'Πόλη', show: false, required: false },
  { key: 'country', label: 'Χώρα', show: true, required: false },
  { key: 'buyerType', label: 'Αγοραστής ή επενδυτής', show: true, required: false },
  { key: 'budget', label: 'Προϋπολογισμός', show: false, required: false },
  { key: 'interest', label: 'Ενδιαφέρον για έργο', show: true, required: false },
  { key: 'language', label: 'Γλώσσα επικοινωνίας', show: true, required: false },
  { key: 'receiveSms', label: 'Δέχεται SMS', show: true, required: false },
  { key: 'receiveEmail', label: 'Δέχεται email', show: true, required: false },
  { key: 'receivePush', label: 'Δέχεται ειδοποιήσεις', show: true, required: false },
  { key: 'signature', label: 'Ψηφιακή υπογραφή', show: false, required: false },
  { key: 'terms', label: 'Αποδοχή όρων', show: true, required: true },
  { key: 'photo', label: 'Φωτογραφία προφίλ', show: false, required: false },
];

/** Πεδία προφίλ που ο πελάτης αλλάζει μόνος του. */
export const PROFILE_FIELDS: { key: string; label: string; on: boolean }[] = [
  { key: 'firstName', label: 'Όνομα', on: true },
  { key: 'lastName', label: 'Επώνυμο', on: true },
  { key: 'email', label: 'Email', on: true },
  { key: 'mobile', label: 'Κινητό', on: false },
  { key: 'address', label: 'Διεύθυνση', on: true },
  { key: 'language', label: 'Γλώσσα επικοινωνίας', on: true },
  { key: 'photo', label: 'Φωτογραφία προφίλ', on: true },
];

/** Ενότητες της εφαρμογής ομάδας (Admin app). */
export const ADMIN_APP_MODULES: { key: string; label: string }[] = [
  { key: 'leads', label: 'Leads' },
  { key: 'followups', label: 'Follow-ups' },
  { key: 'calendar', label: 'Ημερολόγιο' },
  { key: 'tasks', label: 'Εργασίες' },
  { key: 'projects', label: 'Έργα & διαθεσιμότητα' },
  { key: 'deals', label: 'Πωλήσεις' },
  { key: 'maintenance', label: 'Συντήρηση' },
  { key: 'documents', label: 'Έγγραφα' },
  { key: 'financials', label: 'Οικονομικά' },
  { key: 'reports', label: 'Αναφορές' },
  { key: 'hr', label: 'Άδειες & προσωπικό' },
];
/** Οι ρόλοι που ρυθμίζονται (ο Κάτοχος βλέπει πάντα όλες τις ενότητες). */
export const ADMIN_APP_ROLES = ['management', 'sales', 'finance', 'construction', 'viewer'] as const;

export interface BlockDef {
  key: string; label: string; hint: string; locked?: boolean;
  /** Has a body text the owner writes (e.g. the banner). */ text?: boolean;
  /** Δείχνει εικόνα που ανεβάζει ο ιδιοκτήτης. */ image?: boolean;
  /** Έχει κουμπί με ετικέτα και σύνδεσμο. */ button?: boolean;
}

export const BLOCK_CATALOG: BlockDef[] = [
  { key: 'header', label: 'Κεφαλίδα', hint: 'Καλωσόρισμα, αναζήτηση και ειδοποιήσεις. Δεν μετακινείται.', locked: true },
  { key: 'hero', label: 'Μεγάλη εικόνα', hint: 'Φωτογραφία σε όλο το πλάτος με τίτλο και κουμπί.', text: true, image: true, button: true },
  { key: 'banner', label: 'Ανακοίνωση / banner', hint: 'Μεγάλη κάρτα με μήνυμα ή προσφορά.', text: true, image: true, button: true },
  { key: 'my_unit', label: 'Το ακίνητό μου', hint: 'Η μονάδα του πελάτη με φωτογραφία και κατάσταση.', image: true },
  { key: 'construction', label: 'Πρόοδος κατασκευής', hint: 'Ποσοστό και τελευταίες φωτογραφίες από το εργοτάξιο.', image: true },
  { key: 'payments', label: 'Πληρωμές', hint: 'Επόμενη δόση και πρόγραμμα πληρωμών.' },
  { key: 'documents', label: 'Έγγραφα', hint: 'Συμβόλαια, τίτλοι, εγγυήσεις.' },
  { key: 'maintenance', label: 'Αίτημα συντήρησης', hint: 'Κουμπί για δήλωση βλάβης — ειδοποιεί την ομάδα.' },
  { key: 'projects', label: 'Έργα & διαθέσιμα ακίνητα', hint: 'Τα έργα που επιλέγετε στο Content.', image: true },
  { key: 'viewings', label: 'Κλείστε προβολή', hint: 'Κουμπί για ραντεβού προβολής.' },
  { key: 'agent', label: 'Ο σύμβουλός σας', hint: 'Στοιχεία και κουμπιά κλήσης / WhatsApp.' },
  { key: 'notice', label: 'Σημείωμα', hint: 'Ελεύθερο κείμενο, π.χ. ωράριο γραφείου ή οδηγίες.', text: true, image: true },
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
  { key: 'announcement', label: 'Ανακοίνωση για την ομάδα', hint: 'Μήνυμα της διοίκησης προς όλους.', text: true, image: true, button: true },
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
  availableOnly: false, allowDeletion: true, devicesPerMember: 0, termsText: '',
  regFields: Object.fromEntries(REG_FIELDS.map((f) => [f.key, { show: f.show, required: f.required }])),
  profileFields: Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, f.on])),
  welcomeEn: 'Welcome home 👋', welcomeRu: 'Добро пожаловать домой 👋',
  tiktok: '', youtube: '',
  colorPrimary: '', colorSecondary: '',
  appleWallet: { bg: '', text: '', label: '', logoText: '', description: '', logo: '' },
  googleWallet: { bg: '', title: '', subheader: '', logoAlt: '', logo: '' },
  adminModules: Object.fromEntries(ADMIN_APP_ROLES.map((r) => [r, ADMIN_APP_MODULES.map((m) => m.key)])),
};

const HEX = /^#[0-9a-fA-F]{6}$/;
/** Έγκυρο χρώμα #RRGGBB ή κενό. */
export const hexOrEmpty = (v: unknown) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toUpperCase() : '');
/** Μόνο http(s) URL (εικόνες στο bucket app-media). */
export const urlOrEmpty = (v: unknown) => (typeof v === 'string' && /^https?:\/\/\S+$/.test(v.trim()) ? v.trim().slice(0, 600) : '');
/** Λευκά ή σκούρα γράμματα πάνω σε ένα χρώμα (#RRGGBB). */
export function contrastText(hex: string): 'light' | 'dark' {
  if (!HEX.test(hex)) return 'light';
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? 'dark' : 'light';
}

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
    const img = urlOrEmpty(b.image);
    const btn = s(b.button, 40).trim();
    const link = s(b.link, 300).trim();
    blocks.push({ key: b.key, on: b.on !== false, ...(t ? { title: t } : {}), ...(x ? { text: x } : {}), ...(img ? { image: img } : {}), ...(btn ? { button: btn } : {}), ...(link ? { link } : {}) });
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
    availableOnly: b('availableOnly'), allowDeletion: b('allowDeletion'),
    devicesPerMember: Math.max(0, Math.min(20, Math.round(Number(x.devicesPerMember) || 0))),
    termsText: s(x.termsText, 8000),
    regFields: Object.fromEntries(REG_FIELDS.map((f) => {
      const r = x.regFields && typeof x.regFields === 'object' ? x.regFields[f.key] : null;
      if (f.locked) return [f.key, { show: true, required: true }];
      const show = typeof r?.show === 'boolean' ? r.show : f.show;
      return [f.key, { show, required: show && (typeof r?.required === 'boolean' ? r.required : f.required) }];
    })),
    profileFields: Object.fromEntries(PROFILE_FIELDS.map((f) => {
      const r = x.profileFields && typeof x.profileFields === 'object' ? x.profileFields[f.key] : undefined;
      return [f.key, typeof r === 'boolean' ? r : f.on];
    })),
    welcomeEn: s(x.welcomeEn ?? DEFAULT_MOBILE.welcomeEn, 120), welcomeRu: s(x.welcomeRu ?? DEFAULT_MOBILE.welcomeRu, 120),
    tiktok: s(x.tiktok, 200), youtube: s(x.youtube, 200),
    colorPrimary: hexOrEmpty(x.colorPrimary), colorSecondary: hexOrEmpty(x.colorSecondary),
    appleWallet: (() => { const a = x.appleWallet && typeof x.appleWallet === 'object' ? x.appleWallet : {}; return { bg: hexOrEmpty(a.bg), text: hexOrEmpty(a.text), label: hexOrEmpty(a.label), logoText: s(a.logoText, 40), description: s(a.description, 120), logo: urlOrEmpty(a.logo) }; })(),
    googleWallet: (() => { const g = x.googleWallet && typeof x.googleWallet === 'object' ? x.googleWallet : {}; return { bg: hexOrEmpty(g.bg), title: s(g.title, 60), subheader: s(g.subheader, 60), logoAlt: s(g.logoAlt, 60), logo: urlOrEmpty(g.logo) }; })(),
    adminModules: Object.fromEntries(ADMIN_APP_ROLES.map((r) => {
      const v = x.adminModules && typeof x.adminModules === 'object' ? x.adminModules[r] : undefined;
      const known = ADMIN_APP_MODULES.map((m) => m.key);
      return [r, Array.isArray(v) ? known.filter((k) => v.includes(k)) : known];
    })),
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
