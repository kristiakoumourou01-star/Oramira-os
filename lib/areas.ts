/**
 * Περιοχές Κύπρου — για το matching αγοραστών ανά τοποθεσία. Client-safe.
 *
 * Κάθε περιοχή έχει ελληνικό/αγγλικό όνομα, παραλλαγές γραφής και κέντρο
 * (lat/lng). Ένα έργο «βρίσκεται» σε περιοχή αν η τοποθεσία του (κείμενο)
 * περιέχει κάποια παραλλαγή, ή — αν έχει συντεταγμένες — από την απόσταση.
 * Υποπεριοχές (π.χ. Γερμασόγεια) ανήκουν στην πόλη τους (Λεμεσός).
 */

export interface Area { key: string; el: string; en: string; lat: number; lng: number; parent?: string; aliases?: string[] }

export const AREAS: Area[] = [
  // Λεμεσός
  { key: 'limassol', el: 'Λεμεσός', en: 'Limassol', lat: 34.6786, lng: 33.0413, aliases: ['lemesos', 'limasol'] },
  { key: 'germasogeia', el: 'Γερμασόγεια', en: 'Germasogeia', lat: 34.718, lng: 33.088, parent: 'limassol', aliases: ['germasoyia', 'yermasoyia', 'germasogia'] },
  { key: 'agios_athanasios', el: 'Άγιος Αθανάσιος', en: 'Agios Athanasios', lat: 34.709, lng: 33.048, parent: 'limassol', aliases: ['ayios athanasios'] },
  { key: 'mouttagiaka', el: 'Μουτταγιάκα', en: 'Mouttagiaka', lat: 34.723, lng: 33.11, parent: 'limassol', aliases: ['moutagiaka', 'mouttayiaka'] },
  { key: 'agios_tychonas', el: 'Άγιος Τύχωνας', en: 'Agios Tychonas', lat: 34.735, lng: 33.145, parent: 'limassol', aliases: ['ayios tychonas', 'agios tichonas'] },
  { key: 'parekklisia', el: 'Παρεκκλησιά', en: 'Parekklisia', lat: 34.745, lng: 33.155, parent: 'limassol' },
  { key: 'pyrgos_lim', el: 'Πύργος Λεμεσού', en: 'Pyrgos', lat: 34.738, lng: 33.183, parent: 'limassol', aliases: ['pyrgos'] },
  { key: 'mesa_geitonia', el: 'Μέσα Γειτονιά', en: 'Mesa Geitonia', lat: 34.702, lng: 33.04, parent: 'limassol', aliases: ['mesa yitonia'] },
  { key: 'kato_polemidia', el: 'Κάτω Πολεμίδια', en: 'Kato Polemidia', lat: 34.692, lng: 32.995, parent: 'limassol', aliases: ['polemidia'] },
  { key: 'ypsonas', el: 'Ύψωνας', en: 'Ypsonas', lat: 34.688, lng: 32.958, parent: 'limassol', aliases: ['ipsonas'] },
  { key: 'erimi', el: 'Ερήμη', en: 'Erimi', lat: 34.675, lng: 32.923, parent: 'limassol' },
  { key: 'pissouri', el: 'Πισσούρι', en: 'Pissouri', lat: 34.668, lng: 32.701, parent: 'limassol' },
  { key: 'limassol_marina', el: 'Μαρίνα Λεμεσού', en: 'Limassol Marina', lat: 34.6705, lng: 33.0436, parent: 'limassol' },
  // Πάφος
  { key: 'paphos', el: 'Πάφος', en: 'Paphos', lat: 34.772, lng: 32.429, aliases: ['pafos'] },
  { key: 'kato_paphos', el: 'Κάτω Πάφος', en: 'Kato Paphos', lat: 34.755, lng: 32.414, parent: 'paphos', aliases: ['kato pafos'] },
  { key: 'chloraka', el: 'Χλώρακα', en: 'Chloraka', lat: 34.796, lng: 32.408, parent: 'paphos', aliases: ['chlorakas', 'xloraka'] },
  { key: 'kissonerga', el: 'Κισσόνεργα', en: 'Kissonerga', lat: 34.822, lng: 32.4, parent: 'paphos' },
  { key: 'peyia', el: 'Πέγεια', en: 'Peyia', lat: 34.883, lng: 32.383, parent: 'paphos', aliases: ['pegeia', 'pegia'] },
  { key: 'coral_bay', el: 'Κόραλ Μπέι', en: 'Coral Bay', lat: 34.855, lng: 32.368, parent: 'paphos' },
  { key: 'tala', el: 'Τάλα', en: 'Tala', lat: 34.838, lng: 32.432, parent: 'paphos' },
  { key: 'geroskipou', el: 'Γεροσκήπου', en: 'Geroskipou', lat: 34.759, lng: 32.451, parent: 'paphos', aliases: ['yeroskipou'] },
  { key: 'polis_chrysochous', el: 'Πόλις Χρυσοχούς', en: 'Polis Chrysochous', lat: 35.036, lng: 32.426, parent: 'paphos', aliases: ['latchi', 'λατσι'] },
  // Λευκωσία
  { key: 'nicosia', el: 'Λευκωσία', en: 'Nicosia', lat: 35.1856, lng: 33.3823, aliases: ['lefkosia'] },
  { key: 'strovolos', el: 'Στρόβολος', en: 'Strovolos', lat: 35.143, lng: 33.341, parent: 'nicosia' },
  { key: 'engomi', el: 'Έγκωμη', en: 'Engomi', lat: 35.158, lng: 33.333, parent: 'nicosia', aliases: ['egkomi'] },
  { key: 'aglantzia', el: 'Αγλαντζιά', en: 'Aglantzia', lat: 35.153, lng: 33.394, parent: 'nicosia' },
  { key: 'lakatamia', el: 'Λακατάμια', en: 'Lakatamia', lat: 35.121, lng: 33.311, parent: 'nicosia' },
  { key: 'latsia', el: 'Λατσιά', en: 'Latsia', lat: 35.096, lng: 33.38, parent: 'nicosia' },
  // Λάρνακα
  { key: 'larnaca', el: 'Λάρνακα', en: 'Larnaca', lat: 34.9229, lng: 33.6233, aliases: ['larnaka'] },
  { key: 'oroklini', el: 'Ορόκλινη', en: 'Oroklini', lat: 34.981, lng: 33.656, parent: 'larnaca', aliases: ['voroklini'] },
  { key: 'livadia', el: 'Λιβάδια', en: 'Livadia', lat: 34.952, lng: 33.629, parent: 'larnaca' },
  { key: 'dromolaxia', el: 'Δρομολαξιά', en: 'Dromolaxia', lat: 34.879, lng: 33.582, parent: 'larnaca' },
  { key: 'pervolia', el: 'Περβόλια', en: 'Pervolia', lat: 34.83, lng: 33.583, parent: 'larnaca' },
  { key: 'mackenzie', el: 'Μακένζι', en: 'Mackenzie', lat: 34.896, lng: 33.633, parent: 'larnaca', aliases: ['mckenzie'] },
  // Αμμόχωστος
  { key: 'famagusta', el: 'Αμμόχωστος', en: 'Famagusta', lat: 35.03, lng: 33.98, aliases: ['ammochostos'] },
  { key: 'ayia_napa', el: 'Αγία Νάπα', en: 'Ayia Napa', lat: 34.9823, lng: 33.9997, parent: 'famagusta', aliases: ['agia napa'] },
  { key: 'protaras', el: 'Πρωταράς', en: 'Protaras', lat: 35.0125, lng: 34.0583, parent: 'famagusta' },
  { key: 'paralimni', el: 'Παραλίμνι', en: 'Paralimni', lat: 35.038, lng: 33.983, parent: 'famagusta' },
  { key: 'deryneia', el: 'Δερύνεια', en: 'Deryneia', lat: 35.064, lng: 33.959, parent: 'famagusta', aliases: ['dherynia'] },
  // Βουνό
  { key: 'troodos', el: 'Τρόοδος', en: 'Troodos', lat: 34.923, lng: 32.865, aliases: ['platres', 'πλατρες'] },
];

