import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { effectiveCan } from '@/lib/permissions';
import { MarketingHub, type PickContact, type ReferralData } from '@/components/marketing/MarketingHub';
import type { CampaignRow } from '@/lib/campaigns-shared';
import { LeadAutomationForm } from '@/components/admin/LeadAutomationForm';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { MarketingAutomations, type BuiltinAutomation, type LastCheck } from '@/components/marketing/MarketingAutomations';
import type { SenderDefaults } from '@/lib/campaigns-shared';
import type { SignatureInfo } from '@/lib/message-format-shared';
import { SOURCE_EL } from '@/lib/contacts-hub-shared';
import { CHANNEL_NAME } from '@/lib/campaigns-shared';
import { cleanAudience } from '@/lib/campaigns-shared';
import { cleanSchedule, cleanTrigger, type AutomationRow, type AutomationStats } from '@/lib/marketing-automations-shared';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Marketing ανά κανάλι: Email · SMS (και WhatsApp) · Push · Συστάσεις · Αναφορές · Benefits. */
export default async function MarketingPage({ searchParams }: { searchParams: { tab?: string; channel?: string; cat?: string; open?: string; group?: string; tag?: string; role?: string; ids?: string } }) {
  const profile = await requirePermission('marketing');
  const supabase = await createSupabaseServerClient();
  const db = supabase as any;
  const [{ data: camps }, { data: groupRows }, { data: contactRows }, { data: codes }, { data: reds }, autoRes, sendsRes, lastRunRes] = await Promise.all([
    db.from('marketing_campaigns').select('*').order('created_at', { ascending: false }).limit(1000),
    db.from('contact_groups').select('name').order('name'),
    db.from('contacts').select('id, full_name, email, phone, marketing_opt_in, groups, tags, status').is('anonymized_at', null).neq('status', 'archived').order('full_name').limit(5000),
    db.from('referral_codes').select('*, referrer:referrer_contact_id(full_name)').order('created_at', { ascending: false }),
    db.from('referral_redemptions').select('id, code_id, status, created_at, referee:referee_contact_id(full_name), code:code_id(code)').order('created_at', { ascending: false }).limit(2000),
    db.from('marketing_automations').select('*').order('created_at', { ascending: false }).limit(1000),
    db.from('marketing_automation_sends').select('automation_id, status').limit(50000),
    db.from('automation_runs').select('started_at, status, summary').eq('job', 'marketing_automations').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  // Δικοί μου αυτοματισμοί (κενό αν δεν έχει περάσει ακόμη το migration 0109).
  const automations: AutomationRow[] = ((autoRes?.error ? [] : autoRes?.data ?? []) as any[]).map((a) => ({
    id: a.id, name: a.name, kind: a.kind === 'event' ? 'event' : 'schedule', channel: a.channel,
    audience: cleanAudience(a.audience, a.channel), trigger: cleanTrigger(a.trigger), schedule: cleanSchedule(a.schedule),
    subject: a.subject, body: a.body ?? '', subjectEn: a.subject_en ?? null, bodyEn: a.body_en ?? null, senderName: a.sender_name ?? null, active: !!a.active, nextRunAt: a.next_run_at, lastRunAt: a.last_run_at, runs: a.runs ?? 0, createdAt: a.created_at,
  }));
  const contactsAll = (contactRows ?? []) as any[];
  const groupNames = Array.from(new Set([...((groupRows ?? []) as any[]).map((g) => g.name as string), ...contactsAll.flatMap((c) => (c.groups ?? []) as string[])])).sort((a, b) => a.localeCompare(b, 'el'));
  const groups = groupNames.map((name) => ({ name, n: contactsAll.filter((c) => (c.groups ?? []).includes(name)).length }));
  const tagList = Array.from(new Set(contactsAll.flatMap((c) => (c.tags ?? []) as string[]))).sort();
  const picks: PickContact[] = contactsAll.map((c) => ({ id: c.id, name: c.full_name ?? c.email ?? '—', email: c.email, phone: c.phone, optIn: !!c.marketing_opt_in }));
  const campaigns: CampaignRow[] = ((camps ?? []) as any[]).map((c) => ({ id: c.id, name: c.name, channel: c.channel, audience: c.audience ?? {}, subject: c.subject, preview: c.preview, body: c.body ?? '', status: c.status, recipients: c.recipients ?? 0, sent: c.sent ?? 0, failed: c.failed ?? 0, skipped: c.skipped ?? 0, opened: c.opened ?? 0, createdAt: c.created_at, sentAt: c.sent_at, createdBy: c.created_by, scheduledAt: c.scheduled_at ?? null, subjectEn: c.subject_en ?? null, bodyEn: c.body_en ?? null, senderName: c.sender_name ?? null }));
  const redRows = (reds ?? []) as any[];
  const referrals: ReferralData = {
    codes: ((codes ?? []) as any[]).map((c) => ({ id: c.id, code: c.code, referrer: c.referrer?.full_name ?? null, referrerId: c.referrer_contact_id, refType: c.referrer_reward_type, refValue: c.referrer_reward_value == null ? null : Number(c.referrer_reward_value), eeType: c.referee_reward_type, eeValue: c.referee_reward_value == null ? null : Number(c.referee_reward_value), active: !!c.active, note: c.note, createdAt: c.created_at, uses: redRows.filter((r) => r.code_id === c.id).length })),
    redemptions: redRows.map((r) => ({ id: r.id, codeId: r.code_id, code: r.code?.code ?? '—', referee: r.referee?.full_name ?? null, status: r.status, createdAt: r.created_at })),
  };
  // «Αποστολές» ανά αυτοματισμό: γεγονότα από το ιστορικό αποστολών, επαναλαμβανόμενα από τις καμπάνιες τους.
  const stats: Record<string, AutomationStats> = {};
  for (const a of automations) stats[a.id] = { sent: 0, failed: 0, skipped: 0 };
  for (const r of ((sendsRes?.error ? [] : sendsRes?.data ?? []) as any[])) {
    const st = stats[r.automation_id]; if (!st) continue;
    if (r.status === 'sent' || r.status === 'queued') st.sent++; else if (r.status === 'failed') st.failed++; else if (r.status === 'skipped') st.skipped++;
  }
  for (const a of automations.filter((x) => x.kind === 'schedule')) {
    for (const c of (camps ?? []) as any[]) {
      if (c.automation_id ? c.automation_id !== a.id : !String(c.name ?? '').startsWith(`${a.name} · `)) continue;
      stats[a.id].sent += c.sent ?? 0; stats[a.id].failed += c.failed ?? 0; stats[a.id].skipped += c.skipped ?? 0;
    }
  }
  const lastRun = lastRunRes?.data as any;
  const lastCheck: LastCheck | null = lastRun ? { at: lastRun.started_at, status: lastRun.status, summary: lastRun.summary ?? null } : null;
  const canEdit = effectiveCan(profile.role, profile.moduleAccess, 'marketing', 'edit', profile.permissions);
  const org = await getOrgSettingsRaw();
  const leadAutomation = org.leadAutomation;
  const stages = Array.from(new Map(org.pipelines.pipelines.flatMap((pl) => pl.stages.map((st) => [st.key, { key: st.key, label: org.pipelines.pipelines.length > 1 ? `${st.label} (${pl.name})` : st.label }] as const))).values());
  const sources = Object.entries(SOURCE_EL).filter(([k]) => k !== 'manual') as [string, string][];
  const senderDefaults: SenderDefaults = { email: org.communication.emailFromName, sms: org.communication.smsSender };
  const b0 = org.business;
  const signature: SignatureInfo = { signature: org.communication.signature, phone: b0.landline || b0.mobile || '', email: org.communication.emailReplyTo || b0.invoiceEmail || '', website: b0.website || '' };
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
      <MarketingHub automations={<MarketingAutomations rows={automations} builtins={builtins} groups={groups} contacts={picks} tags={tagList} stages={stages} sources={sources} canEdit={canEdit} initialCat={searchParams.cat} stats={stats} lastCheck={lastCheck} isAdmin={profile.role === 'admin'} senderDefaults={senderDefaults} signature={signature} />} activeAutomations={automations.filter((a) => a.active).length + builtins.filter((b) => b.active).length} campaigns={campaigns} groups={groups} contacts={picks} tags={tagList} prefill={searchParams} referrals={referrals} canEdit={canEdit} senderDefaults={senderDefaults} signature={signature}
        leadAutomation={leadAutomation ? <LeadAutomationForm part="marketing" initial={leadAutomation} canEdit={canEdit} team={[]} signature={org.communication.signature} /> : null} />
    </div>
  );
}
