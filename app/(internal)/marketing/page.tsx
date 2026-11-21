import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { effectiveCan } from '@/lib/permissions';
import { MarketingHub, type PickContact, type ReferralData } from '@/components/marketing/MarketingHub';
import type { CampaignRow } from '@/lib/campaigns-shared';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Marketing ανά κανάλι: Email · SMS (και WhatsApp) · Push · Συστάσεις · Αναφορές · Benefits. */
export default async function MarketingPage({ searchParams }: { searchParams: { tab?: string; group?: string; tag?: string; role?: string; ids?: string } }) {
  const profile = await requirePermission('marketing');
  const supabase = await createSupabaseServerClient();
  const db = supabase as any;
  const [{ data: camps }, { data: groupRows }, { data: contactRows }, { data: codes }, { data: reds }] = await Promise.all([
    db.from('marketing_campaigns').select('*').order('created_at', { ascending: false }).limit(1000),
    db.from('contact_groups').select('name').order('name'),
    db.from('contacts').select('id, full_name, email, phone, marketing_opt_in, groups, tags, status').is('anonymized_at', null).neq('status', 'archived').order('full_name').limit(5000),
    db.from('referral_codes').select('*, referrer:referrer_contact_id(full_name)').order('created_at', { ascending: false }),
    db.from('referral_redemptions').select('id, code_id, status, created_at, referee:referee_contact_id(full_name), code:code_id(code)').order('created_at', { ascending: false }).limit(2000),
  ]);
  const contactsAll = (contactRows ?? []) as any[];
  const groupNames = Array.from(new Set([...((groupRows ?? []) as any[]).map((g) => g.name as string), ...contactsAll.flatMap((c) => (c.groups ?? []) as string[])])).sort((a, b) => a.localeCompare(b, 'el'));
  const groups = groupNames.map((name) => ({ name, n: contactsAll.filter((c) => (c.groups ?? []).includes(name)).length }));
  const tagList = Array.from(new Set(contactsAll.flatMap((c) => (c.tags ?? []) as string[]))).sort();
  const picks: PickContact[] = contactsAll.map((c) => ({ id: c.id, name: c.full_name ?? c.email ?? '—', email: c.email, phone: c.phone, optIn: !!c.marketing_opt_in }));
  const campaigns: CampaignRow[] = ((camps ?? []) as any[]).map((c) => ({ id: c.id, name: c.name, channel: c.channel, audience: c.audience ?? {}, subject: c.subject, preview: c.preview, body: c.body ?? '', status: c.status, recipients: c.recipients ?? 0, sent: c.sent ?? 0, failed: c.failed ?? 0, skipped: c.skipped ?? 0, opened: c.opened ?? 0, createdAt: c.created_at, sentAt: c.sent_at, createdBy: c.created_by }));
  const redRows = (reds ?? []) as any[];
  const referrals: ReferralData = {
    codes: ((codes ?? []) as any[]).map((c) => ({ id: c.id, code: c.code, referrer: c.referrer?.full_name ?? null, referrerId: c.referrer_contact_id, refType: c.referrer_reward_type, refValue: c.referrer_reward_value == null ? null : Number(c.referrer_reward_value), eeType: c.referee_reward_type, eeValue: c.referee_reward_value == null ? null : Number(c.referee_reward_value), active: !!c.active, note: c.note, createdAt: c.created_at, uses: redRows.filter((r) => r.code_id === c.id).length })),
    redemptions: redRows.map((r) => ({ id: r.id, codeId: r.code_id, code: r.code?.code ?? '—', referee: r.referee?.full_name ?? null, status: r.status, createdAt: r.created_at })),
  };
  const canEdit = effectiveCan(profile.role, profile.moduleAccess, 'marketing', 'edit', profile.permissions);
  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Marketing" title="Marketing" description="Καμπάνιες προς τους πελάτες σας ανά κανάλι: email, SMS στο κινητό και ειδοποιήσεις στην εφαρμογή τους." />
      <MarketingHub campaigns={campaigns} groups={groups} contacts={picks} tags={tagList} prefill={searchParams} referrals={referrals} canEdit={canEdit} />
    </div>
  );
}
