/**
 * Αναφορά αγοράς: διάμεσες τιμές ΝΕΩΝ ακινήτων ανά επαρχία, Α' εξάμηνο 2026
 * (Landbank Analytics, όπως δημοσιεύθηκε στο Cyprus Mail, 31/7/2026). Συνολικές
 * τιμές — όχι €/m². Ενημερώνεται χειροκίνητα όταν βγαίνουν νέα στοιχεία.
 */
export const MARKET_SOURCE = { label: 'Landbank Analytics · Α΄ εξάμηνο 2026', url: 'https://cyprus-mail.com/2026/07/31/paphos-records-cyprus-highest-prices-for-new-houses' };
export const DISTRICT_MEDIANS: Record<string, { el: string; house: number; apartment: number }> = {
  limassol: { el: 'Λεμεσός', house: 390000, apartment: 297600 },
  paphos: { el: 'Πάφος', house: 570000, apartment: 302500 },
  nicosia: { el: 'Λευκωσία', house: 285000, apartment: 175000 },
  larnaca: { el: 'Λάρνακα', house: 320000, apartment: 184000 },
  famagusta: { el: 'Αμμόχωστος', house: 395000, apartment: 200000 },
};
const KEYS: [string, RegExp][] = [
  ['limassol', /limassol|lemesos|λεμεσ|pyrgos|πύργος|πυργος|germasog|γερμασ|agios tychon|τύχων|ypsonas|ύψωνα|kolossi|κολόσσ|parekklis|παρεκκλ|mouttag|μουτταγ|episkopi|erimi|palodia|polemidia|πολεμίδ|mesa geitonia|μέσα γειτον|agia fyla|αγία φύλα/i],
  ['paphos', /paphos|pafos|πάφ|παφ|peyia|πέγεια|chloraka|χλώρακα|kissonerga|tala|emba|geroskipou|γεροσκήπ|polis/i],
  ['larnaca', /larnaca|larnaka|λάρνα|λαρνα|oroklini|ορόκλιν|voroklini|livadia|λειβάδια|pervolia|περβόλια|kiti|dromolaxia/i],
  ['famagusta', /famagusta|αμμόχωστ|ammochostos|ayia napa|agia napa|αγία νάπα|protaras|πρωταράς|paralimni|παραλίμνι|deryneia/i],
  ['nicosia', /nicosia|lefkosia|λευκωσ|strovolos|στρόβολ|latsia|λατσιά|aglantzia|αγλαντζ|engomi|έγκωμη|lakatamia|λακατάμ|tseri|dali/i],
];
export function districtOf(text: string | null | undefined): string | null {
  const t = text ?? '';
  for (const [k, re] of KEYS) if (re.test(t)) return k;
  return null;
}
