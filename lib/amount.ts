/**
 * Ποσά όπως τα πληκτρολογούν οι άνθρωποι: «650.000», «650,000», «650 000»,
 * «1.250.000,50», «3700». Ένα <input type="number"> διαβάζει το «650.000» ως 650,
 * γι' αυτό τα χρηματικά πεδία είναι κείμενο και περνούν από εδώ.
 */
export function parseAmount(raw: unknown): number | undefined {
  let s = String(raw ?? '').trim().replace(/[€\s'’]/g, '');
  if (!s) return undefined;
  const dots = (s.match(/\./g) ?? []).length; const commas = (s.match(/,/g) ?? []).length;
  if (dots && commas) {
    // Το τελευταίο διαχωριστικό είναι το δεκαδικό.
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    s = s.split(dec === '.' ? ',' : '.').join('').replace(dec, '.');
  } else if (dots + commas > 0) {
    const sep = dots ? '.' : ',';
    const parts = s.split(sep);
    // Πολλά διαχωριστικά ή ακριβώς 3 ψηφία μετά → χιλιάδες· αλλιώς δεκαδικό.
    s = parts.length > 2 || parts[parts.length - 1].length === 3 ? parts.join('') : parts.join('.');
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
