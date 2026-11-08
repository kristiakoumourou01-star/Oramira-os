import type { Lang } from '@/lib/locale-shared';
import type { OrgSettings } from '@/lib/org-settings-shared';

/**
 * Αγγλικά για τα προεπιλεγμένα ονόματα (στάδια, pipelines, αποτελέσματα κ.λπ.),
 * ώστε να μεταφράζονται χωρίς να γράψετε τίποτα. Ό,τι γράψετε εσείς στο πεδίο
 * «English» έχει προτεραιότητα· ό,τι δεν έχει αγγλικά μένει όπως το γράψατε.
 */
export const DEFAULT_EN: Record<string, string> = {
  // στάδια
  'Νέο': 'New', 'Επικοινωνία': 'Contacted', 'Ενδιαφέρον': 'Interested', 'Κατάλληλο': 'Qualified', 'Αναμονή': 'On hold',
  'Προβολή': 'Viewing', 'Προσφορά': 'Offer', 'Διαπραγμάτευση': 'Negotiation', 'Κράτηση': 'Reservation',
  'Κλείσιμο': 'Closed', 'Κλείσιμο (Won)': 'Closed (Won)', 'Προκαταβολή': 'Deposit', 'Πρώτη συζήτηση': 'First call',
  'Πρόταση': 'Proposal', 'Όροι': 'Terms', 'Συμφωνία': 'Agreement', 'Χάθηκε': 'Lost', 'Για αργότερα': 'Later',
  'Χωρίς απάντηση': 'No response', 'Επανενεργοποίηση': 'Reactivation', 'Δεν ενδιαφέρεται': 'Not interested',
  // pipelines
  'Πωλήσεις νέων έργων': 'New project sales', 'Μεταπωλήσεις': 'Resales', 'Επενδυτές': 'Investors',
  // αποτελέσματα
  'Αγόρασε αλλού': 'Bought elsewhere', 'Τιμή / budget': 'Price / budget', 'Δεν βρέθηκε κατάλληλο ακίνητο': 'No suitable property',
  'Δεν πήρε δάνειο / χρηματοδότηση': 'No loan / financing', 'Τοποθεσία': 'Location', 'Διπλή εγγραφή / λάθος στοιχεία': 'Duplicate / wrong details',
  'Όχι τώρα — αργότερα': 'Not now — later', 'Δεν απαντά': 'Not answering',
};

/** Το όνομα στη γλώσσα που βλέπει ο χρήστης. */
export function pickName(name: string, en: string | undefined, lang: Lang): string {
  if (lang === 'el') return name;
  return (en ?? '').trim() || DEFAULT_EN[name] || name;
}

/** Το αγγλικό που προτείνεται (placeholder) για ένα ελληνικό όνομα. */
export const suggestEn = (name: string) => DEFAULT_EN[name.trim()] ?? '';

/**
 * Οι ρυθμίσεις με τα ονόματα στη γλώσσα του χρήστη. ΜΟΝΟ για εμφάνιση — ό,τι
 * αποθηκεύει ρυθμίσεις διαβάζει τις αμετάφραστες (getOrgSettingsRaw).
 */
export function localizeSettings(s: OrgSettings, lang: Lang): OrgSettings {
  if (lang === 'el') return s;
  const p = s.pipelines;
  return {
    ...s,
    pipelines: {
      ...p,
      pipelines: p.pipelines.map((pl) => ({ ...pl, name: pickName(pl.name, pl.en, lang), stages: pl.stages.map((st) => ({ ...st, label: pickName(st.label, st.en, lang) })) })),
      lostReasons: p.lostReasons.map((r) => ({ ...r, label: pickName(r.label, r.en, lang) })),
    },
    departments: { ...s.departments, items: s.departments.items.map((d) => ({ ...d, name: pickName(d.name, d.en, lang) })) },
    tags: { ...s.tags, fields: s.tags.fields.map((f) => ({ ...f, name: pickName(f.name, f.en, lang) })) },
    menu: {
      ...s.menu,
      items: s.menu.items.map((it) => ({
        ...it,
        ...(it.en?.trim() ? { label: it.en.trim() } : {}),
        children: it.children?.map((c) => (c.en?.trim() ? { ...c, label: c.en.trim() } : c)),
      })),
    },
  };
}
