/** Ρυθμίσεις της εφαρμογής πελατών (Admin → Mobile app). Client-safe. */
export interface MobileBlock { key: string; on: boolean; title?: string }
export interface MobileProject { id: string; shown: boolean; tagline?: string }
export interface MobileAppSettings {
  blocks: MobileBlock[];
  projects: MobileProject[];
  appEnabled: boolean; showPrices: boolean; showAvailability: boolean; allowViewings: boolean; allowMaintenance: boolean;
  showPayments: boolean; showDocuments: boolean; showConstruction: boolean; selfRegister: boolean; autoApprove: boolean;
  loginMethod: 'email' | 'sms'; welcome: string; supportPhone: string; supportEmail: string; instagram: string; facebook: string; website: string;
}

export const BLOCK_CATALOG: { key: string; label: string; hint: string; locked?: boolean }[] = [
  { key: 'header', label: 'Κεφαλίδα', hint: 'Καλωσόρισμα, αναζήτηση και ειδοποιήσεις. Δεν μετακινείται.', locked: true },
  { key: 'banner', label: 'Ανακοίνωση / banner', hint: 'Μεγάλη κάρτα με μήνυμα ή προσφορά.' },
  { key: 'my_unit', label: 'Το ακίνητό μου', hint: 'Η μονάδα του πελάτη με φωτογραφία και κατάσταση.' },
  { key: 'construction', label: 'Πρόοδος κατασκευής', hint: 'Ποσοστό και τελευταίες φωτογραφίες από το εργοτάξιο.' },
  { key: 'payments', label: 'Πληρωμές', hint: 'Επόμενη δόση και πρόγραμμα πληρωμών.' },
  { key: 'documents', label: 'Έγγραφα', hint: 'Συμβόλαια, τίτλοι, εγγυήσεις.' },
  { key: 'maintenance', label: 'Αίτημα συντήρησης', hint: 'Κουμπί για δήλωση βλάβης — ειδοποιεί την ομάδα.' },
  { key: 'projects', label: 'Έργα & διαθέσιμα ακίνητα', hint: 'Τα έργα που επιλέγετε στο Content.' },
  { key: 'viewings', label: 'Κλείστε προβολή', hint: 'Κουμπί για ραντεβού προβολής.' },
  { key: 'agent', label: 'Ο σύμβουλός σας', hint: 'Στοιχεία και κουμπιά κλήσης / WhatsApp.' },
  { key: 'footer', label: 'Υποσέλιδο Oramira', hint: 'Δεν μετακινείται.', locked: true },
];

export const DEFAULT_MOBILE: MobileAppSettings = {
  blocks: ['header', 'banner', 'my_unit', 'construction', 'payments', 'documents', 'maintenance', 'projects', 'agent', 'footer'].map((key) => ({ key, on: true })),
  projects: [],
  appEnabled: true, showPrices: true, showAvailability: true, allowViewings: true, allowMaintenance: true,
  showPayments: true, showDocuments: true, showConstruction: true, selfRegister: false, autoApprove: false,
  loginMethod: 'email', welcome: 'Καλώς ήρθατε στο σπίτι σας 👋', supportPhone: '', supportEmail: '', instagram: '', facebook: '', website: '',
};

const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
export function mergeMobileApp(v: any): MobileAppSettings {
  const x = v && typeof v === 'object' ? v : {};
  const known = new Set(BLOCK_CATALOG.map((b) => b.key));
  const blocks: MobileBlock[] = [];
  for (const b of Array.isArray(x.blocks) ? x.blocks : DEFAULT_MOBILE.blocks) {
    if (!b || !known.has(b.key) || blocks.some((y) => y.key === b.key)) continue;
    const t = s(b.title, 60).trim();
    blocks.push({ key: b.key, on: b.on !== false, ...(t ? { title: t } : {}) });
  }
  // Κεφαλίδα πρώτη, υποσέλιδο τελευταίο, πάντα ενεργά.
  const mid = blocks.filter((b) => b.key !== 'header' && b.key !== 'footer');
  const projects: MobileProject[] = (Array.isArray(x.projects) ? x.projects : []).filter((p: any) => p && typeof p.id === 'string').slice(0, 100).map((p: any) => ({ id: p.id, shown: p.shown !== false, ...(s(p.tagline, 120).trim() ? { tagline: s(p.tagline, 120).trim() } : {}) }));
  const b = (k: keyof MobileAppSettings) => (typeof x[k] === 'boolean' ? x[k] : DEFAULT_MOBILE[k]) as boolean;
  return {
    blocks: [{ key: 'header', on: true }, ...mid, { key: 'footer', on: true }], projects,
    appEnabled: b('appEnabled'), showPrices: b('showPrices'), showAvailability: b('showAvailability'), allowViewings: b('allowViewings'), allowMaintenance: b('allowMaintenance'),
    showPayments: b('showPayments'), showDocuments: b('showDocuments'), showConstruction: b('showConstruction'), selfRegister: b('selfRegister'), autoApprove: b('autoApprove'),
    loginMethod: x.loginMethod === 'sms' ? 'sms' : 'email',
    welcome: s(x.welcome ?? DEFAULT_MOBILE.welcome, 120), supportPhone: s(x.supportPhone, 40), supportEmail: s(x.supportEmail, 120), instagram: s(x.instagram, 200), facebook: s(x.facebook, 200), website: s(x.website, 200),
  };
}
