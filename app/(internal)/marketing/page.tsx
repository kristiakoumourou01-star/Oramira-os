import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { effectiveCan } from '@/lib/permissions';
import { MarketingHub, type PickContact, type ReferralData } from '@/components/marketing/MarketingHub';
import type { CampaignRow } from '@/lib/campaigns-shared';
import { LeadAutomationForm } from '@/components/admin/LeadAutomationForm';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { MarketingAutomations, type BuiltinAutomation } from '@/components/marketing/MarketingAutomations';
import { SOURCE_EL } from '@/lib/contacts-hub-shared';
import { CHANNEL_NAME } from '@/lib/campaigns-shared';
import { cleanAudience } from '@/lib/campaigns-shared';
import { cleanSchedule, cleanTrigger, type AutomationRow } from '@/lib/marketing-automations-shared';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Marketing ανά κανάλι: Email · SMS (και WhatsApp) · Push · Συστάσεις · Αναφορές · Benefits. */
export default async function MarketingPage({ searchParams }: { searchParams: { tab?: string; channel?: string; cat?: string; group?: string; tag?: string; role?: string; ids?: string } }) {
  const profile = await requirePermission('marketing');
  const supabase = await createSupabaseServerClient();
  const db = supabase as any;
  const [{ data: camps }, { data: groupRows }, { data: contactRows }, { data: codes }, { data: reds }, autoRes] = await Promise.all([
    db.from('marketing_campaigns').select('*').order('created_at', { ascending: false }).limit(1000),
    db.from('contact_groups').select('name').order('name'),
    db.from('contacts').select('id, full_name, email, phone, marketing_opt_in, groups, tags, status').is('anonymized_at', null).neq('status', 'archived').order('full_name').limit(5000),
    db.from('referral_codes').select('*, referrer:referrer_contact_id(full_name)').order('created_at', { ascending: false }),
    db.from('referral_redemptions').select('id, code_id, status, created_at, referee:referee_contact_id(full_name), code:code_id(code)').order('created_at', { ascending: false }).limit(2000),
    db.from('marketing_automations').select('*').order('created_at', { ascending: false }).limit(1000),
  ]);
  // Δικοί μου αυτοματισμοί (κενό αν δεν έχει περάσει ακόμη το migration 0109).
  const automations: AutomationRow[] = ((autoRes?.error ? [] : autoRes?.data ?? []) as any[]).map((a) => ({
    id: a.id, name: a.name, kind: a.kind === 'event' ? 'event' : 'schedule', channel: a.channel,
    audience: cleanAudience(a.audience, a.channel), trigger: cleanTrigger(a.trigger), schedule: cleanSchedule(a.schedule),
    subject: a.subject, body: a.body ?? '', active: !!a.active, nextRunAt: a.next_run_at, lastRunAt: a.last_run_at, runs: a.runs ?? 0, createdAt: a.created_at,
  }));
  const contactsAll = (contactRows ?? []) as any[];
  const groupNames = Array.from(new Set([...((groupRows ?? []) as any[]).map((g) => g.name as string), ...contactsAll.flatMap((c) => (c.groups ?? []) as string[])])).sort((a, b) => a.localeCompare(b, 'el'));
  const groups = groupNames.map((name) => ({ name, n: contactsAll.filter((c) => (c.groups ?? []).includes(name)).length }));
  const tagList = Array.from(new Set(contactsAll.flatMap((c) => (c.tags ?? []) as string[]))).sort();
  const picks: PickContact[] = contactsAll.map((c) => ({ id: c.id, name: c.full_name ?? c.email ?? '—', email: c.email, phone: c.phone, optIn: !!c.marketing_opt_in }));
  const campaigns: CampaignRow[] = ((camps ?? []) as any[]).map((c) => ({ id: c.id, name: c.name, channel: c.channel, audience: c.audience ?? {}, subject: c.subject, preview: c.preview, body: c.body ?? '', status: c.status, recipients: c.recipients ?? 0, sent: c.sent ?? 0, failed: c.failed ?? 0, skipped: c.skipped ?? 0, opened: c.opened ?? 0, createdAt: c.created_at, sentAt: c.sent_at, createdBy: c.created_by, scheduledAt: c.scheduled_at ?? null }));
  const redRows = (reds ?? []) as any[];
  const referrals: ReferralData = {
    codes: ((codes ?? []) as any[]).map((c) => ({ id: c.id, code: c.code, referrer: c.referrer?.full_name ?? null, referrerId: c.referrer_contact_id, refType: c.referrer_reward_type, refValue: c.referrer_reward_value == null ? null : Number(c.referrer_reward_value), eeType: c.referee_reward_type, eeValue: c.referee_reward_value == null ? null : Number(c.referee_reward_value), active: !!c.active, note: c.note, createdAt: c.created_at, uses: redRows.filter((r) => r.code_id === c.id).length })),
    redemptions: redRows.map((r) => ({ id: r.id, codeId: r.code_id, code: r.code?.code ?? '—', referee: r.referee?.full_name ?? null, status: r.status, createdAt: r.created_at })),
  };
  const canEdit = effectiveCan(profile.role, profile.moduleAccess, 'marketing', 'edit', profile.permissions);
  const org = await getOrgSettingsRaw();
  const leadAutomation = org.leadAutomation;
  const stages = Array.from(new Map(org.pipelines.pipelines.flatMap((pl) => pl.stages.map((st) => [st.key, { key: st.key, label: org.pipelines.pipelines.length > 1 ? `${st.label} (${pl.name})` : st.label }] as const))).values());
  const sources = Object.entries(SOURCE_EL).filter(([k]) => k !== 'manual') as [string, string][];
  const la = leadAutomation;
  const ap = la.appointments;
  const bd = org.notifications.birthday;
  const builtins: BuiltinAutomation[] = [
    { id: 'welcome', category: 'leads', name: 'Καλωσόρισμα νέου lead', channel: [la.welcome.whatsapp && 'WhatsApp', la.welcome.email && 'Email'].filter(Boolean).join(' + ') || '—', when: [{ t: 'Νέο lead' }, { t: 'Αμέσως' }], active: la.welcome.enabled, href: '#lead-messages' },
    { id: 'sequence', category: 'leads', name: 'Follow-up μηνύματα', channel: 'WhatsApp / Email', when: [{ t: 'Νέο lead' }, { t: `${la.sequence.steps.length}`, data: true }, { t: 'βήματα' }], active: la.sequence.enabled, href: '#lead-messages' },
    { id: 'appt-confirm', category: 'viewings', name: 'Επιβεβαίωση ραντεβού', channel: CHANNEL_NAME[ap.confirm.channel], when: [{ t: 'Κλείστηκε ραντεβού / ξενάγηση' }, { t: 'Αμέσως' }], active: ap.confirm.enabled, href: '#lead-messages' },
    { id: 'appt-reminder', category: 'viewings', name: 'Υπενθύμιση ραντεβού', channel: CHANNEL_NAME[ap.reminder.channel], when: [{ t: 'Ώρα ραντεβού / ξενάγησης' }, { t: `${ap.reminder.hoursBefore}`, data: true }, { t: 'ώρες' }, { t: 'πριν' }], active: ap.reminder.enabled, href: '#lead-messages' },
    { id: 'birthday', category: 'special', name: 'Ευχές γενεθλίων', channel: CHANNEL_NAME[bd.channel], when: [{ t: 'Γενέθλια πελάτη' }, { t: bd.time, data: true }], active: bd.enabled, href: '/settings?section=notifications' },
  ];
  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Marketing" title="Marketing" description="Όλα τα μηνύματα προς τους πελάτες σας σε ένα μέρος: καμπάνιες (μία φορά) και αυτοματισμοί (μόνα τους)." />
      <MarketingHub automations={<MarketingAutomations rows={automations} builtins={builtins} groups={groups} contacts={picks} tags={tagList} stages={stages} sources={sources} canEdit={canEdit} initialCat={searchParams.cat} />} activeAutomations={automations.filter((a) => a.active).length + builtins.filter((b) => b.active).length} campaigns={campaigns} groups={groups} contacts={picks} tags={tagList} prefill={searchParams} referrals={referrals} canEdit={canEdit}
        leadAutomation={leadAutomation ? <LeadAutomationForm part="marketing" initial={leadAutomation} canEdit={canEdit} team={[]} /> : null} />
    </div>
  );
}
