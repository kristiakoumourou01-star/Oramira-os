import { NextResponse, type NextRequest } from 'next/server';
import { consentWording, getGdprSettingsPublic } from '@/lib/gdpr';

/**
 * The consent wording for the website's forms (Settings → GDPR & δεδομένα),
 * so the site always shows the current text. ?lang=el for Greek.
 * The form then sends `consent: true` and `marketing: true|false` (and `lang`)
 * to /api/public/contact, /api/public/newsletter or /api/public/book.
 */
const CORS = {
  'Access-Control-Allow-Origin': process.env.WEBSITE_ALLOWED_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest) {
  const lang = new URL(request.url).searchParams.get('lang');
  const g = await getGdprSettingsPublic();
  return NextResponse.json(consentWording(g, lang), { headers: { ...CORS, 'cache-control': 'public, max-age=300' } });
}