const BY_KEY = new Map(AREAS.map((a) => [a.key, a]));

/** Lower-case, no accents, Greek final sigma unified — so «Λεμεσός» = «λεμεσος». */
export function norm(s: string): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ').replace(/\s+/g, ' ').trim();
}

const variants = (a: Area) => [a.el, a.en, a.key.replace(/_/g, ' '), ...(a.aliases ?? [])].map(norm).filter((v) => v.length >= 3);

/** Word-start match that also accepts Greek case endings («Λεμεσός» / «Λεμεσού» / «Λεμεσό»). */
function mentions(text: string, v: string): boolean {
  const stem = /[α-ω]$/.test(v) && v.length >= 6 ? v.replace(/(οσ|ου|ο|α|ασ|η|ησ|ι|ια)$/, '') : v;
  let i = text.indexOf(stem);
  while (i !== -1) {
    if (i === 0 || !/[a-zα-ω0-9]/.test(text[i - 1])) return true;
    i = text.indexOf(stem, i + 1);
  }
  return false;
}

/** Areas mentioned in a text (most specific first). */
export function areasIn(text: string | null | undefined): Area[] {
  const t = norm(text ?? '');
  if (!t) return [];
  const hits = AREAS.filter((a) => variants(a).some((v) => mentions(t, v)));
  return hits.sort((x, y) => Number(!!y.parent) - Number(!!x.parent));
}

