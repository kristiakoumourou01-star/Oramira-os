/** Campaigns του Marketing — client-safe τύποι και βοηθήματα. */

export type CampaignChannel = 'email' | 'whatsapp';
export type CampaignAudience =
  | { kind: 'groups'; groups: string[] }
  | { kind: 'contacts'; ids: string[] }
  | { kind: 'addresses'; addresses: string[] }
  | { kind: 'tag'; tag: string }
  | { kind: 'role'; role: string };

export interface CampaignRow {
  id: string; name: string; channel: CampaignChannel; audience: CampaignAudience; subject: string | null; preview: string | null; body: string;
  status: 'draft' | 'sending' | 'sent' | 'cancelled'; recipients: number; sent: number; failed: number; skipped: number;
  createdAt: string; sentAt: string | null; createdBy: string | null;
}

export const STATUS_LABEL: Record<CampaignRow['status'], string> = { draft: 'Πρόχειρο', sending: 'Αποστολή…', sent: 'Στάλθηκε', cancelled: 'Ακυρώθηκε' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Καθαρίζει το κοινό που έρχεται από τη φόρμα. null = κενό. */
export function cleanAudience(a: unknown, channel: CampaignChannel): CampaignAudience | null {
  const v = (a ?? {}) as any;
  const strs = (x: unknown, max: number) => (Array.isArray(x) ? Array.from(new Set(x.map((s) => String(s ?? '').trim()).filter(Boolean))).slice(0, max) : []);
  if (v.kind === 'groups') { const groups = strs(v.groups, 50); return groups.length ? { kind: 'groups', groups } : null; }
  if (v.kind === 'contacts') { const ids = strs(v.ids, 5000); return ids.length ? { kind: 'contacts', ids } : null; }
  if (v.kind === 'addresses') {
    const addresses = strs(v.addresses, 2000).filter((x) => (channel === 'email' ? EMAIL.test(x) : x.replace(/\D/g, '').length >= 8));
    return addresses.length ? { kind: 'addresses', addresses } : null;
  }
  if (v.kind === 'tag' && String(v.tag ?? '').trim()) return { kind: 'tag', tag: String(v.tag).trim().slice(0, 60) };
  if (v.kind === 'role' && String(v.role ?? '').trim()) return { kind: 'role', role: String(v.role).trim().slice(0, 30) };
  return null;
}

/** Διευθύνσεις από ελεύθερο κείμενο (κόμμα, νέα γραμμή, ;). */
export function parseAddresses(text: string): string[] {
  return text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
}

/** Προσωποποίηση: {{first_name}}, {{name}}. */
export function renderCampaign(text: string, fullName: string): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  return text.replace(/\{\{\s*first_name\s*\}\}/gi, first).replace(/\{\{\s*name\s*\}\}/gi, (fullName ?? '').trim());
}

export function audienceLabel(a: CampaignAudience, roleLabel: (r: string) => string = (r) => r): string {
  switch (a.kind) {
    case 'groups': return a.groups.length === 1 ? `Ομάδα: ${a.groups[0]}` : `${a.groups.length} ομάδες`;
    case 'contacts': return `${a.ids.length} πελάτες`;
    case 'addresses': return `${a.addresses.length} διευθύνσεις`;
    case 'tag': return `Tag: ${a.tag}`;
    case 'role': return roleLabel(a.role);
  }
}
