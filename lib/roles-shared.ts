/**
 * Admin-defined roles (Settings → Χρήστες → Ρόλοι & δικαιώματα). Client-safe.
 *
 * A custom role = a name + a BASE TYPE + a permission matrix + special rights.
 * The base type is one of the built-in roles and is what the database's
 * row-level security sees (e.g. 'sales' only ever reads its own leads), so a
 * custom role can never widen data access beyond its base type. The built-in
 * roles can also be adjusted (their matrix and rights), with a reset.
 *
 * Effective access for a user, first match wins:
 *   1. admin → everything
 *   2. the user's own matrix (Users → Δικαιώματα)
 *   3. their custom role's matrix
 *   4. the admin's adjustment of their built-in role
 *   5. the built-in defaults in lib/permissions
 */
import { INTERNAL_ROLES, ROLE_LABEL, sanitizePermissions, type AppRole, type UserPermissions } from '@/lib/permissions';

export type RightKey = 'see_owner_details' | 'edit_commission' | 'approve_discounts' | 'export_data' | 'see_salaries';

export const RIGHTS: { key: RightKey; label: string; hint: string }[] = [
  { key: 'see_owner_details', label: 'Βλέπει στοιχεία ιδιοκτητών', hint: 'Τηλέφωνο και email ιδιοκτητών γης/ακινήτων.' },
  { key: 'edit_commission', label: 'Αλλάζει προμήθειες', hint: 'Ποσοστά και ποσά προμήθειας σε deals και χρήστες.' },
  { key: 'approve_discounts', label: 'Εγκρίνει εκπτώσεις', hint: 'Τιμές κάτω από τον τιμοκατάλογο.' },
  { key: 'export_data', label: 'Κάνει export', hint: 'Κατεβάζει αναφορές και λίστες (Excel/PDF).' },
  { key: 'see_salaries', label: 'Βλέπει μισθούς', hint: 'Μισθοδοσία και payslips άλλων.' },
];
const RIGHT_KEYS = RIGHTS.map((r) => r.key);

/** Base types offered for a custom role, explained by what they mean for data. */
export const BASE_TYPES: { value: AppRole; label: string; hint: string }[] = [
  { value: 'sales', label: 'Πωλητής', hint: 'Στη βάση βλέπει μόνο τα δικά του leads.' },
  { value: 'management', label: 'Manager', hint: 'Βλέπει όλα τα leads και τα δεδομένα HR.' },
  { value: 'viewer', label: 'Μόνο ανάγνωση', hint: 'Βλέπει όλα τα leads, δεν αλλάζει τίποτα.' },
  { value: 'finance', label: 'Γραφείο (χωρίς leads)', hint: 'Οικονομικά, έγγραφα, έργα — καθόλου leads.' },
  { value: 'construction', label: 'Εργοτάξιο (χωρίς leads)', hint: 'Έργα, συντήρηση — καθόλου leads.' },
];

/** Built-in special rights per role (before any admin adjustment). */
export const DEFAULT_RIGHTS: Record<AppRole, RightKey[]> = {
  admin: [...RIGHT_KEYS],
  management: ['see_owner_details', 'approve_discounts', 'export_data', 'see_salaries'],
  finance: ['edit_commission', 'export_data', 'see_salaries'],
  sales: [],
  construction: [],
  viewer: [],
};

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  base: AppRole;
  permissions: UserPermissions;
  rights: RightKey[];
}
export interface SystemRoleAdjustment { permissions: UserPermissions; rights: RightKey[] }
export interface RolesSettings {
  custom: CustomRole[];
  /** Admin adjustments of the built-in roles (absent = built-in defaults). */
  system: Partial<Record<AppRole, SystemRoleAdjustment>>;
}
export const DEFAULT_ROLES: RolesSettings = { custom: [], system: {} };

const cleanRights = (v: unknown): RightKey[] => (Array.isArray(v) ? RIGHT_KEYS.filter((k) => v.includes(k)) : []);

/** Validate the stored roles slice (read and before save). */
export function mergeRoles(v: any): RolesSettings {
  const d = v && typeof v === 'object' ? v : {};
  const seen = new Set<string>();
  const custom: CustomRole[] = (Array.isArray(d.custom) ? d.custom : [])
    .filter((r: any) => r && typeof r.id === 'string' && /^[a-z0-9-]{2,40}$/.test(r.id) && typeof r.name === 'string' && r.name.trim())
    .filter((r: any) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .map((r: any) => ({
      id: r.id,
      name: String(r.name).trim().slice(0, 60),
      description: typeof r.description === 'string' ? r.description.trim().slice(0, 200) : '',
      base: (BASE_TYPES.some((b) => b.value === r.base) ? r.base : 'viewer') as AppRole,
      permissions: sanitizePermissions(r.permissions),
      rights: cleanRights(r.rights),
    }));
  const system: RolesSettings['system'] = {};
  for (const role of INTERNAL_ROLES) {
    if (role === 'admin') continue;
    const s = d.system?.[role];
    if (s && typeof s === 'object') system[role] = { permissions: sanitizePermissions(s.permissions), rights: cleanRights(s.rights) };
  }
  return { custom, system };
}

/** A safe id from a role name ("Sales Manager" → "sales-manager", unique). */
export function roleIdFrom(name: string, existing: string[]): string {
  const map: Record<string, string> = { α:'a',β:'v',γ:'g',δ:'d',ε:'e',ζ:'z',η:'i',θ:'th',ι:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o',ά:'a',έ:'e',ή:'i',ί:'i',ό:'o',ύ:'y',ώ:'o' };
  const base = name.toLowerCase().split('').map((c) => map[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'role';
  let id = base; let n = 2;
  while (existing.includes(id)) id = `${base}-${n++}`;
  return id;
}

export interface ResolvedRole {
  /** Display name: the custom role's name or the built-in label. */
  name: string;
  /** Matrix from the role (custom or adjusted built-in); null = built-in defaults. */
  permissions: UserPermissions | null;
  rights: RightKey[];
  customRoleId: string | null;
}

export function resolveRole(role: string, customRoleId: string | null | undefined, roles: RolesSettings): ResolvedRole {
  const r = role as AppRole;
  if (r === 'admin') return { name: ROLE_LABEL.admin, permissions: null, rights: [...RIGHT_KEYS], customRoleId: null };
  const custom = customRoleId ? roles.custom.find((c) => c.id === customRoleId && c.base === r) : undefined;
  if (custom) return { name: custom.name, permissions: custom.permissions, rights: custom.rights, customRoleId: custom.id };
  const adj = roles.system[r];
  return {
    name: (ROLE_LABEL as Record<string, string>)[r] ?? role,
    permissions: adj ? adj.permissions : null,
    rights: adj ? adj.rights : DEFAULT_RIGHTS[r] ?? [],
    customRoleId: null,
  };
}
