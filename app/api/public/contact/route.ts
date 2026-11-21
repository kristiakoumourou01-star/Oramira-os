import { NextResponse, type NextRequest } from 'next/server';
import { intakeContactForm, intakeInboundLead } from '@/lib/intake';
import { readConsent, recordConsent } from '@/lib/gdpr';
import { missingPublicFields } from '@/lib/public-form';

/**
 * Public website contact-form intake. No session (the public site calls this),
 * so it runs through the service-role intake chokepoint. Middleware lets
 * /api/public/* through unauthenticated. Optionally lock down with
 * INTAKE_SECRET (sent as x-intake-key, or a `key` field) once the site is wired up.
 *
 * Accepts ANY website form: JSON, a normal HTML form post (urlencoded or
 * multipart) and the usual field names of WordPress / Contact Form 7 /
 * Elementor / Wix / Webflow. Known fields fill the lead's own fields; every
 * other field is kept, as «Πεδίο: τιμή», in the lead's message — nothing the
 * visitor typed is lost. Email OR phone is enough.
 */
const CORS = {
  'Access-Control-Allow-Origin': process.env.WEBSITE_ALLOWED_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-intake-key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Ονόματα πεδίων που χρησιμοποιούν τα συνήθη website builders → τα δικά μας πεδία. */
const ALIASES: Record<string, string[]> = {
  name: ['name', 'full_name', 'fullname', 'your-name', 'your_name', 'nome', 'όνομα', 'ονοματεπώνυμο', 'имя'],
  first: ['first_name', 'firstname', 'fname', 'first-name', 'given_name'],
  last: ['last_name', 'lastname', 'lname', 'last-name', 'surname', 'family_name', 'επώνυμο', 'фамилия'],
  email: ['email', 'e-mail', 'mail', 'your-email', 'your_email', 'email_address', 'emailaddress'],
  phone: ['phone', 'tel', 'telephone', 'mobile', 'phone_number', 'phonenumber', 'your-phone', 'your-tel', 'cell', 'whatsapp', 'τηλέφωνο', 'κινητό', 'телефон'],
  message: ['message', 'msg', 'comments', 'comment', 'your-message', 'your_message', 'enquiry', 'inquiry', 'notes', 'details', 'μήνυμα', 'сообщение'],
  budget: ['budget', 'price_range', 'budget_range', 'προϋπολογισμός', 'бюджет'],
  project: ['project', 'property', 'project_interest', 'interested_in', 'unit', 'έργο', 'ακίνητο'],
  area: ['area', 'areas', 'location', 'city', 'region', 'περιοχή'],
  source: ['source', 'utm_source', 'lead_source'],
};
/** Τεχνικά πεδία των φορμών που δεν έχουν νόημα για το lead. */
const IGNORE = /^(_|g-recaptcha|recaptcha|h-captcha|cf-turnstile|key|redirect|lang|consent|marketing|form_id|form-id|post_id|referer|referrer|nonce|action|submit|wpcf7|_wp|utm_medium|utm_campaign|utm_term|utm_content|gclid|fbclid)/i;

async function readBody(request: NextRequest): Promise<Record<string, any>> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return (await request.json()) ?? {};
  if (type.includes('form')) {
    const fd = await request.formData();
    const out: Record<string, any> = {};
    fd.forEach((v, k) => { if (typeof v === 'string') out[k] = out[k] ? `${out[k]}, ${v}` : v; });
    return out;
  }
  const text = await request.text();
  try { return JSON.parse(text); } catch { return Object.fromEntries(new URLSearchParams(text)); }
}

