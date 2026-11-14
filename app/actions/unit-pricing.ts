'use server';

import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DISTRICT_MEDIANS, MARKET_SOURCE, districtOf } from '@/lib/market-reference';

export interface PriceSuggestion {
  suggested: number | null;                     // €/m² (χωρίς ΦΠΑ)
  sources: { label: string; perSqm: number; weight: number; count: number }[];
  market: { district: string; median: number; kind: 'house' | 'apartment'; impliedPerSqm: number | null; source: string; url: string } | null;
  note: string;
}

const HOUSE = ['house', 'villa', 'maisonette', 'townhouse', 'bungalow'];
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * Πρόταση τιμής ανά m² για μια μονάδα, από τα δικά σας δεδομένα: μονάδες στο ίδιο
 * έργο, σε έργα κοντά (≤ 10 km ή ίδια επαρχία) και αναλύσεις στο Deal Analyzer
 * για την περιοχή — με αναφορά στη διάμεση τιμή νέων κατοικιών της επαρχίας.
 */
export async function suggestUnitPrice(unitId: string): Promise<PriceSuggestion> {
  await requirePermission('projects');
  const supabase = await createSupabaseServerClient();
  const { data: u } = await (supabase as any).from('units').select('id, project_id, type, sqm, projects(name, location, latitude, longitude)').eq('id', unitId).single();
  if (!u) return { suggested: null, sources: [], market: null, note: 'Η μονάδα δεν βρέθηκε.' };
  const proj = u.projects ?? {};
  const here = proj.latitude != null ? { lat: Number(proj.latitude), lng: Number(proj.longitude) } : null;
  const district = districtOf(`${proj.location ?? ''} ${proj.name ?? ''}`);
  const isHouse = HOUSE.some((h) => String(u.type ?? '').toLowerCase().includes(h));

  const [{ data: units }, { data: deals }] = await Promise.all([
    (supabase as any).from('units').select('id, project_id, type, sqm, price, status, projects(name, location, latitude, longitude)').gt('price', 0).gt('sqm', 0).neq('id', unitId).limit(2000),
    (supabase as any).from('deals').select('name, inputs').limit(200),
  ]);

  const same: number[] = []; const near: number[] = []; const dist: number[] = [];
  for (const x of (units ?? []) as any[]) {
    const ppm = Number(x.price) / Number(x.sqm);
    if (!Number.isFinite(ppm) || ppm < 300 || ppm > 40000) continue; // λάθος καταχωρίσεις
    const sameType = !u.type || !x.type || HOUSE.some((h) => String(x.type).toLowerCase().includes(h)) === isHouse;
    if (!sameType) continue;
    if (x.project_id === u.project_id) { same.push(ppm); continue; }
    const p = x.projects ?? {};
    if (here && p.latitude != null && km(here, { lat: Number(p.latitude), lng: Number(p.longitude) }) <= 10) near.push(ppm);
    else if (district && districtOf(`${p.location ?? ''} ${p.name ?? ''}`) === district) dist.push(ppm);
  }
  // Deal Analyzer: αναλύσεις με λέξη της τοποθεσίας του έργου στο όνομα / ζώνη.
  const words = String(`${proj.location ?? ''} ${proj.name ?? ''}`).toLowerCase().split(/[\s,·/-]+/).filter((w) => w.length >= 4);
  const deal: number[] = [];
  for (const d of (deals ?? []) as any[]) {
    const name = String(d.name ?? '').toLowerCase();
    if (!words.some((w) => name.includes(w))) continue;
    const mix = Array.isArray(d.inputs?.unitMix) ? d.inputs.unitMix : [];
    const ppm = mix.length ? mix.reduce((s: number, m: any) => s + Number(m.pricePerSqm ?? 0) * Number(m.count ?? 0) * Number(m.avgSqm ?? 0), 0) / mix.reduce((s: number, m: any) => s + Number(m.count ?? 0) * Number(m.avgSqm ?? 0), 0) : Number(d.inputs?.salePricePerSqm ?? 0);
    if (ppm > 0) deal.push(ppm);
  }

  const sources: PriceSuggestion['sources'] = [];
  if (same.length) sources.push({ label: 'Άλλες μονάδες του ίδιου έργου', perSqm: median(same), weight: 3, count: same.length });
  if (near.length) sources.push({ label: 'Έργα σε απόσταση ≤ 10 km', perSqm: median(near), weight: 2, count: near.length });
  if (dist.length) sources.push({ label: `Έργα στην ίδια επαρχία${district ? ` (${DISTRICT_MEDIANS[district]?.el})` : ''}`, perSqm: median(dist), weight: 1, count: dist.length });
  if (deal.length) sources.push({ label: 'Deal Analyzer για την περιοχή', perSqm: median(deal), weight: 2, count: deal.length });
  const w = sources.reduce((s, x) => s + x.weight, 0);
  const suggested = w ? Math.round(sources.reduce((s, x) => s + x.perSqm * x.weight, 0) / w / 10) * 10 : null;

  const md = district ? DISTRICT_MEDIANS[district] : null;
  const kind = isHouse ? 'house' : 'apartment';
  const market = md ? { district: md.el, median: md[kind], kind, impliedPerSqm: Number(u.sqm) > 0 ? Math.round(md[kind] / Number(u.sqm)) : null, source: MARKET_SOURCE.label, url: MARKET_SOURCE.url } as PriceSuggestion['market'] : null;
  const note = suggested ? 'Σταθμισμένος μέσος όρος των πηγών (ίδιο έργο ×3, κοντινά έργα και Deal Analyzer ×2, επαρχία ×1).' : 'Δεν υπάρχουν ακόμα αρκετά δικά σας δεδομένα για πρόταση — βάλτε τιμές σε άλλες μονάδες ή μια ανάλυση στο Deal Analyzer για την περιοχή.';
  return { suggested, sources, market, note };
}
