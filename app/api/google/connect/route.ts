import { NextResponse, type NextRequest } from 'next/server';
import { requireProfile } from '@/lib/auth';
import { googleAuthUrl, googleConfigured } from '@/lib/google-calendar';

/** Start the Google Calendar OAuth flow for the signed-in user (each user connects their own calendar). */
export async function GET(request: NextRequest) {
  const profile = await requireProfile();
  const origin = request.nextUrl.origin;
  if (!googleConfigured()) return NextResponse.redirect(`${origin}/calendar?calendar=not_configured`);
  return NextResponse.redirect(googleAuthUrl(profile.id, origin));
}
