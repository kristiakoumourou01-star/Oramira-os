/**
 * Tags, groups and custom field values of one contact (columns from migration
 * 0055), validated against the company's definitions in Settings. Client-safe.
 */
import type { TagsSettings } from '@/lib/org-settings-shared';

export type FieldValue = string | number | boolean | null;
export interface ContactMeta { tags: string[]; groups: string[]; fields: Record<string, FieldValue> }
export const EMPTY_META: ContactMeta = { tags: [], groups: [], fields: {} };

export function readMeta(row: any): ContactMeta {
  return {
    tags: Array.isArray(row?.tags) ? row.tags : [],
    groups: Array.isArray(row?.groups) ? row.groups : [],
    fields: row?.custom_fields && typeof row.custom_fields === 'object' ? row.custom_fields : {},
  };
}

/**
 * Keep only defined tags/groups and well-typed field values. Values of fields
 * that no longer exist are kept (so deleting a field by mistake loses nothing).
 * Returns the names of required fields left empty.
 */
export function cleanMeta(meta: ContactMeta, defs: TagsSettings): { meta: ContactMeta; missing: string[] } {
  const tags = defs.tags.filter((t) => meta.tags.includes(t));
  const groups = defs.groups.filter((g) => meta.groups.includes(g));
  const fields: Record<string, FieldValue> = { ...meta.fields };
  const missing: string[] = [];
  for (const f of defs.fields) {
    let v = meta.fields[f.key] ?? null;
    if (typeof v === 'string') v = v.trim().slice(0, 500) || null;
    if (v !== null) {
      if (f.type === 'Number') { const n = Number(v); v = Number.isFinite(n) ? n : null; }
      else if (f.type === 'Date') v = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
      else if (f.type === 'Yes / No') v = v === true || v === 'true' || v === 'yes' ? true : v === false || v === 'false' || v === 'no' ? false : null;
      else if (f.type === 'Choice') v = typeof v === 'string' && (f.options.length === 0 || f.options.includes(v)) ? v : null;
      else v = String(v);
    }
    fields[f.key] = v;
    if (f.required && (v === null || v === '')) missing.push(f.name);
  }
  return { meta: { tags, groups, fields }, missing };
}
