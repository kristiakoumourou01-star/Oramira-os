'use server';

import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildMorningBrief } from '@/lib/morning-brief';
import { queueNotificationEmail } from '@/lib/notifications';

/**
 * Emails the signed-in user their own morning brief. Built through the session
 * client so RLS scopes every count to what this user is allowed to see, then
 * handed to the shared email queue. Returns a small status the client surfaces.
 */
export async function emailMorningBrief(): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const { data: me } = await supabase
    .from('profiles')
    .select('full_name, contacts(email)')
    .eq('id', profile.id)
    .maybeSingle();
  const email = (me as any)?.contacts?.email as string | undefined;
  if (!email) return { ok: false, error: 'No email address on file for your account.' };

  const brief = await buildMorningBrief(supabase, profile.id);
  const rows = brief.stats.map((s) => `<tr><td style="padding:4px 12px 4px 0;color:#5b5750">${s.label}</td><td style="padding:4px 0;font-weight:600;color:#1F4D3A">${s.count}</td></tr>`).join('');
  const first = (me as any)?.full_name?.split(' ')?.[0] ?? 'there';
  const body = `
    <div style="font-family:Georgia,serif;color:#2b2824;max-width:520px">
      <h2 style="color:#1F4D3A;margin:0 0 4px">Good morning, ${first}</h2>
      <p style="color:#5b5750;margin:0 0 16px">${brief.summary}</p>
      ${rows ? `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows}</table>` : ''}
      <p style="margin:20px 0 0;font-size:12px;color:#9a958c">Sent from Oramira · your daily brief</p>
    </div>`;

  await queueNotificationEmail({
    triggerType: 'morning_brief',
    entityType: 'profile',
    entityId: profile.id,
    recipientEmail: email,
    subject: 'Your Oramira morning brief',
    body,
  });
  return { ok: true };
}
