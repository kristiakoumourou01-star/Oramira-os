import type { Lang } from '@/lib/locale-shared';
import type { OrgSettings } from '@/lib/org-settings-shared';

/** Μεταφράσεις ανά κείμενο: { "Λεμεσός": { en: "Limassol", ru: "Лимасол" } }. */
export type LabelMap = Record<string, Partial<Record<Lang, string>>>;

/** Έτοιμες μεταφράσεις για τα προεπιλεγμένα ονόματα (δεν χρειάζονται υπηρεσία). */
const D: Record<string, [string, string]> = {
  'Νέο': ['New', 'Новый'], 'Επικοινωνία': ['Contacted', 'Контакт'], 'Ενδιαφέρον': ['Interested', 'Интерес'],
  'Κατάλληλο': ['Qualified', 'Квалифицирован'], 'Αναμονή': ['On hold', 'Ожидание'], 'Προβολή': ['Viewing', 'Просмотр'],
  'Προσφορά': ['Offer', 'Предложение'], 'Διαπραγμάτευση': ['Negotiation', 'Переговоры'], 'Κράτηση': ['Reservation', 'Бронь'],
  'Κλείσιμο': ['Closed', 'Закрыто'], 'Κλείσιμο (Won)': ['Closed (Won)', 'Закрыто (успех)'], 'Προκαταβολή': ['Deposit', 'Задаток'],
  'Πρώτη συζήτηση': ['First call', 'Первая беседа'], 'Πρόταση': ['Proposal', 'Предложение'], 'Όροι': ['Terms', 'Условия'],
  'Συμφωνία': ['Agreement', 'Соглашение'], 'Χάθηκε': ['Lost', 'Потерян'], 'Για αργότερα': ['Later', 'На потом'],
  'Χωρίς απάντηση': ['No response', 'Нет ответа'], 'Επανενεργοποίηση': ['Reactivation', 'Реактивация'],
  'Δεν ενδιαφέρεται': ['Not interested', 'Не заинтересован'], 'Lost': ['Lost', 'Потерян'], 'Not interested': ['Not interested', 'Не заинтересован'],
  'Πωλήσεις νέων έργων': ['New project sales', 'Продажи новых проектов'], 'Μεταπωλήσεις': ['Resales', 'Перепродажи'], 'Επενδυτές': ['Investors', 'Инвесторы'],
  'Αγόρασε αλλού': ['Bought elsewhere', 'Купил в другом месте'], 'Τιμή / budget': ['Price / budget', 'Цена / бюджет'],
  'Δεν βρέθηκε κατάλληλο ακίνητο': ['No suitable property', 'Не нашлось подходящего объекта'],
  'Δεν πήρε δάνειο / χρηματοδότηση': ['No loan / financing', 'Не получил кредит / финансирование'], 'Τοποθεσία': ['Location', 'Расположение'],
  'Διπλή εγγραφή / λάθος στοιχεία': ['Duplicate / wrong details', 'Дубликат / неверные данные'],
  'Όχι τώρα — αργότερα': ['Not now — later', 'Не сейчас — позже'], 'Δεν απαντά': ['Not answering', 'Не отвечает'],
};

/** Σε ποια γλώσσα είναι γραμμένο ένα κείμενο (από το αλφάβητο). */
export function scriptLang(text: string): Lang {
  if (/[Ͱ-Ͽἀ-῿]/.test(text)) return 'el';
  if (/[Ѐ-ӿ]/.test(text)) return 'ru';
  return 'en';
}

/** Το όνομα στη γλώσσα του χρήστη — αυτόματη μετάφραση, αλλιώς όπως γράφτηκε. */
export function pickName(name: string, lang: Lang, map: LabelMap = {}): string {
  const t = (name ?? '').trim();
  if (!t || scriptLang(t) === lang) return name;
  const d = D[t];
  if (d && lang !== 'el') return lang === 'en' ? d[0] : d[1];
  return map[t]?.[lang] || name;
}

/** Ονόματα που χρειάζονται μετάφραση (ό,τι δεν καλύπτουν οι έτοιμες). */
export function settingsNames(s: OrgSettings): string[] {
  const out = new Set<string>();
  const add = (x?: string) => { const t = (x ?? '').trim(); if (t && !D[t] && t.length <= 120) out.add(t); };
  for (const p of s.pipelines.pipelines) { add(p.name); p.stages.forEach((st) => add(st.label)); }
  s.pipelines.lostReasons.forEach((r) => add(r.label));
  s.departments.items.forEach((d) => add(d.name));
  s.departments.rooms.forEach((r) => add(r.name));
  for (const f of s.tags.fields) add(f.name); // οι επιλογές (Choice) είναι τιμές που αποθηκεύονται — δεν μεταφράζονται
  for (const it of s.menu.items) { add(it.label); (it.children ?? []).forEach((c) => add(c.label)); }
  s.roles.custom.forEach((r) => add(r.name));
  return [...out];
}

/**
 * Οι ρυθμίσεις με τα ονόματα στη γλώσσα του χρήστη. ΜΟΝΟ για εμφάνιση — ό,τι
 * αποθηκεύει ρυθμίσεις διαβάζει τις αμετάφραστες (getOrgSettingsRaw).
 */
export function localizeSettings(s: OrgSettings, lang: Lang, map: LabelMap = {}): OrgSettings {
  const n = (x: string) => pickName(x, lang, map);
  const p = s.pipelines;
  return {
    ...s,
    pipelines: {
      ...p,
      pipelines: p.pipelines.map((pl) => ({ ...pl, name: n(pl.name), stages: pl.stages.map((st) => ({ ...st, label: n(st.label) })) })),
      lostReasons: p.lostReasons.map((r) => ({ ...r, label: n(r.label) })),
    },
    departments: { ...s.departments, items: s.departments.items.map((d) => ({ ...d, name: n(d.name) })), rooms: s.departments.rooms.map((r) => ({ ...r, name: n(r.name) })) },
    tags: { ...s.tags, fields: s.tags.fields.map((f) => ({ ...f, name: n(f.name) })) },
    menu: {
      ...s.menu,
      items: s.menu.items.map((it) => ({
        ...it,
        ...(it.label ? { label: n(it.label) } : {}),
        children: it.children?.map((c) => (c.label ? { ...c, label: n(c.label) } : c)),
      })),
    },
    roles: { ...s.roles, custom: s.roles.custom.map((r) => ({ ...r, name: n(r.name) })) },
  };
}
