import { getCurrentProfile, homeRouteForRole } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const profile = await getCurrentProfile();
  redirect(profile ? homeRouteForRole(profile.role) : '/login');
}
