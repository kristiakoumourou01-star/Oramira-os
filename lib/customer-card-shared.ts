/**
 * Καρτέλα πελάτη (όπως στο FitnessCRM) — client-safe τύποι και έλεγχος της
 * φόρμας «Επεξεργασία πελάτη».
 */

export const GENDERS = [{ v: 'male', l: 'Άνδρας' }, { v: 'female', l: 'Γυναίκα' }, { v: 'other', l: 'Άλλο' }] as const;
export const genderLabel = (v: string | null | undefined) => GENDERS.find((g) => g.v === v)?.l ?? null;

/** Τα στοιχεία της φόρμας (ό,τι λείπει από τη βάση έρχεται κενό). */
export interface CustomerProfileInput {
  firstName: string; lastName: string; gender: string; dateOfBirth: string; idNumber: string; memberCode: string;
  phone: string; phone2: string; fax: string; email: string;
  address: string; city: string; postcode: string; country: string;
  profession: string; company: string;
  groups: string[]; tags: string[];
  registeredAt: string;
  receiveSms: boolean; receiveEmail: boolean; receivePush: boolean;
  notes: string;
  /** undefined = καμία αλλαγή, null = αφαίρεση φωτογραφίας. */
  photoPath?: string | null;
}

const s = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const orNull = (v: string) => v || null;
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const list = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map((x) => s(x, 60)).filter(Boolean))].slice(0, 30) : []);

export function cleanCustomerProfile(p: CustomerProfileInput) {
  const firstName = s(p.firstName, 80);
  const lastName = s(p.lastName, 80);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  if (!firstName) return { error: 'Το όνομα είναι υποχρεωτικό.' } as const;
  const email = s(p.email, 200).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Το email δεν είναι έγκυρο.' } as const;
  const country = s(p.country, 2).toUpperCase();
  return {
    fullName, firstName, lastName,
    gender: ['male', 'female', 'other'].includes(p.gender) ? p.gender : null,
    dateOfBirth: date(p.dateOfBirth), idNumber: orNull(s(p.idNumber, 40)), memberCode: orNull(s(p.memberCode, 40)),
    email: email || null, phone: orNull(s(p.phone, 40)), phone2: orNull(s(p.phone2, 40)), fax: orNull(s(p.fax, 40)),
    address: orNull(s(p.address, 200)), city: orNull(s(p.city, 80)), postcode: orNull(s(p.postcode, 20)), country: /^[A-Z]{2}$/.test(country) ? country : null,
    profession: orNull(s(p.profession, 120)), company: orNull(s(p.company, 160)),
    groups: list(p.groups), tags: list(p.tags), registeredAt: date(p.registeredAt),
    receiveSms: !!p.receiveSms, receiveEmail: !!p.receiveEmail, receivePush: !!p.receivePush,
    notes: orNull(s(p.notes, 4000)),
    photoPath: p.photoPath === undefined ? undefined : p.photoPath === null ? null : s(p.photoPath, 300) || null,
  };
}

/** Από τη γραμμή της βάσης στη φόρμα (ό,τι λείπει → κενό). */
export function profileFromRow(c: any, kyc?: any): CustomerProfileInput {
  const parts = String(c?.full_name ?? '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: c?.first_name ?? parts[0] ?? '', lastName: c?.last_name ?? parts.slice(1).join(' '),
    gender: c?.gender ?? '', dateOfBirth: c?.date_of_birth ?? kyc?.date_of_birth ?? '', idNumber: c?.id_number ?? kyc?.id_number ?? '', memberCode: c?.member_code ?? '',
    phone: c?.phone ?? '', phone2: c?.phone2 ?? '', fax: c?.fax ?? '', email: c?.email ?? '',
    address: c?.address ?? kyc?.address ?? '', city: c?.city ?? '', postcode: c?.postcode ?? '', country: c?.country ?? kyc?.residence_country ?? '',
    profession: c?.profession ?? kyc?.occupation ?? '', company: c?.company ?? '',
    groups: Array.isArray(c?.groups) ? c.groups : [], tags: Array.isArray(c?.tags) ? c.tags : [],
    registeredAt: c?.registered_at ?? String(c?.created_at ?? '').slice(0, 10),
    receiveSms: c?.receive_sms ?? true, receiveEmail: c?.receive_email ?? true, receivePush: c?.receive_push ?? true,
    notes: c?.notes ?? '',
  };
}
