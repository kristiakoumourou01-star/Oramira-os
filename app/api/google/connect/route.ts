import { NextResponse } from 'next/server';
import { requireProfile } from '@/lib/auth';
import { googleAuthUrl, googleConfigured } from '@/lib/google-calendar';

/** Start the Google Calendar OAuth flow for the signed-in user. */
export async function GET() {
  const profile = await requireProfile();
  if (!googleConfigured()) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/dashboard?calendar=not_configured`);
  }
  return NextResponse.redirect(googleAuthUrl(profile.id));
}
