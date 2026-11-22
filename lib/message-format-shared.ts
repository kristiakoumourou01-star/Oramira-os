/**
 * Μορφή κάθε εξερχόμενου μηνύματος προς πελάτες (client-safe):
 *  - γλώσσα: ο πελάτης παίρνει την ελληνική ή την αγγλική εκδοχή
 *  - υπογραφή στο τέλος (Ρυθμίσεις → Επικοινωνία, π.χ. «Oramira Ltd»)
 */

export type MsgLang = 'el' | 'en';

/** contacts.preferred_language: 'el' → ελληνικά, οτιδήποτε άλλο (en, ru, …) → αγγλικά. */
export const langOf = (pref: string | null | undefined): MsgLang => (String(pref ?? '').toLowerCase().startsWith('el') ? 'el' : 'en');

/** Η εκδοχή της γλώσσας· αν είναι κενή, η άλλη. */
export function pickText(el: string | null | undefined, en: string | null | undefined, lang: MsgLang): string {
  const a = (el ?? '').trim(), b = (en ?? '').trim();
  return lang === 'en' ? (b ? en! : el ?? '') : (a ? el! : en ?? '');
}

export interface SignatureInfo {
  /** «Υπογραφή μηνυμάτων», π.χ. «Oramira Ltd». Κενό = χωρίς υπογραφή. */
  signature: string;
  phone: string; email: string; website: string;
}
export const DEFAULT_SIGNATURE = 'Oramira Ltd';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MARK = 'data-oramira-signature';

const UNSUB: Record<MsgLang, string> = {
  el: 'Λαμβάνετε αυτό το μήνυμα επειδή είστε πελάτης ή έχετε δηλώσει ενδιαφέρον. Για να μη λαμβάνετε άλλα μηνύματα, απαντήστε «STOP».',
  en: 'You are receiving this message as a customer or because you expressed interest. To stop receiving messages, reply "STOP".',
};

/** Το κείμενο της υπογραφής για SMS / WhatsApp: τελευταία γραμμή «— Oramira Ltd» (όχι διπλή). */
export function textWithSignature(text: string, sig: string): string {
  const s = sig.trim();
  const t = text.trimEnd();
  if (!s || t.endsWith(s)) return text;
  return `${t}\n— ${s}`;
}

/** Υποσέλιδο email: υπογραφή, στοιχεία επικοινωνίας και (στα marketing) γραμμή διαγραφής. */
export function emailFooterHtml(info: SignatureInfo, lang: MsgLang, marketing: boolean): string {
  const s = info.signature.trim();
  if (!s && !marketing) return '';
  const contact = [info.phone, info.email, info.website].map((x) => x.trim()).filter(Boolean).map(esc).join(' · ');
  return `<div ${MARK} style="margin-top:28px;padding-top:12px;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.5;color:#8a8a8a">`
    + (s ? `<div style="font-weight:600;color:#555">${esc(s)}</div>` : '')
    + (contact ? `<div>${contact}</div>` : '')
    + (marketing ? `<div style="margin-top:8px">${esc(UNSUB[lang])}</div>` : '')
    + '</div>';
}

/** Βάζει την υπογραφή στο σώμα, ανάλογα με το κανάλι. Το push μένει ως έχει. */
export function withSignature(body: string, channel: string, info: SignatureInfo | null, opts: { lang?: MsgLang; marketing?: boolean } = {}): string {
  if (!info || channel === 'push') return body;
  if (channel === 'email') {
    if (body.includes(MARK)) return body;
    // Απλό κείμενο → HTML, ώστε οι αλλαγές γραμμής να μη χαθούν μαζί με το υποσέλιδο.
    if (!/<[a-z][\s\S]*>/i.test(body)) body = esc(body).replace(/\n/g, '<br>');
    const plain = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const sig = info.signature.trim();
    // Αν το κείμενο τελειώνει ήδη με την υπογραφή, μπαίνουν μόνο τα στοιχεία επικοινωνίας.
    const footer = emailFooterHtml(sig && plain.endsWith(sig) ? { ...info, signature: '' } : info, opts.lang ?? 'el', !!opts.marketing);
    return footer ? `${body}${footer}` : body;
  }
  return textWithSignature(body, info.signature);
}

/** Για τις προεπισκοπήσεις: οι γραμμές της υπογραφής σε απλό κείμενο. */
export function previewFooter(channel: string, info: SignatureInfo | null, lang: MsgLang, marketing: boolean): string[] {
  if (!info || channel === 'push') return [];
  if (channel !== 'email') return info.signature.trim() ? [`— ${info.signature.trim()}`] : [];
  return [info.signature.trim(), [info.phone, info.email, info.website].filter((x) => x.trim()).join(' · '), marketing ? UNSUB[lang] : ''].filter(Boolean);
}
