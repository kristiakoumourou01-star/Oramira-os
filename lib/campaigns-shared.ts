/** Campaigns του Marketing — client-safe τύποι και βοηθήματα. */

export type CampaignChannel = 'email' | 'sms' | 'whatsapp' | 'push';
export const CHANNEL_NAME: Record<CampaignChannel, string> = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', push: 'Push' };

/** Τμήματα SMS: 160 χαρακτήρες (λατινικά) ή 70 (ελληνικά / unicode)· με συνένωση 153 / 67. */
export function smsParts(text: string): { chars: number; parts: number; unicode: boolean } {
  const unicode = /[^\x00-\x7F€]/.test(text);
  const chars = text.length;
  const one = unicode ? 70 : 160, multi = unicode ? 67 : 153;
  return { chars, parts: chars === 0 ? 0 : chars <= one ? 1 : Math.ceil(chars / multi), unicode };
}
export type CampaignAudience =
  | { kind: 'groups'; groups: string[] }
  | { kind: 'contacts'; ids: string[] }
  | { kind: 'addresses'; addresses: string[] }
  | { kind: 'tag'; tag: string }
  | { kind: 'role'; role: string };

export interface CampaignRow {
  id: string; name: string; channel: CampaignChannel; audience: CampaignAudience; subject: string | null; preview: string | null; body: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'; recipients: number; sent: number; failed: number; skipped: number; opened?: number;
  createdAt: string; sentAt: string | null; createdBy: string | null;
  /** Προγραμματισμένη αποστολή (status 'scheduled'). */
  scheduledAt?: string | null;
  /** Αγγλική εκδοχή και όνομα αποστολέα. */
  subjectEn?: string | null; bodyEn?: string | null; senderName?: string | null;
}

export const STATUS_LABEL: Record<CampaignRow['status'], string> = { draft: 'Πρόχειρο', scheduled: 'Προγραμματισμένη', sending: 'Αποστολή…', sent: 'Στάλθηκε', cancelled: 'Ακυρώθηκε' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Καθαρίζει το κοινό που έρχεται από τη φόρμα. null = κενό. */
export function cleanAudience(a: unknown, channel: CampaignChannel): CampaignAudience | null {
  const v = (a ?? {}) as any;
  const strs = (x: unknown, max: number) => (Array.isArray(x) ? Array.from(new Set(x.map((s) => String(s ?? '').trim()).filter(Boolean))).slice(0, max) : []);
  if (v.kind === 'groups') { const groups = strs(v.groups, 50); return groups.length ? { kind: 'groups', groups } : null; }
  if (v.kind === 'contacts') { const ids = strs(v.ids, 5000); return ids.length ? { kind: 'contacts', ids } : null; }
  if (v.kind === 'addresses') {
    if (channel === 'push') return null;
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

/** Ρυθμίσεις → Επικοινωνία: προεπιλεγμένα ονόματα αποστολέα. */
export interface SenderDefaults { email: string; sms: string }
export const senderDefaultFor = (channel: CampaignChannel, d: SenderDefaults) => (channel === 'email' ? d.email : channel === 'push' ? '' : d.sms);
/**
 * Όνομα αποστολέα: για email οποιοδήποτε κείμενο (χωρίς < > "), για SMS / WhatsApp
 * έως 11 λατινικά γράμματα ή ψηφία (τουλάχιστον ένα γράμμα). Κενό = προεπιλογή.
 */
export function cleanSender(v: unknown, channel: CampaignChannel): { ok: true; value: string | null } | { ok: false; error: string } {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s || channel === 'push') return { ok: true, value: null };
  if (channel === 'email') return { ok: true, value: s.replace(/[<>"\r\n]/g, '').slice(0, 80) || null };
  if (!/^[A-Za-z0-9 ]{1,11}$/.test(s) || !/[A-Za-z]/.test(s)) return { ok: false, error: 'Για SMS / WhatsApp το όνομα αποστολέα είναι έως 11 λατινικά γράμματα ή αριθμοί (π.χ. Oramira).' };
  return { ok: true, value: s };
}