function pick(body: Record<string, any>, field: keyof typeof ALIASES, used: Set<string>): string | undefined {
  for (const k of Object.keys(body)) {
    const norm = k.toLowerCase().trim().replace(/\s+/g, '_').replace(/\[\]$/, '');
    if (ALIASES[field].includes(norm)) {
      const v = body[k];
      const s = Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v);
      if (s.trim()) { used.add(k); return s.trim(); }
    }
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  let body: Record<string, any>;
  try { body = await readBody(request); } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers: CORS });
  }
  const secret = process.env.INTAKE_SECRET;
  if (secret && request.headers.get('x-intake-key') !== secret && body?.key !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }
  const htmlPost = !(request.headers.get('content-type') ?? '').includes('json');
  const redirectTo = typeof body.redirect === 'string' && /^https?:\/\//.test(body.redirect) ? body.redirect : null;

  const used = new Set<string>();
  const first = pick(body, 'first', used);
  const last = pick(body, 'last', used);
  const name = pick(body, 'name', used) ?? ([first, last].filter(Boolean).join(' ') || undefined);
  const email = pick(body, 'email', used)?.toLowerCase();
  const phone = pick(body, 'phone', used);
  const message = pick(body, 'message', used);
  const budget = pick(body, 'budget', used);
  const project = pick(body, 'project', used);
  const area = pick(body, 'area', used);
  const source = pick(body, 'source', used) ?? 'website';

  if (!email && !phone) {
    return NextResponse.json({ error: (body.lang ?? '').startsWith?.('el') ? 'Συμπληρώστε email ή τηλέφωνο.' : 'Please enter your email or phone.' }, { status: 400, headers: CORS });
  }

  // Ό,τι άλλο έγραψε ο επισκέπτης κρατιέται στο μήνυμα του lead.
  const extras = Object.entries(body)
    .filter(([k, v]) => !used.has(k) && !IGNORE.test(k) && !/consent|gdpr|accept|privacy|agree|terms/i.test(k) && v != null && String(v).trim() !== '')
    .map(([k, v]) => `${k.replace(/[_-]+/g, ' ').replace(/^your /i, '')}: ${String(Array.isArray(v) ? v.join(', ') : v).slice(0, 500)}`);
  const fullMessage = [message, project ? `Έργο / ακίνητο: ${project}` : null, area ? `Περιοχή: ${area}` : null, ...extras].filter(Boolean).join('\n') || undefined;

  // Συγκατάθεση GDPR: δεχόμαστε και τα συνήθη ονόματα πεδίων των builders.
  const consentKey = Object.keys(body).find((k) => /consent|gdpr|accept|privacy|agree|terms/i.test(k));
  const normalized = { ...body, name, email, phone, message: fullMessage, consent: body.consent ?? (consentKey ? body[consentKey] || 'on' : undefined) };
  const missing = await missingPublicFields(normalized);
  if (missing) return NextResponse.json({ error: missing }, { status: 400, headers: CORS });
  const consent = await readConsent(normalized);
  if (!consent.ok) return NextResponse.json({ error: consent.error }, { status: 400, headers: CORS });

  try {
    const result = email
      ? await intakeContactForm({
          name, email, phone, message: fullMessage, source,
          projectInterestId: typeof body.projectInterestId === 'string' ? body.projectInterestId : undefined,
          budget,
          budgetMin: body.budgetMin != null ? Number(body.budgetMin) : undefined,
          budgetMax: body.budgetMax != null ? Number(body.budgetMax) : undefined,
          areas: area ? area.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        })
      : await intakeInboundLead({ channel: 'website', name, phone, message: fullMessage, source, externalId: phone });
    await recordConsent(result.contactId, { ...consent, source: 'Φόρμα ιστοσελίδας' });
    if (htmlPost && redirectTo) return NextResponse.redirect(redirectTo, { status: 303, headers: CORS });
    if (htmlPost) return new NextResponse('<!doctype html><meta charset="utf-8"><title>OK</title><p style="font-family:sans-serif;padding:2rem">Ευχαριστούμε! Θα επικοινωνήσουμε σύντομα μαζί σας. / Thank you, we will contact you shortly.</p>', { status: 200, headers: { ...CORS, 'content-type': 'text/html; charset=utf-8' } });
    return NextResponse.json({ ok: true, ...result }, { headers: CORS });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Intake failed' }, { status: 500, headers: CORS });
  }
}