/** One known area for a name the user typed («Λεμεσό», «limassol»), if any. */
export function findArea(name: string): Area | null {
  const n = norm(name);
  if (!n) return null;
  return AREAS.find((a) => variants(a).some((v) => v === n || v.startsWith(n) || n.startsWith(v))) ?? null;
}

export function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface PlaceFacts { text?: string | null; lat?: number | null; lng?: number | null }
export type LocationFit = { fit: 'match' | 'near' | 'other' | 'unknown'; label: string; km?: number };

const NEAR_KM = 12;

/**
 * Does a property's place fit the areas a buyer wants?
 *  match  — same area (or a sub-area of a city they want), or within 3 km;
 *  near   — within 12 km of an area they want;
 *  other  — known place, but elsewhere;
 *  unknown — the property's place isn't known.
 */
export function locationFit(wanted: string[], place: PlaceFacts): LocationFit {
  const want = wanted.map((w) => w.trim()).filter(Boolean);
  if (!want.length) return { fit: 'unknown', label: '' };
  const placeAreas = areasIn(place.text);
  const placeKeys = new Set(placeAreas.flatMap((a) => (a.parent ? [a.key, a.parent] : [a.key])));
  const hasCoords = place.lat != null && place.lng != null && Number.isFinite(place.lat) && Number.isFinite(place.lng);
  let best: LocationFit = { fit: placeAreas.length || hasCoords ? 'other' : 'unknown', label: '' };

  for (const w of want) {
    const a = findArea(w);
    if (a) {
      if (placeKeys.has(a.key)) return { fit: 'match', label: a.el };
      if (hasCoords) {
        const km = Math.round(kmBetween(a, { lat: place.lat!, lng: place.lng! }) * 10) / 10;
        // A whole city counts as a wider circle than a village.
        const radius = a.parent ? 3 : 8;
        if (km <= radius) return { fit: 'match', label: a.el, km };
        if (km <= NEAR_KM + radius && (best.fit !== 'near' || (best.km ?? 99) > km)) best = { fit: 'near', label: a.el, km };
      } else if (placeAreas.length && a.parent && placeKeys.has(a.parent) && best.fit !== 'near') {
        best = { fit: 'near', label: BY_KEY.get(a.parent)?.el ?? a.el };
      }
    } else if (place.text && norm(place.text).includes(norm(w))) {
      return { fit: 'match', label: w };
    }
  }
  return best;
}

/** Normalise a list the user typed: known areas get their Greek name, others kept as typed. */
export function cleanAreas(x: unknown): string[] {
  const raw = Array.isArray(x) ? x : typeof x === 'string' ? x.split(/[,;\n]/) : [];
  const out: string[] = [];
  for (const r of raw) {
    const s = String(r ?? '').trim().slice(0, 60);
    if (!s) continue;
    const name = findArea(s)?.el ?? s;
    if (!out.some((o) => norm(o) === norm(name))) out.push(name);
  }
  return out.slice(0, 15);
}
