/**
 * Πρόοδος κατασκευής (βήμα 11γ) — client-safe.
 * Μια ενημέρωση ανήκει σε όλο το έργο, σε ένα κτίριο ή σε μία μονάδα, έχει
 * κείμενο, προαιρετικό ποσοστό προόδου και φωτογραφίες στο bucket project-media.
 */
import type { Lang } from '@/lib/locale-shared';

export interface UpdatePhoto { path: string; caption?: string | null }
export interface ConstructionUpdate {
  id: string;
  projectId: string;
  buildingId: string | null;
  buildingName: string | null;
  unitId: string | null;
  unitNumber: string | null;
  title: string;
  body: string | null;
  progress: number | null;
  milestoneType: string | null;
  photos: (UpdatePhoto & { url: string | null })[];
  visible: boolean;
  notifiedAt: string | null;
  createdAt: string;
  by: string | null;
}

export const MILESTONES: { value: string; el: string; en: string; ru: string }[] = [
  { value: 'permits', el: 'Άδειες', en: 'Permits & approvals', ru: 'Разрешения' },
  { value: 'excavation', el: 'Εκσκαφή & θεμέλια', en: 'Excavation & foundations', ru: 'Котлован и фундамент' },
  { value: 'structure', el: 'Σκελετός', en: 'Structure', ru: 'Каркас' },
  { value: 'mep', el: 'Ηλεκτρομηχανολογικά', en: 'Mechanical, electrical & plumbing', ru: 'Инженерные системы' },
  { value: 'finishes', el: 'Τελειώματα', en: 'Interior finishes', ru: 'Отделка' },
  { value: 'delivery', el: 'Παράδοση', en: 'Delivery & handover', ru: 'Сдача' },
];
export const milestoneLabel = (v: string | null, lang: Lang = 'el') => {
  const m = MILESTONES.find((x) => x.value === v);
  return m ? m[lang] : null;
};

/** Photos the browser says it uploaded: only paths under this project's construction folder. */
export function cleanPhotos(x: unknown, projectId: string): UpdatePhoto[] {
  const prefix = `${projectId}/construction/`;
  const out: UpdatePhoto[] = [];
  for (const p of Array.isArray(x) ? x : []) {
    const path = String((p as any)?.path ?? '');
    if (!path.startsWith(prefix) || path.includes('..') || path.length > 400) continue;
    out.push({ path, caption: String((p as any)?.caption ?? '').trim().slice(0, 200) || null });
    if (out.length >= 30) break;
  }
  return out;
}

export function scopeLabel(u: Pick<ConstructionUpdate, 'buildingName' | 'unitNumber'>, lang: Lang = 'el', mine = false): string {
  if (u.unitNumber) return mine ? (lang === 'el' ? 'Η μονάδα σας' : lang === 'ru' ? 'Ваш объект' : 'Your unit') : `${lang === 'el' ? 'Μονάδα' : lang === 'ru' ? 'Объект' : 'Unit'} ${u.unitNumber}`;
  if (u.buildingName) return u.buildingName;
  return lang === 'el' ? 'Όλο το έργο' : lang === 'ru' ? 'Весь проект' : 'Whole project';
}
