/**
 * Security rules from Settings → Ασφάλεια, as pure checks. Client-safe.
 */
import type { SecuritySettings } from '@/lib/org-settings-shared';

/** Cookie with the time of the user's last request (set by middleware). */
export const LAST_SEEN_COOKIE = 'oramira_seen';

/** Null when the password meets the company policy, else the reason (Greek). */
export function passwordProblem(pw: string, sec: Pick<SecuritySettings, 'pwLength' | 'pwSymbols'>): string | null {
  const min = Math.max(8, sec.pwLength || 8);
  if (pw.length < min) return `Ο κωδικός πρέπει να έχει τουλάχιστον ${min} χαρακτήρες.`;
  if (sec.pwSymbols && !(/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw))) return 'Ο κωδικός πρέπει να έχει τουλάχιστον έναν αριθμό και ένα σύμβολο (π.χ. ! ? # @).';
  return null;
}

/** Turn an IPv4 address into a number, or null. */
function ip4(ip: string): number | null {
  const m = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

/** Parse the allow-list: one entry per line or comma — an IP or a CIDR range. */
export function parseAllowList(list: string): string[] {
  return (list || '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
}

/** Empty list = any address allowed. Supports exact IPv4/IPv6 and IPv4 CIDR (x.x.x.x/nn). */
export function ipAllowed(ip: string | null, list: string): boolean {
  const entries = parseAllowList(list);
  if (entries.length === 0) return true;
  if (!ip) return false;
  const addr = ip4(ip);
  for (const e of entries) {
    if (e === ip) return true;
    const [base, bitsStr] = e.split('/');
    const b = ip4(base);
    const bits = Number(bitsStr);
    if (addr !== null && b !== null && bitsStr !== undefined && bits >= 0 && bits <= 32) {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      if (((addr & mask) >>> 0) === ((b & mask) >>> 0)) return true;
    }
  }
  return false;
}

export const PASSWORD_MAX_AGE_DAYS = 90;
